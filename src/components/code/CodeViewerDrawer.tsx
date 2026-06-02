// src/components/code/CodeViewerDrawer.tsx
// 右侧代码片段抽屉：Tab 栏（多实体）+ 主区 Monaco 片段 + callers 侧栏（反向跳转）。
// 设计 [[代码片段查看器-设计]] §5。颜色走 token、light/dark 双达标。
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'  // useRef 存拖拽起点（不触发重渲染）；ReactPointerEvent 是 React 合成指针事件类型
import { useCodeViewerStore } from '@/store/codeViewer'   // Zustand store：读取抽屉状态 + actions
import { useThemeStore } from '@/store/theme'              // 全局主题 store：'light' | 'dark'
import { MonacoSnippet } from './MonacoSnippet'            // Monaco 代码片段渲染组件

/**
 * 将实体 id 转成抽屉 Tab 上展示的短名。
 * 例：'com.example.OrderService::create#(OrderDTO)' → 'create'
 *
 * @param entityId - 完整实体 id（格式 ClassName::method#(params)）
 * @returns 方法名短名；解析失败时返回原字符串
 */
function shortName(entityId: string): string {
  // split('#')[0] 去掉参数签名（如 '#(int, String)'），只保留 ClassName::method 部分
  const head = entityId.split('#')[0]
  // split('::').pop() 取最后一段，即方法名；'||' 兜底防空字符串
  return head.split('::').pop() || head
}

/**
 * CodeViewerDrawer — 代码片段查看抽屉。
 *
 * - open=false 时直接返回 null，不渲染 DOM（避免闪烁）
 * - open=true 时渲染固定定位的右侧抽屉，包含：
 *   1. 顶栏（标题 + 关闭按钮）
 *   2. Tab 栏（多实体 tab，可切换 / 关闭）
 *   3. 主区：Monaco 代码片段（左）+ callers 侧栏（右，可选）
 *
 * 所有颜色走 Tailwind token（bg-background / border-border / text-foreground
 * / text-muted-foreground / bg-muted / var(--ref-accent)），不硬编码裸色值。
 */
