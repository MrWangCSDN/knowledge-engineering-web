// src/components/code/MonacoSnippet.tsx
// 用 Monaco 渲染代码：
//   - v1.13（2026-06-02 起）：优先用 snippet.file_content（整个文件）+ 滚到方法 + 高亮方法范围
//   - fallback：snippet.code（方法片段）—— 超大文件 / 文件读不到时
// callees 调用点标成可点击装饰，点击 → openEntity 跳转。
// 设计 [[代码片段查看器-设计]] §5。@monaco-editor/react 内部懒加载 Monaco。
import '@/lib/monacoSetup'                                            // 自托管 Monaco（worker + loader.config），副作用导入；保证 Editor 首次渲染前已配置好
import { useRef, useEffect, useState } from 'react'                   // useRef：可变引用；useEffect：副作用（snippet 切换重新装饰 / reveal）；useState：mount 就绪态
import Editor, { type OnMount } from '@monaco-editor/react'           // Monaco 编辑器封装（使用 monacoSetup 注入的本地 monaco，不走 CDN）
// 直接拿 Monaco 类型给 editor / monaco-namespace 用，避免 any
// 仅类型导入（`import type`）不产生运行时代码，不影响 bundle
import type * as monacoT from 'monaco-editor'
import type { CodeSnippet, ResolvedSymbol } from '@/types/codeSnippet'  // 只引入类型（编译后无运行时代码）
import { computeCalleeDecorations } from './calleeDecorations'        // 调用点坐标换算纯函数
import { useCodeViewerStore } from '@/store/codeViewer'              // Zustand store：openEntity 跳转
import { resolveSymbol } from '@/api/codeSnippets'                   // IDE 化光标解析端点（hover + cmd-click 共用）

// ─── Hover 缓存（模块级，跨 snippet 共享；按 projectId|file_path:line:col 键控） ───
// 设计 [[代码查看器-IDE化导航-设计]] §4.2：hover 抖动同一位置不重复请求 resolveSymbol。
// 模块级而非组件级：snippet 切换/抽屉关闭再开，同一位置的解读仍命中缓存（用户体验更顺）。
// 大小 50：mall-swarm 类工程 hover 累计很少超过这个量；超出后按"插入顺序"驱逐最老一项（FIFO 近似 LRU）。
const HOVER_CACHE_LIMIT = 50
// Map 在 ES2015+ 保留插入顺序；keys().next() 取首个 key 即"最老"项
const hoverCache = new Map<string, ResolvedSymbol | null>()

/** LRU 读：命中则把该项重新插入到末尾（标记为最近使用）。 */
function hoverCacheGet(key: string): ResolvedSymbol | null | undefined {
  // has + get 分离：value 可能是 null（"全落空"也要缓存，避免重复查询）
  // 用 has 判存在性，避免 null 被误当作"未缓存"
  if (!hoverCache.has(key)) return undefined
  const v = hoverCache.get(key) as ResolvedSymbol | null
  // 删 + 重插：把命中项移到 Map 末尾（最新位置）；下次驱逐时它不会先被淘汰
  hoverCache.delete(key)
  hoverCache.set(key, v)
  return v
}

