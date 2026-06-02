/**
 * src/components/chat/AssistantMessage.tsx
 *
 * AI 消息 — 平铺式（无厚重边框卡片），左对齐。
 * 段落之间用空行分隔；段标题用小字号灰色 prefix。
 *
 * v1（W5）：纯文本渲染。
 * v1.4（W14）：call_chain 段含 ```mermaid 块时分流给 MermaidDiagram。
 */
import { lazy, Suspense, useState, useMemo, useDeferredValue } from 'react'
import { Download } from 'lucide-react'
// v1.8：react-markdown 把流式 raw_stream 文本实时渲染成 markdown
// remark-gfm 加 GitHub-flavored markdown 支持（表格 / 删除线 / 任务列表）
import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
// 2026-06-02：数学公式支持 — $E=mc^2$ 行内 / $$\sum$$ 块级；
// remark-math 把 $$ / $ 切成 math/inlineMath 节点；rehype-katex 用 KaTeX 库渲染成 HTML
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
// 2026-06-02：让 react-markdown 处理 raw HTML（默认会丢）；
// 主要是支持后端 _fix_gfm_table_cells 在表格 cell 内输出 <br>。
// 安全性说明：LLM 输出由我们的后端 prompt 控制，非用户直接输入；
// 风险来源是"LLM 被诱导回显用户的 <script>"——这层信任与系统其它环节一致，
// 不在此处单独引入 rehype-sanitize（会破坏 KaTeX 自带的 className/MathML）
import rehypeRaw from 'rehype-raw'
// KaTeX 自带 22KB CSS（字形/字号/对齐），不引入数学会显示为 raw HTML
// 放在 AssistantMessage（chat lazy chunk）里加载，登录页等非 chat 路由不付这个成本
import 'katex/dist/katex.min.css'
import { remarkEntityRef, entityUrlTransform } from './remarkEntityRef'
import { remarkNormalizePunct } from './remarkNormalizePunct'
import { remarkCodeMeta, parseCodeTitle } from './remarkCodeMeta'
import { remarkCallout } from './remarkCallout'
import { EntityRef, EntityChip } from './EntityRef'
import { HighlightCtx } from './HighlightCtx'

import type { Message } from '@/types/chat'
import { exportMessageAsDocx } from '@/api/sessions'
// v1.9.1：MermaidDiagram lazy load —— mermaid 库 ~250KB，
// 登录页 / 设置页 / 影响分析页都不需要；只在 chat 答案含 ```mermaid 时才下载
const MermaidDiagram = lazy(() =>
  import('./MermaidDiagram').then(m => ({ default: m.MermaidDiagram })),
)
import { ToolCallCard } from './ToolCallCard'
import { ThinkingBlock } from './ThinkingBlock'
import { TodoList } from './TodoList'
import { CodeBlock } from './CodeBlock'
import { extractSectionContents } from './extractSectionContents'
import { useThemeStore } from '@/store/theme'

