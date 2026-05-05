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

        {/* ── 品牌名称（直接用 logo 设计稿 2.png 中的文字图）─────────────────────
          为保证"1:1 还原"原始设计稿的霓虹/蓝图视觉效果（CSS 模拟有差距），
          这里直接把设计图 2.png 中的文字部分裁剪后作为图片使用。

          public/brand-text.png：从 logo 设计图 2.png 自动裁剪出的文字区域
            尺寸 1802×738（aspect ~2.44:1）
            原图背景色 #011226（比 panel 的 #0c1925 略深略蓝）
            → 用 mix-blend-mode: lighten 让深色背景与 panel 融合

          关于 mix-blend-mode: lighten：
            CSS 混合模式之一，逐像素取 src 与 dst 的较亮值（max(src, dst)）
            原理：暗像素被"忽略"，亮像素照常显示
            效果：图片的深色背景被 panel 背景"覆盖"（亮度更高），矩形边界消失
            而文字的亮青色像素本来就比两种背景都亮 → 完整显示

          h-12 lg:h-20  →  高度移动 48px / 桌面 80px（与 logo 同高）
          w-auto        →  按 1802:738 比例自动算宽（≈ 117px / 195px）
          select-none   →  禁止文本框选
          mix-blend-lighten →  Tailwind 4 的混合模式工具类（= mix-blend-mode: lighten）

          ⚠️ 无障碍：alt 必须是 "Knowledge Engineering" 字符串，
                    因为屏幕阅读器读不出图片中的文字
        */}
        <img
          src="/brand-text.png"
          alt="Knowledge Engineering"
          draggable={false}
          className="h-12 lg:h-20 w-auto select-none mix-blend-lighten"
        />
      </div>
    </aside>
  )
}