/** LRU 写：超过容量时驱逐最老项（Map 的首个 key）。 */
function hoverCacheSet(key: string, val: ResolvedSymbol | null): void {
  // 已存在 → 先删后插，更新位置
  if (hoverCache.has(key)) hoverCache.delete(key)
  hoverCache.set(key, val)
  // 超容驱逐：取首个 key（最老插入项）删除
  if (hoverCache.size > HOVER_CACHE_LIMIT) {
    const oldest = hoverCache.keys().next().value
    if (oldest !== undefined) hoverCache.delete(oldest)
  }
}


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
 *   - file_content 命中（< 200KB）→ 整文件视图 + revealLineNearTop(start_line) 方法置顶 + 方法范围高亮
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
  // 重新做 setValue / revealLineNearTop / deltaDecorations
  // （v1.13 之前 onMount 只跑一次，切 tab 后没刷新装饰 / reveal）
  const editorRef = useRef<monacoT.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monacoT | null>(null)
  // 当前 editor 上挂着的所有 decoration id，下次更新 deltaDecorations(oldIds, newIds) 替换
  // 防止 callee + method-range 装饰每次 effect 跑都叠加
  const decoIdsRef = useRef<string[]>([])

  // editor 是否已 mount 就绪：onMount 里置 true。
  // 关键修复：useEffect([snippet]) 在首次打开时先于 Monaco 异步 mount 跑（此刻 editorRef=null → 早返回，
  // 不装饰也不 reveal），而 onMount 只写 ref（可变引用不触发重渲染）→ effect 不会再跑 → 首开永远不滚动定位。
  // 把 ready 纳入 effect 依赖：mount 后 setReady(true) 触发重渲染 → effect 再跑一次（此时 ref 已就绪）→ 装饰 + reveal 生效。
  const [ready, setReady] = useState(false)

  // decoRef 记录「装饰坐标 → entityId」映射，onMouseDown 时按点击位置查找命中项
  const decoRef = useRef<{
    start: { l: number; c: number }   // Monaco 坐标（1-indexed）
    end: { l: number; c: number }
    entityId: string
    wholeLine: boolean                // col 缺失的整行兜底项：点击该行任意列都算命中
  }[]>([])

  // hoverProviderRef：保持 hover provider 的 dispose 句柄。组件卸载时 dispose；
  //   切语言时也 dispose 旧的再注册新的（避免对同一 language 注册重复）。
  // hoverLangRef：记录当前已注册的语言，与 snippet.language 比较决定是否要 re-register。
  const hoverProviderRef = useRef<monacoT.IDisposable | null>(null)
  const hoverLangRef = useRef<string | null>(null)

  // snippetRef：让 hover provider 闭包总拿到最新 snippet（避免 stale closure）。
  // 直接闭包捕获 snippet 会"冻"在 provider 注册那一刻的值；用 ref 每次读最新即可。
  const snippetRef = useRef<CodeSnippet | null>(snippet)
  useEffect(() => { snippetRef.current = snippet }, [snippet])

  // ── snippet 变化时（切 tab / 重新打开）重新装饰 + reveal ────────────────────
  // useEffect 监听 [snippet]，每次 snippet 引用变化触发：
  //   1. 算 callee decorations（整文件视图传 startLine=1，方法片段视图传 snippet.start_line）
  //   2. 加 method-range 高亮（仅整文件视图）
  //   3. revealLineNearTop 把方法首行滚到 viewport 顶部（仅整文件视图）
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

    // 3. 整文件视图：滚动让方法首行落到 viewport 顶部（用户偏好：方法置顶展示、body 在下方铺开，
    //    类似 IDE「跳转到定义」后方法顶在上沿）。revealLineNearTop 会留少量上边距（露出上方注解/签名）。
    if (useFullFile) {
      // rAF 等 Monaco 完成本帧布局再 reveal——刚 mount / 刚 setValue 时直接 reveal 常因视口高度未就绪而不滚动（卡在第 1 行）
      const line = snippet.start_line
      requestAnimationFrame(() => editor.revealLineNearTop(line))
    }
    // 依赖含 ready：保证 Monaco mount 就绪后 effect 再跑一次（首开 reveal/装饰生效）
  }, [snippet, ready])

  // ── Hover provider 注册（设计 §4.2：签名+解读 tooltip + 暂无源码占位）─────────
  // 策略：每个语言注册一次；snippet 语言变了 → dispose 旧的、注册新的；
  //       provider 内部用 snippetRef.current 读最新 snippet，避免闭包陈旧。
  useEffect(() => {
    const monaco = monacoRef.current
    if (!monaco || !snippet) return
    // 同语言且已注册 → 跳过（防 effect 多次跑导致重复注册堆叠）
    if (hoverLangRef.current === snippet.language && hoverProviderRef.current) return

    // 切语言：先 dispose 旧 provider
    hoverProviderRef.current?.dispose()
    hoverProviderRef.current = null

    // 注册新 provider：返 IDisposable，必须 dispose 才释放
    hoverProviderRef.current = monaco.languages.registerHoverProvider(snippet.language, {
      // provideHover 可返 Promise；Monaco 自带防抖、未 hover 时取消
      provideHover: async (model, position) => {
        // 闭包陷阱规避：每次调用都读 ref 的最新值
        const sn = snippetRef.current
        if (!sn) return null
        // getWordAtPosition：返 { word, startColumn, endColumn } 或 null
        // 非词位置（空白/标点）返 null → 无 token 可解析，直接退出
        const word = model.getWordAtPosition(position)
        if (!word) return null
        // 编辑器行 → 文件绝对行：整文件视图行即文件行；方法片段视图加 start_line - 1 偏移
        const useFullFile = !!sn.file_content
        const fileLine = useFullFile
          ? position.lineNumber
          : sn.start_line + position.lineNumber - 1
        // Monaco column 是 1-indexed，后端约定 0-indexed → 减 1
        const col = Math.max(0, position.column - 1)
        // projectId 从 store 取（非订阅，hover 异步路径里只读快照）
        const projectId = useCodeViewerStore.getState().projectId
        if (!projectId) return null

        const cacheKey = `${projectId}|${sn.file_path}:${fileLine}:${col}`
        // 缓存命中（包含已知为 null 的"全落空"，避免反复请求）
        let result = hoverCacheGet(cacheKey)
        if (result === undefined) {
          // 未缓存 → 调后端；任何异常视为"无解析结果"，缓存 null 避免反复重试
          try {
            result = await resolveSymbol(projectId, {
              file_path: sn.file_path,
              line: fileLine,
              col,
              token: word.word,
              context_entity_id: sn.entity_id,
              want_doc: true,
            })
          } catch {
            result = null
          }
          hoverCacheSet(cacheKey, result)
        }

        if (!result) return null

        // ── tooltip markdown 渲染 ─────────────────────────────────────────────
        // has_source=false：显式"暂无源码"占位（前端 IDE 体验：JDK/三方/未索引也有反馈）
        // has_source=true：签名（code 块）+ summary（首句）；任一缺失就跳过
        const parts: string[] = []
        if (!result.has_source) {
          parts.push('**暂无源码**')
        } else {
          if (result.signature) {
            // 代码块包裹 signature → Monaco hover 自带 monospace 高亮
            parts.push(`\`\`\`${sn.language}\n${result.signature}\n\`\`\``)
          }
          if (result.summary) {
            parts.push(result.summary)
          }
        }
        // 一行内容都没有（has_source=true 但无 signature/summary）→ 不弹 tooltip
        if (parts.length === 0) return null
        // contents 是 IMarkdownString[]，多段以双换行分隔（标准 markdown 段落）
        return {
          contents: parts.map(value => ({ value, isTrusted: false })),
        }
      },
    })
    hoverLangRef.current = snippet.language
  }, [snippet, ready])

  // ── 组件卸载清理：dispose hover provider（防泄漏 + 防多次切换/挂载叠加 provider）──
  useEffect(() => {
    return () => {
      hoverProviderRef.current?.dispose()
      hoverProviderRef.current = null
      hoverLangRef.current = null
    }
  }, [])

  // ── 加载 / 错误 / 空态：不渲染 Monaco ─────────────────────────────────────
  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中…</div>
  if (error) return <div className="p-4 text-sm text-[var(--destructive)]">{error}</div>
  if (!snippet) return null

  // ── onMount：保存 editor / monaco 引用 + 绑定 mouseDown 点击跳转 ─────────────
  // 注意：装饰逻辑迁移到上面的 useEffect 里（mount 后 useEffect 也会跑一次保证首次装饰）
  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    // 触发重渲染 → useEffect([snippet, ready]) 再跑一次（此时 ref 已就绪），让首次打开也能装饰 + reveal 定位
    setReady(true)

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