// v1.10：ReactMarkdown components 覆盖 — 把 fenced code block 渲染为 ChatGPT 风格 CodeBlock
// react-markdown v10 的 code 钩子 props: { className?, children, node, ... }
// `inline` 字段已废弃，改用 className 是否含 `language-xxx` 来判断
//
// 2026-05-21：react-markdown v10+ 的 Components 类型严格了，原 Record<string, unknown> 不再兼容；
// 用 `as Components` 类型断言绕过严格签名 — 运行时 props 形态与 v9 一致，运行无影响。
const MD_COMPONENTS: Components = {
  code: (props) => {
    const className = (props.className as string) || ''
    const children = props.children
    // 行内 `code` 没有 className，直接走 inline 样式
    if (!className.startsWith('language-')) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-[13px] font-mono">
          {children as React.ReactNode}
        </code>
      )
    }
    // fenced ```lang ... ``` → 走 CodeBlock
    const language = className.replace('language-', '')
    const codeText = String(children ?? '').replace(/\n$/, '')
    // 2026-06-02：解析 ```lang title="Foo.java" 里的文件名
    // remarkCodeMeta 已经把 meta 字符串挂到 data-meta 属性上
    const meta = (props as { 'data-meta'?: string })['data-meta']
    const title = parseCodeTitle(meta)
    return <CodeBlock language={language} value={codeText} title={title} />
  },
  // 让 ReactMarkdown 渲染 fenced code 时不再包外层 <pre>（CodeBlock 自带容器）
  pre: (props) => <>{props.children as React.ReactNode}</>,
  // entity: scheme 链接 → EntityRef 组件；其余链接走普通 <a>
  a: (props) => {
    const href = (props.href as string) || ''
    if (href.startsWith('entity:')) {
      return <EntityRef entityId={href.slice('entity:'.length)}>{props.children as React.ReactNode}</EntityRef>
    }
    return <a href={href} target="_blank" rel="noreferrer" className="text-[var(--ref-accent)] underline">{props.children as React.ReactNode}</a>
  },
  // ── GFM 表格（2026-06-02）──
  // 不在容器里写 [&_table] 子选择器，因为外层容器 leading-[1.7] 会被表格继承，
  // 让单元格视觉行高过大产生"竖向错位"感（用户截图问题）。
  // 这里直接覆盖 th/td 自带 leading-[1.55]，并把表格塞进 overflow-x-auto 容器，
  // 视觉对齐 ChatGPT / open-webui。颜色全部走 design token，不硬编码。
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table
        className="w-full border-collapse text-[13.5px]"
        {...(props as React.HTMLAttributes<HTMLTableElement>)}
      />
    </div>
  ),
  thead: (props) => (
    <thead
      className="bg-muted/60"
      {...(props as React.HTMLAttributes<HTMLTableSectionElement>)}
    />
  ),
  tr: (props) => (
    <tr
      className="border-b border-border last:border-0"
      {...(props as React.HTMLAttributes<HTMLTableRowElement>)}
    />
  ),
  th: (props) => (
    <th
      className="px-3 py-2 text-left font-semibold text-foreground leading-[1.55] whitespace-nowrap"
      {...(props as React.ThHTMLAttributes<HTMLTableCellElement>)}
    />
  ),
  td: (props) => (
    <td
      className="px-3 py-2 align-top text-foreground/85 leading-[1.55]"
      {...(props as React.TdHTMLAttributes<HTMLTableCellElement>)}
    />
  ),
  // GFM 删除线 ~~xxx~~
  del: (props) => (
    <del
      className="text-muted-foreground"
      {...(props as React.HTMLAttributes<HTMLElement>)}
    />
  ),
  // GFM 任务列表 - [x] / - [ ]（remark-gfm 输出 disabled checkbox）
  input: (props) => {
    if (props.type === 'checkbox') {
      return (
        <input
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          className="mr-1.5 align-middle accent-[var(--ref-accent)]"
        />
      )
    }
    return <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
  },
}

