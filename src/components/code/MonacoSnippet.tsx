// src/components/code/MonacoSnippet.tsx
// 用 Monaco 渲染一段代码片段，把后端 callees 调用点标成可点击装饰，点击 → openEntity 跳转。
// 设计 [[代码片段查看器-设计]] §5。@monaco-editor/react 内部懒加载 Monaco。
import '@/lib/monacoSetup'                                            // 自托管 Monaco（worker + loader.config），副作用导入；保证 Editor 首次渲染前已配置好
import { useRef } from 'react'                                        // useRef：保存不触发重渲染的可变引用
import Editor, { type OnMount } from '@monaco-editor/react'           // Monaco 编辑器封装（使用 monacoSetup 注入的本地 monaco，不走 CDN）
import type { CodeSnippet } from '@/types/codeSnippet'                // 只引入类型（编译后无运行时代码）
import { computeCalleeDecorations } from './calleeDecorations'        // 调用点坐标换算纯函数
import { useCodeViewerStore } from '@/store/codeViewer'              // Zustand store：openEntity 跳转

// ─── Props 类型定义 ───────────────────────────────────────────────────────────
interface Props {
  snippet: CodeSnippet | null     // 要显示的代码片段；null 表示未加载/加载中/出错
  loading?: boolean               // true → 展示加载态（?= 可选 prop，默认 false）
  error?: string | null           // 非空字符串 → 展示错误文案
  theme: 'light' | 'dark'        // 由父组件传入（父读 useThemeStore，此组件不直接读 store）
}

/**
 * 代码片段 Monaco 查看器组件。
 *
 * - loading / error / null snippet → 降级 UI（不渲染 Monaco，也是 Monaco 懒加载失败的兜底）
 * - 正常 snippet → 渲染 Monaco，挂载后通过 deltaDecorations 在 callees 处加装饰
 * - 点击装饰范围 → 调用 openEntity 跳转到对应实体
 */
export function MonacoSnippet({ snippet, loading = false, error = null, theme }: Props) {
  // 从 store 取 openEntity action（用于装饰点击跳转）
  // useCodeViewerStore(selector) 是 Zustand 选择器用法，避免订阅整个 store
  const openEntity = useCodeViewerStore(s => s.openEntity)

  // decoRef 记录「装饰坐标 → entityId」映射，onMouseDown 时按点击位置查找命中项
  // useRef<T> 返回 { current: T }，修改 current 不会触发重渲染（用于存运行时状态）
  const decoRef = useRef<{
    start: { l: number; c: number }   // Monaco 坐标（1-indexed）
    end: { l: number; c: number }
    entityId: string
    wholeLine: boolean                // col 缺失的整行兜底项：点击该行任意列都算命中
  }[]>([])

  // ── 加载 / 错误 / 空态：不渲染 Monaco ─────────────────────────────────────
  // 这三条 early return 也兜底了 Monaco 包本身懒加载失败的场景
  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中…</div>
  if (error) return <div className="p-4 text-sm text-[var(--destructive)]">{error}</div>
  if (!snippet) return null

  // ── onMount：Monaco 编辑器挂载完成时的回调 ─────────────────────────────────
  // OnMount 类型是 (editor: IStandaloneCodeEditor, monaco: Monaco) => void
  const handleMount: OnMount = (editor, monaco) => {
    // 换算所有 callees → Monaco 片段内装饰范围
    const decos = computeCalleeDecorations(snippet.callees, snippet.start_line)

    // 同步写入 decoRef，供点击事件查表（decoRef.current 在整个组件生命周期内有效）
    decoRef.current = decos.map(d => ({
      start: { l: d.startLineNumber, c: d.startColumn },
      end:   { l: d.endLineNumber,   c: d.endColumn   },
      entityId: d.entityId,
      wholeLine: d.wholeLine,
    }))

    // deltaDecorations(旧装饰id[], 新装饰[]) → 在编辑器上添加/替换装饰
    // wholeLine=true → isWholeLine=true + cs-callee-line（整行背景色）
    // wholeLine=false → inlineClassName=cs-callee（行内下划线 + 颜色）
    editor.deltaDecorations([], decos.map(d => ({
      range: new monaco.Range(
        d.startLineNumber,
        d.startColumn,
        d.endLineNumber,
        d.wholeLine ? d.startColumn : d.endColumn,   // 整行模式列号占位即可
      ),
      options: d.wholeLine
        ? { isWholeLine: true, className: 'cs-callee-line' }
        : { inlineClassName: 'cs-callee' },
    })))

    // 监听鼠标按下事件；Monaco 的 onMouseDown 比 onClick 更可靠（不受编辑器内部 focus 影响）
    // e.target.position 是 Monaco IMouseTargetContentText 的坐标（1-indexed）
    editor.onMouseDown((e: { target: { position: { lineNumber: number; column: number } | null } }) => {
      const pos = e.target.position
      if (!pos) return   // 点击到编辑器边缘/滚动条等非文本区域时 position 为 null

      // 在 decoRef 中查找命中的装饰范围（行相同 + 列在范围内）
      const hit = decoRef.current.find(d =>
        pos.lineNumber === d.start.l &&
        // wholeLine 兜底项（col 缺失，整行高亮）→ 点该行任意列都命中；否则按列范围
        (d.wholeLine || (pos.column >= d.start.c && pos.column <= d.end.c))
      )

      // 命中 → openEntity 打开/激活对应实体 tab（返回 Promise，void 处理防 linter 警告）
      if (hit) void openEntity(hit.entityId)
    })
  }

  // ── 正常渲染 Monaco ───────────────────────────────────────────────────────
  return (
    <Editor
      height="100%"                                            // 撑满父容器高度（父容器需设 height）
      language={snippet.language}                             // 语法高亮语言（如 "java"、"python"）
      value={snippet.code}                                    // 只读代码内容
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}            // 主题映射：dark→vs-dark，light→vs
      onMount={handleMount}                                   // 挂载后添加 callees 装饰
      options={{
        readOnly: true,                                       // 只读，禁止用户编辑
        minimap: { enabled: false },                          // 关闭小地图（片段短，无需小地图）
        scrollBeyondLastLine: false,                          // 禁止滚动到最后一行之后
        fontSize: 13,                                         // 字体大小
        lineNumbersMinChars: 3,                               // 行号列最小宽度（3 位数字）
      }}
    />
  )
}