export function CodeViewerDrawer() {
  // 从 Zustand store 逐个选取所需状态 + actions，避免订阅整个 store 引发不必要重渲染
  const open         = useCodeViewerStore(s => s.open)           // 抽屉是否打开
  const tabs         = useCodeViewerStore(s => s.tabs)           // 已打开的 tab 列表
  const activeEntityId = useCodeViewerStore(s => s.activeEntityId) // 当前激活实体 id
  const switchTab    = useCodeViewerStore(s => s.switchTab)      // 切换 tab action
  const closeTab     = useCodeViewerStore(s => s.closeTab)       // 关闭单个 tab action
  const close        = useCodeViewerStore(s => s.close)          // 收起抽屉 action
  const openEntity   = useCodeViewerStore(s => s.openEntity)     // 打开新实体 tab action（callers 跳转用）
  const width        = useCodeViewerStore(s => s.width)          // 面板宽度（px）：分隔条拖拽调整
  const setWidth     = useCodeViewerStore(s => s.setWidth)       // 设置面板宽度 action

  // useThemeStore 选择器：只订阅 theme 字段，用于传递给 MonacoSnippet
  const theme = useThemeStore(s => s.theme) as 'light' | 'dark'

  // 关闭态：不渲染任何 DOM，防止页面有多余的占位节点
  if (!open) return null

  // 在 tabs 中找到激活的 tab 对象；找不到则为 null（防御性处理）
  const active = tabs.find(t => t.entityId === activeEntityId) ?? null

  return (
    // Fragment：返回「分隔条 + 面板」两个并排的 flex 子节点（由 AppLayout 挂在根 flex 行）
    <>
      {/* 分隔条：拖拽调节面板宽度（手柄在面板左侧，向左拖 = 面板变宽）*/}
      <ResizeHandle width={width} setWidth={setWidth} />

      {/* aside：停靠式代码面板，宽度由 store.width 控制（可拖拽）。
          作为 <main> 的 flex 兄弟节点 → 主区收窄、面板并排 = 真分屏（非 fixed 浮层）。
          shrink-0 防止被主区压缩；颜色走 token（border-border/bg-background），light/dark 双达标。 */}
      <aside
        style={{ width }}
        className="flex h-full shrink-0 flex-col border-l border-border bg-background"
      >

      {/* ── 顶栏：标题 + 关闭按钮 ─────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        {/* 标题文字，颜色走 text-foreground token（light/dark 双档）*/}
        <span className="text-sm font-medium text-foreground">代码片段</span>

        {/* 关闭按钮：aria-label 用于无障碍；hover 态用 bg-muted（token）*/}
        <button
          type="button"
          onClick={close}
          aria-label="关闭"
          className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>

      {/* ── Tab 栏：水平滚动，显示所有已打开的 tab ─────────────────── */}
      {/* overflow-x-auto：内容超出时横向滚动，不换行 */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1">
        {tabs.map(t => (
          // 每个 tab：激活态用 bg-muted/text-foreground，非激活态用 text-muted-foreground
          // 颜色均走 token，不写裸色值
          <div
            key={t.entityId}
            className={[
              'flex items-center gap-1 rounded px-2 py-1 text-[12.5px] cursor-pointer',
              t.entityId === activeEntityId
                ? 'bg-muted text-foreground'                  // 激活：稍深背景 + 前景色文字
                : 'text-muted-foreground hover:bg-muted/60', // 非激活：次级文字 + hover 悬停
            ].join(' ')}
            onClick={() => switchTab(t.entityId)}             // 点击 tab 区域切换激活
            title={t.entityId}                                // tooltip 显示完整 entityId
          >
            {/* 短名展示（方法名），不显示类名和参数列表，节省 Tab 栏宽度 */}
            <span>{shortName(t.entityId)}</span>

            {/* 关闭按钮：e.stopPropagation() 防止冒泡到 div.onClick（避免触发 switchTab）*/}
            <button
              type="button"
              aria-label="关闭标签"
              onClick={(e) => { e.stopPropagation(); closeTab(t.entityId) }}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* ── Status bar（v1.13）：文件路径 + 行号范围 + 大文件提示 ──────────── */}
      {/* 整文件视图时显示 "src/.../X.java · Line 45-52 (create)"，让用户知道当前定位 */}
      {/* 超大文件（file_content=null + file_size_bytes>0）显示告警，提示"仅方法片段" */}
      {active?.snippet && (
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
          {/* 文件相对路径；truncate 让长路径省略号；hover title 看完整 */}
          <span className="truncate font-mono" title={active.snippet.file_path}>
            {active.snippet.file_path}
          </span>
          <span className="shrink-0 opacity-60">·</span>
          {/* 行号范围 —— 用 en-dash – 视觉对齐 */}
          <span className="shrink-0">
            Line {active.snippet.start_line}–{active.snippet.end_line}
          </span>
          <span className="shrink-0 opacity-60">·</span>
          {/* 方法短名（与 Tab 同款 shortName 算法）*/}
          <span className="shrink-0 font-medium text-foreground/70">
            {shortName(active.snippet.entity_id)}
          </span>
          {/* 超大文件回退提示：file_content 为 null 但 file_size_bytes 真实 → 走方法片段了 */}
          {!active.snippet.file_content && active.snippet.file_size_bytes > 0 && (
            <>
              <span className="shrink-0 opacity-60">·</span>
              <span className="shrink-0 text-[var(--status-progress)]">
                文件 {Math.round(active.snippet.file_size_bytes / 1024)} KB，仅显示方法片段
              </span>
            </>
          )}
        </div>
      )}

      {/* ── 主区：Monaco 片段（flex-1 撑满）+ callers 侧栏（条件渲染）── */}
      {/* min-h-0 重要：flex 子元素默认 min-height: auto，不加此类高度无法正确收缩 */}
      <div className="flex min-h-0 flex-1">

        {/* Monaco 代码片段区：flex-1 占满剩余宽度；min-h-0 同上 */}
        <div className="min-h-0 flex-1">
          {/* MonacoSnippet 接受 snippet/loading/error/theme，对应激活 tab 数据 */}
          <MonacoSnippet
            snippet={active?.snippet ?? null}   // 可选链：active 为 null 时取 null
            loading={active?.loading}           // undefined → MonacoSnippet 默认 false
            error={active?.error}               // undefined → MonacoSnippet 默认 null
            theme={theme}                        // 传递主题（light/dark）给 Monaco 样式
          />
        </div>

        {/* callers 侧栏：仅当激活 tab 有 callers 数据时渲染 */}
        {/* ?.length 安全访问数组长度；为 0 / null / undefined 时不渲染 */}
        {active?.snippet?.callers?.length ? (
          // w-48 = 12rem 固定宽度；shrink-0 阻止 flex 压缩；border-l 左分隔线（token）
          <div className="w-48 shrink-0 overflow-y-auto border-l border-border p-2">
            {/* 侧栏标题：uppercase 小型大写字母，muted 次级颜色 */}
            <div className="mb-1 text-[11px] uppercase text-muted-foreground">
              被调用方 (callers)
            </div>

            {/* 遍历 callers 列表，每个 caller 渲染为可点击按钮 */}
            {active.snippet.callers.map(c => (
              <button
                key={c.entity_id}
                type="button"
                // void 处理 openEntity 返回的 Promise，防止 lint 警告（react-hooks/exhaustive-deps）
                onClick={() => void openEntity(c.entity_id)}
                title={c.entity_id}               // tooltip 显示完整 entityId
                // text-[var(--ref-accent)]：走 CSS 变量，已在 global.css 中定义 light/dark 双档
                // hover:bg-[var(--ref-accent)]/10：10% 透明度 accent 背景色作为 hover 反馈
                className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[12px] text-[var(--ref-accent)] hover:bg-[var(--ref-accent)]/10"
              >
                {/* 展示调用方的 name（短名），完整 id 在 title 中 */}
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

      </div>
      </aside>
    </>
  )
}

/**
 * ResizeHandle — 分隔条，拖拽调节右侧代码面板宽度。
 *
 * 交互：在手柄上按下并左右拖动 → 实时 setWidth。手柄位于面板左侧，
 * 向左拖（指针 X 变小）= 面板变宽，故 newWidth = 起始宽度 + (起始X − 当前X)。
 *
 * 用 Pointer Events（统一鼠标/触控）+ setPointerCapture：按下后即使指针移出手柄，
 * move/up 仍回传到手柄，拖拽不会中断（比 mousemove 监听 window 更省心、自动随元素卸载清理）。
 */
function ResizeHandle({ width, setWidth }: { width: number; setWidth: (w: number) => void }) {
  // useRef 存拖拽起点 { startX, startW }；非拖拽态为 null。用 ref 而非 state：拖拽中频繁变化不该触发重渲染
  const drag = useRef<{ startX: number; startW: number } | null>(null)

  // 按下：记录起点 + 捕获指针 + 锁定全局光标/选区
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startW: width }      // 记录起始 X 与起始宽度
    e.currentTarget.setPointerCapture(e.pointerId)           // 捕获：后续 move/up 锁定到本元素
    document.body.style.cursor = 'col-resize'                // 拖拽期全局光标统一为左右箭头
    document.body.style.userSelect = 'none'                  // 禁用文本选择，避免拖拽误选 Monaco 文字
  }

  // 移动：仅在拖拽态（drag.current 非空）按位移计算新宽度
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return                                           // 未按下：忽略移动
    const next = d.startW + (d.startX - e.clientX)           // 向左拖 → 变宽
    const max = window.innerWidth - 360                      // 运行时按视口再夹：主区至少留 360px，避免面板把内容挤没
    setWidth(Math.min(next, max))                            // store.setWidth 内部还会夹 [WIDTH_MIN, WIDTH_MAX]
  }

  // 结束拖拽（抬起 / 取消）：清起点 + 还原全局光标与选区
  const endDrag = () => {
    drag.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return (
    // role/aria：无障碍语义（垂直分隔条，可调整大小）。
    // 6px 命中区 + 居中 1px 发丝线；hover/拖拽用 --ref-accent 高亮（token，light/dark 双档，与既有 callers 链接同色系）。
    // group 让内部发丝线能响应外层 hover。
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖拽调整代码面板宽度"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="group relative w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--ref-accent)]/20"
    >
      {/* 居中发丝线：默认 border 色，hover 时变 accent，给出"此处可拖拽"的视觉暗示。
          pointer-events-none 让它不拦截指针事件（事件统一由外层 div 处理）。 */}
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-[var(--ref-accent)]" />
    </div>
  )
}
