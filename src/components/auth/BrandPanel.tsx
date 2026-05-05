/**
 * src/components/auth/BrandPanel.tsx
 *
 * 登录页左侧 brand 区（Layout B — 双列分栏）
 *
 * ── 设计 ────────────────────────────────────────────────────────────────────────
 *   极简主义：只显示 logo 图标 + "Knowledge Engineering" 标题，居中。
 *   不放产品介绍 / 核心能力 / 版本号 — 让登录页保持干净专注。
 *
 * ── 响应式行为 ──────────────────────────────────────────────────────────────────
 *   ≥ 1024px（Tailwind 的 lg 断点）：占左侧 50% 宽度，全屏高度
 *   < 1024px：折叠为顶部精简横条（min-h-[180px]）
 *
 * ── 关于 <aside> ────────────────────────────────────────────────────────────────
 *   aside 是 HTML5 语义化标签，表示"与主内容相关、但相对独立的侧边补充内容"。
 *   视觉上和 <div> 完全相同，但对屏幕阅读器（NVDA / VoiceOver）和 SEO 爬虫更友好。
 *
 * ── 关于颜色 ─────────────────────────────────────────────────────────────────────
 *   全局工程规则：禁止硬编码颜色值。所有颜色走 CSS 变量（token → var(--xxx)）。
 *
 *   --brand-panel-bg：#0c1925（深海军蓝）— 与 public/logo.png 背景色完全一致，
 *     让 logo 与 panel 无缝融合（无可见的图片矩形边界）。
 *   --brand-panel-fg：纯白 — 标题文字
 *
 *   "永远深色"是有意识的设计选择（Sourcegraph / GitLab / Vercel 登录页同款），
 *   light / dark 主题切换不影响 brand 面板，加强品牌识别度。
 */

// ── 组件定义 ──────────────────────────────────────────────────────────────────────
// export function BrandPanel()：
//   - export：导出函数，让其他模块 import { BrandPanel } from './BrandPanel'
//   - React 函数组件（Function Component）：返回 JSX，React 渲染成真实 DOM
//   - 这个组件没有 props（不接受外部传参），因为 brand 内容是固定的
export function BrandPanel() {
  return (
    // ── <aside> 根容器 ──────────────────────────────────────────────────────────
    // Tailwind 类逐行解释：
    //   relative           → position: relative（虽然这里没有绝对定位的子元素，但保留语义）
    //   flex flex-col      → display:flex, 主轴纵向（logo 上、文字下）
    //   items-center       → align-items: center（交叉轴/水平居中）
    //   justify-center     → justify-content: center（主轴/垂直居中）—— 整组内容垂直居中
    //   bg-[var(--brand-panel-bg)]  → 背景用 #0c1925（与 logo 背景同色，无缝融合）
    //   text-[var(--brand-panel-fg)] → 文字用纯白
    //   w-full lg:w-1/2    → 移动端占满宽度；桌面占左侧 50%
    //   min-h-[180px]      → 移动端最小 180px 高（顶部横条）
    //   lg:min-h-screen    → 桌面端最小 100vh（撑满整个视口高度）
    //   p-8 lg:p-16        → 内边距：移动 32px / 桌面 64px
    //   gap-4 lg:gap-6     → flex 子元素之间的间距（logo 和 文字之间）
    <aside
      className="
        relative flex flex-col items-center justify-center
        bg-[var(--brand-panel-bg)] text-[var(--brand-panel-fg)]
        w-full lg:w-1/2
        min-h-[180px] lg:min-h-screen
        p-8 lg:p-16
        gap-4 lg:gap-6
      "
    >
      {/* ── LOGO 图标 ────────────────────────────────────────────────────────────
        public/logo.png 是裁剪过的方形 PNG（600×600），背景色与 panel 完全一致。
        因此即使 panel 比图片大很多，也看不出图片的"矩形边界"。

        关于 <img> 属性：
          src         →  /logo.png（Vite 把 public/* 发布到根 URL）
          alt         →  屏幕阅读器读出 + 图片加载失败时显示
          draggable   →  禁掉拖动（避免登录页误操作）
          className   →
            h-24 lg:h-40  →  移动端 96px / 桌面端 160px 高
            w-auto        →  宽度按 1:1 等比缩放（不变形 → 永远是正方形）
            select-none   →  禁止文本框选
      */}
      <img
        src="/logo.png"
        alt="Knowledge Engineering Logo"
        draggable={false}
        className="h-24 lg:h-40 w-auto select-none"
      />

      {/* ── 品牌名称 ─────────────────────────────────────────────────────────────
        用 CSS 文字渲染（而不是图片里的文字），更灵活、更清晰、可缩放。

        text-2xl lg:text-3xl  →  字号 1.5rem (24px) / 桌面 1.875rem (30px)
        font-semibold         →  字重 600（半粗体）
        tracking-wide         →  字间距 0.025em（稍微宽松，配合大字号好看）
        text-center           →  文字居中（已经在 flex 容器里居中，这条额外保险）
      */}
      <h1 className="text-2xl lg:text-3xl font-semibold tracking-wide text-center">
        Knowledge Engineering
      </h1>
    </aside>
  )
}
