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

import {
  Cpu, Terminal, GitBranch, Database, Network,
  Braces, FileCode2, Server, Layers, Workflow,
} from 'lucide-react'

export function BrandPanel() {
  return (
    <aside
      className="
        relative flex flex-col items-center overflow-hidden
        bg-[var(--brand-panel-bg)] text-[var(--brand-panel-fg)]
        w-full lg:w-1/2
        min-h-[180px] lg:min-h-screen
        p-8 lg:p-16
      "
    >
      {/* ── 点阵背景 ── */}
      <div
        className="pointer-events-none select-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(34,200,208,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 70% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 70% 50%, black 30%, transparent 100%)',
        }}
      />

      {/* ── 波纹涟漪层（从面板中心偏右下发散） ── */}
      <div className="pointer-events-none select-none absolute inset-0" aria-hidden>
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

      {/* ── 科技感背景图标层（pointer-events-none 避免遮挡交互） ── */}
      <div className="pointer-events-none select-none absolute inset-0" aria-hidden>
        <Cpu        className="absolute top-[8%]   right-[12%] w-28 h-28 text-[var(--brand-cyan)] opacity-[0.07] rotate-12" />
        <Terminal   className="absolute top-[22%]  right-[5%]  w-20 h-20 text-[var(--brand-cyan)] opacity-[0.06] -rotate-6" />
        <Braces     className="absolute top-[38%]  right-[18%] w-24 h-24 text-white              opacity-[0.05] rotate-3" />
        <GitBranch  className="absolute top-[55%]  right-[8%]  w-32 h-32 text-[var(--brand-cyan)] opacity-[0.07] rotate-6" />
        <Network    className="absolute top-[70%]  right-[20%] w-20 h-20 text-white              opacity-[0.05] -rotate-12" />
        <Database   className="absolute bottom-[8%] right-[10%] w-24 h-24 text-[var(--brand-cyan)] opacity-[0.06] rotate-6" />
        <FileCode2  className="absolute top-[15%]  left-[55%]  w-16 h-16 text-white              opacity-[0.04] rotate-12" />
        <Server     className="absolute bottom-[22%] left-[60%] w-20 h-20 text-[var(--brand-cyan)] opacity-[0.05] -rotate-3" />
        <Layers     className="absolute bottom-[40%] right-[3%] w-16 h-16 text-white              opacity-[0.04] rotate-6" />
        <Workflow   className="absolute bottom-[5%]  left-[40%] w-28 h-28 text-[var(--brand-cyan)] opacity-[0.06] -rotate-6" />
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
          className="h-12 lg:h-36 w-auto select-none"
        />
        <img
          src="/brand-text.png"
          alt="Knowledge Engineering"
          draggable={false}
          className="h-12 lg:h-36 w-auto select-none mix-blend-lighten"
        />
      </div>

      <p className="mt-4 lg:mt-1 lg:ml-1 text-sm lg:text-[3.05rem] font-semibold tracking-tight text-white select-none inline-block bg-white/8 backdrop-blur-sm px-4 lg:px-6 py-1 lg:py-2 rounded-lg">
        企业级 代码知识工程
      </p>

      {/* 价值主张句：字号退一级、字重轻、品牌青色半透明，与主副标形成层级 */}
      <p className="mt-3 lg:mt-4 text-xs lg:text-lg font-light tracking-[0.15em] text-[var(--brand-cyan)] opacity-70 select-none">
        —让代码成为企业资产
      </p>

      {/* ── 底部版权栏：mt-auto 将其推到 aside 底部 ── */}
      <footer className="mt-auto pt-8 w-full flex flex-col gap-1 items-center border-t border-white/10">
        <div className="flex items-center gap-4 text-xs text-white/35">
          <a
            href="https://gwzx.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white/70 transition-colors duration-200"
          >
            法律声明
          </a>
          <span className="text-white/20">·</span>
          <a
            href="/privacy"
            className="hover:text-white/70 transition-colors duration-200"
          >
            隐私政策
          </a>
          <span className="text-white/20">·</span>
          <a
            href="mailto:contact@gwzx.com"
            className="hover:text-white/70 transition-colors duration-200"
          >
            联系我们
          </a>
          <span className="text-white/20">·</span>
          <a
            href="mailto:hr@gwzx.com"
            className="hover:text-white/70 transition-colors duration-200"
          >
            加入我们
          </a>
        </div>
        <p className="text-xs text-white/25 select-none">
          © gwzx.com 上海感物知行科技有限公司版权所有
        </p>
      </footer>
    </aside>
  )
}
