// src/components/code/MonacoSnippet.tsx
// 用 Monaco 渲染代码：
//   - v1.13（2026-06-02 起）：优先用 snippet.file_content（整个文件）+ 滚到方法 + 高亮方法范围
//   - fallback：snippet.code（方法片段）—— 超大文件 / 文件读不到时
// callees 调用点标成可点击装饰，点击 → openEntity 跳转。
// 设计 [[代码片段查看器-设计]] §5。@monaco-editor/react 内部懒加载 Monaco。
import '@/lib/monacoSetup'                                            // 自托管 Monaco（worker + loader.config），副作用导入；保证 Editor 首次渲染前已配置好
import { useRef, useEffect } from 'react'                             // useRef：可变引用；useEffect：副作用（snippet 切换重新装饰 / reveal）
import Editor, { type OnMount } from '@monaco-editor/react'           // Monaco 编辑器封装（使用 monacoSetup 注入的本地 monaco，不走 CDN）
// 直接拿 Monaco 类型给 editor / monaco-namespace 用，避免 any
// 仅类型导入（`import type`）不产生运行时代码，不影响 bundle
import type * as monacoT from 'monaco-editor'
import type { CodeSnippet } from '@/types/codeSnippet'                // 只引入类型（编译后无运行时代码）
import { computeCalleeDecorations } from './calleeDecorations'        // 调用点坐标换算纯函数
import { useCodeViewerStore } from '@/store/codeViewer'              // Zustand store：openEntity 跳转

// ─── Props 类型定义 ───────────────────────────────────────────────────────────
interface Props {
  snippet: CodeSnippet | null     // 要显示的代码片段；null 表示未加载/加载中/出错
  loading?: boolean               // true → 展示加载态（?= 可选 prop，默认 false）
  error?: string | null           // 非空字符串 → 展示错误文案
  theme: 'light' | 'dark'         // 由父组件传入（父读 useThemeStore，此组件不直接读 store）
}

/**
 * 代码片段 Monaco 查看器组件。
 *
 * v1.13（2026-06-02）：
 *   - file_content 命中（< 200KB）→ 整文件视图 + revealLineInCenter(start_line) + 方法范围高亮
 *   - file_content=null（超大 / 读不到）→ 退化到 code 字段（方法片段）
 *
 * - loading / error / null snippet → 降级 UI（不渲染 Monaco，也是 Monaco 懒加载失败的兜底）
 * - 正常 snippet → 渲染 Monaco，挂载后通过 deltaDecorations 在 callees 处加装饰
 * - 点击装饰范围 → 调用 openEntity 跳转到对应实体
 */
