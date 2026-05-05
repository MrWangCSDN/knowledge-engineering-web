/**
 * src/components/auth/BrandPanel.tsx
 *
 * 登录页左侧 brand 区（Layout B — 双列分栏）
 *
 * ── 设计 ────────────────────────────────────────────────────────────────────────
 *   极简主义的 horizontal lockup（横向品牌组合）：
 *     ┌─────────────────────────────────────────┐
 *     │   [logo]  Knowledge Engineering         │  ← 上方固定
 *     │                                         │
 *     │       （panel 其余空间留白）              │
 *     │                                         │
 *     └─────────────────────────────────────────┘
 *   Logo（图标）+ 品牌名文字 横向并排，整个组合靠上对齐，下方留白。
 *   文字使用 .brand-text-glow（蓝图/霓虹风），与 logo 整体配合呈现"代码工程"科技感。
 *
 * ── 响应式行为 ──────────────────────────────────────────────────────────────────
 *   ≥ 1024px（Tailwind 的 lg 断点）：占左侧 50% 宽度，min-h-screen
 *   < 1024px：折叠为顶部精简横条（min-h-[180px]）
 *
 * ── 关于颜色 ─────────────────────────────────────────────────────────────────────
 *   --brand-panel-bg：#0c1925（深海军蓝，与 logo 背景同色）
 *   --brand-panel-fg：纯白（暂未使用，备用）
 *   --brand-cyan    ：#22c8d0（品牌主色，从 logo 自动取色）
 *   "永远深色"：light / dark 主题切换不影响 brand 面板
 */

export function BrandPanel() {
  return (
    // ── <aside> 根容器 ──────────────────────────────────────────────────────────
    // 关键 Tailwind 类：
    //   relative          → position: relative（备用，pseudo-element 定位时用）
    //   flex flex-col     → 子元素纵向排列
    //   items-start       → 交叉轴（水平）左对齐 — 让 lockup 靠左
    //   bg-[var(...)]     → 背景色用 CSS 变量
    //   text-[var(...)]   → 文字色用 CSS 变量（备用）
    //   w-full lg:w-1/2   → 移动端占满，桌面占一半
    //   min-h-[180px] lg:min-h-screen → 移动横条 180px / 桌面满屏
    //   p-8 lg:p-16       → 内边距：移动 32px / 桌面 64px
    <aside
      className="
        relative flex flex-col items-start
        bg-[var(--brand-panel-bg)] text-[var(--brand-panel-fg)]
        w-full lg:w-1/2
        min-h-[180px] lg:min-h-screen
        p-8 lg:p-16
      "
    >
      {/* ── Horizontal Lockup：logo 图标 + 品牌名文字 ─────────────────────────────
        flex 容器实现"图标左 + 文字右"的水平品牌组合：
          flex          → 横向排列
          items-center  → 子元素垂直居中（让 logo 与文字基线/中线对齐）
          gap-3 lg:gap-5 → 元素间距：移动 12px / 桌面 20px
      */}
      <div className="flex items-center gap-3 lg:gap-5">
        {/* ── LOGO 图标 ────────────────────────────────────────────────────────
          src             → /logo.png（裁剪过的 600×600 方形图标）
          alt             → 屏幕阅读器 + 加载失败 fallback
          draggable={false} → 禁止拖动（避免登录页误操作）
          h-12 lg:h-20    → 高度：移动 48px / 桌面 80px
          w-auto          → 宽度按 1:1 等比缩放
          select-none     → 禁止文本框选
        */}
        <img
          src="/logo.png"
          alt="Knowledge Engineering Logo"
          draggable={false}
          className="h-12 lg:h-20 w-auto select-none"
        />

        {/* ── 品牌名称（蓝图风格）──────────────────────────────────────────────
          重要：data-text 属性 — .brand-text-glow 的 ::before / ::after 用它取文字内容。
                必须和 <h1> 内文字完全一致，否则 ghost 副本会显示错的字。

          className 解释：
            brand-text-glow      → 全局 CSS 类（详见 src/index.css）：
                                    青色实心 + 多层光晕 + 两层轮廓 ghost 副本
            text-xl lg:text-3xl  → 字号：移动 20px / 桌面 30px
            font-semibold        → 字重 600（半粗）
            tracking-wider       → 字间距 0.05em（科技感拉宽）
            whitespace-nowrap    → 禁止换行（避免响应式断行造成不雅观）
        */}
        <h1
          className="brand-text-glow text-xl lg:text-3xl font-semibold tracking-wider whitespace-nowrap"
          data-text="Knowledge Engineering"
        >
          Knowledge Engineering
        </h1>
      </div>
    </aside>
  )
}