// 三处 ReactMarkdown 共用配置（DRY）：remark 插件（含 remarkEntityRef）+ entity: urlTransform + 组件覆盖。
// entityUrlTransform 必需——否则 react-markdown v10 默认会清空 entity: scheme，内联引用 href 变空。
const MD_REMARK_PROPS: Pick<Options, 'remarkPlugins' | 'rehypePlugins' | 'urlTransform' | 'components'> = {
  // remark 插件顺序（语法层 → mdast 转换）：
  //   1. remarkGfm           — 表格 / 任务列表 / 删除线 / autolink
  //   2. remarkMath          — $ / $$ 切成 math / inlineMath 节点（必须在其它 text-aware 插件之前，
  //                              否则 $...$ 会被当普通文本，被 normalizePunct 处理 → 公式炸）
  //   3. remarkEntityRef     — [scheme://x|text] → link
  //   4. remarkNormalizePunct — 智能引号 → ASCII（只 visit 'text'，跳过 code/math）
  //   5. remarkCodeMeta      — fence info string 透传到 hast data-meta
  //   6. remarkCallout       — > [!NOTE] → <aside class="ke-callout-*">
  remarkPlugins: [remarkGfm, remarkMath, remarkEntityRef, remarkNormalizePunct, remarkCodeMeta, remarkCallout],
  // rehype 插件（mdast → hast 之后）：
  //   1. rehypeRaw    — 解析 markdown 里嵌入的 raw HTML（如表格 cell 的 <br>）
  //                     必须排在 rehypeKatex **前面**——math 渲染后会产生大量带 className/MathML 的节点，
  //                     再过一次 raw 解析没意义且可能误判
  //   2. rehypeKatex  — 把 math/inlineMath 节点用 KaTeX 渲染成带 className="katex" 的 HTML
  rehypePlugins: [rehypeRaw, rehypeKatex],
  urlTransform: entityUrlTransform,
  components: MD_COMPONENTS,
}

// ── Markdown 容器 Tailwind 子选择器（DRY，2026-06-02 抽取）──
// 之前三处 ReactMarkdown 各自维护一份巨长的 className，新增/修复样式得改三处。
// 统一：父容器只管"段落、标题、列表、blockquote、行内 code/pre"；
// table 由 MD_COMPONENTS.table 自带样式，**不**写在这里（避免外层 leading-1.7 穿透到单元格）。
//
// 拆两个变体：
// - MD_PROSE_SECTION：用于 hasSections 分支（外层已经设过字号+行高+text-foreground/85），轻量
// - MD_PROSE_STREAM：用于流式分支（无外层包装），含完整的 h1/h2/h3 + code/pre
const MD_PROSE_SECTION =
  '[&_p]:mb-2 [&_p:last-child]:mb-0 ' +
  '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1.5 ' +
  '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1.5 ' +
  '[&_li]:my-0.5 ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ' +
  '[&_hr]:my-4 [&_hr]:border-border'

const MD_PROSE_STREAM =
  'text-[15px] leading-[1.7] text-foreground/85 ' +
  '[&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-2 ' +
  '[&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 ' +
  '[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 ' +
  '[&_p]:mb-2 ' +
  '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] ' +
  '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_pre]:overflow-x-auto ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1.5 ' +
  '[&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1.5 ' +
  '[&_li]:my-0.5 ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ' +
  '[&_hr]:my-4 [&_hr]:border-border'

const SECTION_ICONS: Record<string, string> = {
  overview: '📋',
  entry_point: '🚪',
  call_chain: '🔀',
  db_ops: '💾',
  rules: '⚠️',
  sources: '🔗',
}

const SECTION_TITLES: Record<string, string> = {
  overview: '业务概述',
  entry_point: '入口方法',
  call_chain: '调用链路',
  db_ops: '数据库操作',
  rules: '关键约束',
  sources: '引用源',
}

interface Props {
  message: Message
  streaming?: boolean
  /**
   * v1.5：传了 projectId 才会显示"导出 Word"按钮。
   * 旧调用方（不传）保持向后兼容（不显示按钮）。
   */
  projectId?: string
}

// 用正则匹配 ```mermaid 代码块；`s` 标志让 . 匹配换行
// 捕获 group 1 就是 mermaid 源码
const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g

/**
 * 把 section.content 按 ```mermaid fence 切成段。
 * 返回数组里每条要么是 { type: 'text', value: string }，要么 { type: 'mermaid', value: string }。
 *
 * 举例：
 *   "前文 ```mermaid\nA-->B\n``` 后文"
 *   → [
 *     { type: 'text', value: '前文 ' },
 *     { type: 'mermaid', value: 'A-->B\n' },
 *     { type: 'text', value: ' 后文' },
 *   ]
 */