export function MonacoSnippet({ snippet, loading = false, error = null, theme }: Props) {
  // 从 store 取 openEntity action（用于装饰点击跳转）
  // useCodeViewerStore(selector) 是 Zustand 选择器用法，避免订阅整个 store
  const openEntity = useCodeViewerStore(s => s.openEntity)

  // editorRef / monacoRef：保留 Monaco 实例引用，让 useEffect 在 snippet 切换时
  // 重新做 setValue / revealLineInCenter / deltaDecorations
  // （v1.13 之前 onMount 只跑一次，切 tab 后没刷新装饰 / reveal）
  const editorRef = useRef<monacoT.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monacoT | null>(null)
  // 当前 editor 上挂着的所有 decoration id，下次更新 deltaDecorations(oldIds, newIds) 替换
  // 防止 callee + method-range 装饰每次 effect 跑都叠加
  const decoIdsRef = useRef<string[]>([])

  // decoRef 记录「装饰坐标 → entityId」映射，onMouseDown 时按点击位置查找命中项
  const decoRef = useRef<{
    start: { l: number; c: number }   // Monaco 坐标（1-indexed）
    end: { l: number; c: number }
    entityId: string
    wholeLine: boolean                // col 缺失的整行兜底项：点击该行任意列都算命中
  }[]>([])

  // ── snippet 变化时（切 tab / 重新打开）重新装饰 + reveal ────────────────────
  // useEffect 监听 [snippet]，每次 snippet 引用变化触发：
  //   1. 算 callee decorations（整文件视图传 startLine=1，方法片段视图传 snippet.start_line）
  //   2. 加 method-range 高亮（仅整文件视图）
  //   3. revealLineInCenter 滚到方法首行（仅整文件视图）
  // editor 还没 mount 时 ref=null，跳过；onMount 时也会跑一次保证首次也装饰
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco || !snippet) return

    // 整文件视图：file_content 存在 → callees.line 直接是绝对行（Monaco 第 N 行）
    // 方法片段视图：传 snippet.start_line → callees.line 换算成片段内 1-indexed 行
    const useFullFile = !!snippet.file_content
    const calleeOffsetStart = useFullFile ? 1 : snippet.start_line

    // 1. callee decorations（同款逻辑，只是 offset 变）
    const calleeDecos = computeCalleeDecorations(snippet.callees, calleeOffsetStart)
    decoRef.current = calleeDecos.map(d => ({
      start: { l: d.startLineNumber, c: d.startColumn },
      end:   { l: d.endLineNumber,   c: d.endColumn   },
      entityId: d.entityId,
      wholeLine: d.wholeLine,
    }))

    // 2. 合并 callees + method-range 装饰，一次性 deltaDecorations 替换旧装饰
    const newDecorations: monacoT.editor.IModelDeltaDecoration[] = [
      ...calleeDecos.map(d => ({
        range: new monaco.Range(
          d.startLineNumber,
          d.startColumn,
          d.endLineNumber,
          d.wholeLine ? d.startColumn : d.endColumn,
        ),
        options: d.wholeLine
          ? { isWholeLine: true, className: 'cs-callee-line' }
          : { inlineClassName: 'cs-callee' },
      })),
      // method-range 高亮：仅整文件视图
      // endLine+1 让 endLine 后那行也覆盖到（左闭右开 Monaco range 习惯）
      ...(useFullFile
        ? [{
            range: new monaco.Range(snippet.start_line, 1, snippet.end_line + 1, 1),
            options: {
              isWholeLine: true,
              className: 'cs-method-highlight',
              linesDecorationsClassName: 'cs-method-marker',
            },
          }]
        : []),
    ]
    decoIdsRef.current = editor.deltaDecorations(decoIdsRef.current, newDecorations)

    // 3. 整文件视图：滚动让方法首行落到 viewport 中央
    if (useFullFile) {
      editor.revealLineInCenter(snippet.start_line)
    }
  }, [snippet])

  // ── 加载 / 错误 / 空态：不渲染 Monaco ─────────────────────────────────────
  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中…</div>
  if (error) return <div className="p-4 text-sm text-[var(--destructive)]">{error}</div>
  if (!snippet) return null

  // ── onMount：保存 editor / monaco 引用 + 绑定 mouseDown 点击跳转 ─────────────
  // 注意：装饰逻辑迁移到上面的 useEffect 里（mount 后 useEffect 也会跑一次保证首次装饰）
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 监听鼠标按下，命中 callee 装饰范围 → openEntity 跳转
    editor.onMouseDown((e: { target: { position: { lineNumber: number; column: number } | null } }) => {
      const pos = e.target.position
      if (!pos) return
      const hit = decoRef.current.find(d =>
        pos.lineNumber === d.start.l &&
        (d.wholeLine || (pos.column >= d.start.c && pos.column <= d.end.c))
      )
      if (hit) void openEntity(hit.entityId)
    })
  }

  // 整文件优先；fallback 方法片段
  // 整文件可能很大但 Monaco 自带 virtual rendering，10k+ 行也流畅
  const editorValue = snippet.file_content ?? snippet.code

  return (
    <Editor
      height="100%"
      language={snippet.language}
      value={editorValue}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      onMount={handleMount}
      options={{
        readOnly: true,
        // 整文件视图启用 minimap（长文件导航）；方法片段视图关掉（节省空间）
        minimap: { enabled: !!snippet.file_content, side: 'right' },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbersMinChars: 3,
        // 整文件视图开 folding 让用户折叠其它方法
        folding: !!snippet.file_content,
      }}
    />
  )
}
