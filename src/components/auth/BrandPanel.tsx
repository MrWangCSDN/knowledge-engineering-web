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

/**
 * Props
 *   onImageLoad: 每张关键图加载完成时回调一次（共 3 张：logo / brand-text / skyline）
 *                由父组件 LoginPage 统一计数，达到 3 后整页一起淡入。
 *                Optional：未传时也能正常渲染（向后兼容）。
 */
interface BrandPanelProps {
  onImageLoad?: () => void
}

export function BrandPanel({ onImageLoad }: BrandPanelProps) {
  return (
    <aside
      className="
        relative flex flex-col items-center overflow-hidden
        bg-[var(--brand-panel-bg)] text-[var(--brand-panel-fg)]
        w-full lg:w-[45%] flex-shrink-0
        min-h-[200px] p-8 lg:p-12
      "
    >
      {/* ── 点阵背景 ── */}
      <div
        className="brand-bg-layer pointer-events-none select-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(34,200,208,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 70% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 70% 50%, black 30%, transparent 100%)',
        }}
      />

      {/* ── 波纹涟漪层（从面板中心偏右下发散） ── */}
      <div className="brand-bg-layer pointer-events-none select-none absolute inset-0" aria-hidden>
        {[0, 0.8, 1.6, 2.4, 3.2].map((delay) => (
          <span
            key={delay}
            className="brand-ripple"
            style={{
              width: 220, height: 220,
              top: '55%', left: '62%',
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── 城市天际线照片（裁掉天空段，只显示楼宇） ──
        关键：5.jpg 上半是亮蓝天空，与 panel 深蓝直接拼接会产生色差带。
        解决：用容器+ object-cover object-bottom，只显示图片底部 50% 范围（楼宇区）。
        - 容器高度 50%：限制图只占下半部
        - img object-cover + object-bottom：图片按比例填充并锚定底部，裁掉天空
        - 顶部 mask 渐隐：消除剩余的水平接缝
        - opacity-40：让 panel 底色透上来 */}
      <div
        className="brand-bg-layer pointer-events-none select-none absolute bottom-0 left-0 w-full overflow-hidden"
        aria-hidden
        style={{
          height: '50%',
          maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 25%, black 55%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 25%, black 55%)',
        }}
      >
        <img
          src="/skyline.jpg"
          alt=""
          draggable={false}
          onLoad={onImageLoad}
          className="absolute inset-0 w-full h-full object-cover object-bottom opacity-40"
        />
      </div>
      {/* ── Horizontal Lockup：logo 图标 + 品牌名文字 ─────────────────────────────
        flex 容器实现"图标左 + 文字右"的水平品牌组合：
          flex          → 横向排列
          items-center  → 子元素垂直居中（让 logo 与文字基线/中线对齐）
          gap-3 lg:gap-5 → 元素间距：移动 12px / 桌面 20px
      */}
      <div className="flex items-center gap-3 lg:gap-5">
        <img
          src="/logo.png"
          alt="Knowledge Engineering Logo"
          draggable={false}
          className="h-12 lg:h-25 w-auto select-none"
          onLoad={onImageLoad}
        />
        <img
          src="/brand-text.png"
          alt="Knowledge Engineering"
          draggable={false}
          className="h-12 lg:h-25 w-auto select-none mix-blend-lighten"
          onLoad={onImageLoad}
        />
      </div>

      <p className="mt-4 lg:mt-1 lg:ml-1 text-sm lg:text-[2.05rem] font-semibold tracking-tight text-white select-none inline-block bg-white/8 backdrop-blur-sm px-4 lg:px-6 py-1 lg:py-2 rounded-lg">
        企业级 代码知识工程
      </p>

      {/* 价值主张句：字号退一级、字重轻、品牌青色半透明，与主副标形成层级 */}
      <p className="mt-3 lg:mt-4 text-xs lg:text-lg font-light tracking-[0.15em] text-[var(--brand-cyan)] opacity-70 select-none">
        —让代码成为企业资产
      </p>

    </aside>
  )
}