type ContentChunk = { type: 'text'; value: string } | { type: 'mermaid'; value: string }

function splitMermaidFences(content: string): ContentChunk[] {
  const chunks: ContentChunk[] = []
  let lastIndex = 0
  // 把全局正则重置一下（exec 是有状态的）
  MERMAID_FENCE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MERMAID_FENCE_RE.exec(content)) !== null) {
    // 把上一段非 mermaid 文字塞进去（如果有）
    if (match.index > lastIndex) {
      chunks.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    chunks.push({ type: 'mermaid', value: match[1] })
    lastIndex = match.index + match[0].length
  }
  // 收尾：把尾巴的文字塞进去
  if (lastIndex < content.length) {
    chunks.push({ type: 'text', value: content.slice(lastIndex) })
  }
  // 没匹配到 fence → 整段当 text
  if (chunks.length === 0) {
    chunks.push({ type: 'text', value: content })
  }
  return chunks
}

export function AssistantMessage({
  message,
  streaming = false,
  projectId,
}: Props) {
  const sections = message.sections ?? []
  const hasSections = sections.length > 0
  // 主题：light / dark；mermaid 需要拿来挑 theme
  const theme = useThemeStore(s => s.theme)
  // v1.5 下载按钮的 loading 态（防止用户连点）
  const [exporting, setExporting] = useState(false)
  // agent 引用高亮：message 级激活实体（点击 EntityRef / EntityChip 后同步）
  const [activeEntity, setActiveEntity] = useState<string | null>(null)
  // useMemo 避免每次渲染都产生新对象导致 HighlightCtx.Provider 触发下游重渲染
  const highlightValue = useMemo(() => ({ active: activeEntity, setActive: setActiveEntity }), [activeEntity])

  // ── 流式 markdown 节流（2026-06-02）──
  // 之前 SSE 每个 token 都触发全量 ReactMarkdown reparse（remark + rehype 一整棵），
  // 长答案（>5KB）+ 高速流（>50token/s）时 CPU 飙升、用户感觉卡。
  // useDeferredValue 让 React 把"渲染最新值"标记为低优先级：
  //   - 输入框打字 / 鼠标交互这些高优先级 update 先处理
  //   - 待 idle 时再用最新的 raw_stream 跑 markdown 重渲染
  //   - 用户感觉：高频 token 来时光标 ▌还在跳，但 markdown 内容稍微滞后一帧
  // 不影响最终结果，只是把"中间帧"丢掉一些；体感更顺、CPU 显著降。
  const deferredRawStream = useDeferredValue(message.raw_stream)

  /**
   * 触发下载：调 api 拿 blob 并把它推给浏览器另存为。
   * 失败时 alert 简单提示；v1.6 接 toast 系统。
   */
  const handleExport = async () => {
    // projectId 不存在时按钮根本不会渲染；这里 typescript 保险
    if (!projectId || exporting) return
    setExporting(true)
    try {
      await exportMessageAsDocx({
        projectId,
        sessionId: message.session_id,
        messageId: message.id,
      })
    } catch (e) {
      // 浏览器 alert 是最朴素的错误展示；v1.6 接 toast / Sonner 替换
      // eslint-disable-next-line no-alert
      alert(`导出失败：${(e as Error).message || '未知错误'}`)
    } finally {
      setExporting(false)
    }
  }
  // 是否可以显示导出按钮：传了 projectId + 没在 streaming + 有内容
  const canExport = Boolean(projectId) && !streaming && hasSections

  return (
    <HighlightCtx.Provider value={highlightValue}>
    <div className="my-6 group">
      {/* 头：极小角标 + 思考状态 */}
      <div className="flex items-center gap-1.5 mb-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-semibold">
          K
        </span>
        <span className="font-medium">KE</span>
        {streaming && <span className="ml-1 animate-pulse">正在思考…</span>}
      </div>

      {/* v1.3 ReAct：tool 调用卡片（在答案之前展示，让用户看到 LLM 的"思考过程"）*/}
      {message.tool_calls && Object.keys(message.tool_calls).length > 0 && (
        <div className="mb-3">
          {Object.entries(message.tool_calls).map(([id, tc]) => (
            <ToolCallCard
              key={id}
              starting={tc.starting}
              complete={tc.complete}
            />
          ))}
        </div>
      )}

      {/* agent 推理灰字（C-frontend）*/}
      <ThinkingBlock thinking={message.thinking} streaming={streaming} />

      {/* agent 多步任务 checklist（C-frontend）*/}
      <TodoList todos={message.todos} />

      {/* 内容区：无 border + 平铺 */}
      {hasSections ? (
        <div className="space-y-5 text-[15px] leading-[1.7]">
          {sections.map((s, i) => {
            // 单段（chit-chat 或 agent 自由格式）跳过 h3 段头。
            // 不变量：后端结构化答案至少 2 段（overview + 其它），故"单段"必为自由格式/chit-chat。
            // 若将来后端会发单段的结构化答案，需改此判定。
            const headerless = s.type === 'chit-chat' || sections.length === 1
            const icon = SECTION_ICONS[s.type] ?? '📌'
            const title = s.title || SECTION_TITLES[s.type] || s.type
            // 只对 call_chain 段拆 mermaid；其他段直接当文本（更快、避免误判）
            // 决策见 [[首页设计]] §14 ReAct 落地日志
            const chunks =
              s.type === 'call_chain'
                ? splitMermaidFences(s.content || '')
                : [{ type: 'text' as const, value: s.content || '' }]
            return (
              <div key={i}>
                {/* v1.2: chit-chat / 单段自由格式跳过 h3 header */}
                {!headerless && (
                  <h3 className="font-semibold text-[15px] mb-1.5 text-foreground">
                    {icon} {title}
                  </h3>
                )}
                <div className="text-foreground/85">
                  {chunks.map((chunk, ci) => {
                    if (chunk.type === 'mermaid') {
                      // 渲染 Mermaid 图；传 theme 让它切 light/dark
                      // v1.9.1：lazy 加载 MermaidDiagram；首次渲染时下载 mermaid 库
                      // Suspense fallback 给一个低调的占位（mermaid 一般加载 < 500ms）
                      return (
                        <Suspense
                          key={ci}
                          fallback={
                            <div className="my-3 p-3 rounded-lg bg-card border min-h-[60px] flex items-center justify-center text-[12px] text-muted-foreground">
                              加载图表组件…
                            </div>
                          }
                        >
                          <MermaidDiagram code={chunk.value} theme={theme} />
                        </Suspense>
                      )
                    }
                    // 普通文本：v1.10 改用 ReactMarkdown 渲染，让 fenced code block 走 CodeBlock
                    // 之前 whitespace-pre-wrap 显示原始 ```java 字符串没语法高亮
                    return (
                      <div key={ci} className={MD_PROSE_SECTION}>
                        <ReactMarkdown {...MD_REMARK_PROPS}>
                          {chunk.value}
                        </ReactMarkdown>
                      </div>
                    )
                  })}
                  {streaming && i === sections.length - 1 && (
                    <span className="ml-0.5 animate-pulse">▌</span>
                  )}
                </div>
                {s.references && s.references.length > 0 && (
                  // section 底部引用来源列表：每个 reference 渲成可点击的 EntityChip，
                  // 点击直接打开对应实体的代码片段查看器抽屉（不再只是纯文本 span）
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.references.map((r, j) => (
                      // EntityChip：entityId 用 r.entity_id（唯一实体标识），点击 → openEntity
                      // EntityChip 已在文件顶部 import，此处直接使用
                      <EntityChip key={j} entityId={r.entity_id} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : streaming && message.raw_stream ? (
        // v1.6 token 流 + v1.8 markdown + v1.9 JSON 折叠
        // 当 raw_stream 是 ```json fenced 输出时（LLM 在生成结构化答案），
        // 折叠 JSON wrapper，只展示 sections.content 部分
        //
        // 2026-06-02：渲染用 deferredRawStream（React 18 useDeferredValue），
        // 流式高频 token 时 markdown reparse 走低优先级，CPU 不再被打满。
        // 注意：外层条件守卫仍用 message.raw_stream（最新值），保证 streaming UI 一收到第一个
        // token 就显示；deferredRawStream 只决定内部 markdown 渲染版本。
        (() => {
          const raw = deferredRawStream ?? ''
          const sectionContents = extractSectionContents(raw)
          const isJsonStream = raw.includes('```json')

          // ── 分支 1：流式 JSON 模式 → 折叠展示 section content ──
          if (isJsonStream) {
            return (
              <div className={MD_PROSE_STREAM}>
                {sectionContents.length === 0 ? (
                  // 还没流出第一段 content → 给个友好占位
                  <div className="text-[13px] text-muted-foreground italic">
                    正在生成结构化答案…
                  </div>
                ) : (
                  // 把已经完整的 content 拼起来，用 markdown 渲染
                  // 段间用 "\n\n---\n\n" 分隔，模拟原答案的段落感
                  // v1.10: components={MD_COMPONENTS} 让流式代码块也走 CodeBlock 语法高亮
                  <ReactMarkdown {...MD_REMARK_PROPS}>
                    {sectionContents.join('\n\n---\n\n')}
                  </ReactMarkdown>
                )}
                <span className="ml-0.5 animate-pulse">▌</span>
              </div>
            )
          }

          // ── 分支 2：普通 markdown raw stream（如纯文本 chat）──
          return (
            <div className={MD_PROSE_STREAM}>
              {/* v1.10: components={MD_COMPONENTS} 让代码块走 CodeBlock 语法高亮 */}
              {/* 用 deferredRawStream（低优先级）—— 高频 token 时不阻塞 UI */}
              <ReactMarkdown {...MD_REMARK_PROPS}>
                {raw}
              </ReactMarkdown>
              <span className="ml-0.5 animate-pulse">▌</span>
            </div>
          )
        })()
      ) : (
        <div className="text-[15px] leading-[1.7] whitespace-pre-wrap text-foreground/85">
          {message.content || (streaming ? '…' : '(空回答)')}
          {streaming && <span className="ml-0.5 animate-pulse">▌</span>}
        </div>
      )}

      {/* agent 引用溯源 chips（C-frontend，message 级，常驻可见）*/}
      {message.metadata?.cited_entities && message.metadata.cited_entities.length > 0 && (
        <div role="group" aria-label="本答案引用实体" className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">本答案引用：</span>
          {message.metadata.cited_entities.map((id) => (
            <EntityChip key={id} entityId={id} />
          ))}
        </div>
      )}

      {/* metadata + 导出按钮：极淡的小字，hover 时整行可见 */}
      {!streaming && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <div>
            {message.metadata && message.metadata.latency_ms > 0 &&
              `${(message.metadata.latency_ms / 1000).toFixed(1)}s`}
            {message.metadata && message.metadata.token_usage > 0 &&
              ` · ${message.metadata.token_usage} tokens`}
          </div>
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              // aria-label 测试通过它定位按钮
              aria-label="导出为 Word"
              title="导出为 Word (.docx)"
              className="
                flex items-center gap-1 px-2 py-1 rounded
                text-foreground/70 hover:text-foreground hover:bg-muted
                transition-colors
                disabled:opacity-50 disabled:cursor-wait
              "
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exporting ? '生成中…' : '导出 Word'}</span>
            </button>
          )}
        </div>
      )}
    </div>
    </HighlightCtx.Provider>
  )
}
