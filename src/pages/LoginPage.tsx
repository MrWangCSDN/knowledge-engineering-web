import { BrandPanel } from '@/components/auth/BrandPanel'
import { LoginForm } from '@/components/auth/LoginForm'
import {
  Code2, Boxes, Cpu, GitMerge, Binary, FunctionSquare,
  Hash, Brackets, Cog, Sparkles, FileJson, Atom,
  // 图谱：网络节点 / 流程拓扑 / 路径航点
  Network, Workflow, Waypoints,
  // 链路：链接 / 线缆 / 分叉路由
  Link2, Cable, Route,
  // 资产：宝石 / 钱包 / 资产包
  Gem, Wallet, Package,
  // 知识：开卷 / 灵感 / 大脑
  BookOpen, Lightbulb, Brain,
} from 'lucide-react'

export function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-amber-50 p-4 lg:p-8 overflow-hidden">

      {/* ── 装饰性背景图标层（位于卡片下方，pointer-events-none 不挡交互）──
        图标分四类主题对应 "代码知识工程" 的核心概念：
          🌐 图谱 (Network/Workflow/Waypoints)
          🔗 链路 (Link2/Cable/Route)
          💎 资产 (Gem/Wallet/Package)
          📖 知识 (BookOpen/Lightbulb/Brain)
        + 原有的代码主题图标（Code/Cpu/Boxes…）作底色
        每个图标随机配 float / drift / pulse 三种动画 + 错开 animationDelay。 */}
      <div className="pointer-events-none select-none absolute inset-0" aria-hidden>
        {/* ─── 左上区域 ─── */}
        <Code2          className="icon-float absolute top-[6%]   left-[5%]   w-24 h-24 text-amber-400/30 -rotate-12" style={{ animationDelay: '0s'   }} />
        <Network        className="icon-pulse absolute top-[14%]  left-[18%]  w-20 h-20 text-amber-500/30 rotate-6"   style={{ animationDelay: '0.7s' }} />
        <BookOpen       className="icon-drift absolute top-[4%]   left-[32%]  w-20 h-20 text-orange-400/30 rotate-3"  style={{ animationDelay: '1.2s' }} />
        <Hash           className="icon-float absolute top-[22%]  left-[8%]   w-14 h-14 text-amber-600/25 -rotate-6"  style={{ animationDelay: '2.5s' }} />
        <Link2          className="icon-pulse absolute top-[30%]  left-[24%]  w-16 h-16 text-orange-500/30 rotate-45" style={{ animationDelay: '1.9s' }} />

        {/* ─── 右上区域 ─── */}
        <Cpu            className="icon-drift absolute top-[8%]   right-[6%]  w-28 h-28 text-amber-500/25 rotate-12"  style={{ animationDelay: '0.4s' }} />
        <Workflow       className="icon-float absolute top-[18%]  right-[20%] w-20 h-20 text-orange-500/30 -rotate-3" style={{ animationDelay: '1.8s' }} />
        <Brain          className="icon-pulse absolute top-[3%]   right-[28%] w-20 h-20 text-amber-400/35 rotate-6"   style={{ animationDelay: '2.1s' }} />
        <Gem            className="icon-float absolute top-[26%]  right-[4%]  w-16 h-16 text-amber-600/30 -rotate-12" style={{ animationDelay: '3.3s' }} />
        <Cable          className="icon-drift absolute top-[32%]  right-[26%] w-16 h-16 text-orange-400/30 rotate-12" style={{ animationDelay: '0.6s' }} />

        {/* ─── 左下区域 ─── */}
        <GitMerge       className="icon-drift absolute bottom-[8%]  left-[6%]  w-24 h-24 text-orange-400/25 rotate-12" style={{ animationDelay: '1.5s' }} />
        <Lightbulb      className="icon-pulse absolute bottom-[20%] left-[20%] w-20 h-20 text-amber-500/35 -rotate-6"  style={{ animationDelay: '0.9s' }} />
        <Wallet         className="icon-float absolute bottom-[4%]  left-[35%] w-18 h-18 text-amber-400/30 rotate-3"   style={{ animationDelay: '2.7s' }} />
        <Waypoints      className="icon-drift absolute bottom-[32%] left-[10%] w-18 h-18 text-orange-500/30 -rotate-12" style={{ animationDelay: '3.5s' }} />
        <Package        className="icon-pulse absolute bottom-[26%] left-[32%] w-16 h-16 text-amber-600/30 rotate-6"    style={{ animationDelay: '1.1s' }} />

        {/* ─── 右下区域 ─── */}
        <Cog            className="icon-drift absolute bottom-[10%] right-[8%]  w-28 h-28 text-amber-500/25 -rotate-12" style={{ animationDelay: '3.0s' }} />
        <Route          className="icon-float absolute bottom-[22%] right-[22%] w-18 h-18 text-orange-500/30 rotate-6"  style={{ animationDelay: '0.2s' }} />
        <FunctionSquare className="icon-pulse absolute bottom-[3%]  right-[32%] w-20 h-20 text-amber-600/25 -rotate-3"  style={{ animationDelay: '1.6s' }} />
        <BookOpen       className="icon-drift absolute bottom-[30%] right-[10%] w-16 h-16 text-amber-400/35 rotate-12"  style={{ animationDelay: '2.3s' }} />
        <Atom           className="icon-float absolute bottom-[36%] right-[28%] w-16 h-16 text-amber-500/30 -rotate-6"  style={{ animationDelay: '0.5s' }} />

        {/* ─── 中间散点（避开卡片）：补足整体氛围 ─── */}
        <Sparkles       className="icon-pulse absolute top-[2%]    left-[48%]  w-12 h-12 text-amber-400/35 rotate-12"  style={{ animationDelay: '0.3s' }} />
        <Binary         className="icon-float absolute bottom-[2%]  left-[55%]  w-14 h-14 text-orange-500/25 -rotate-6" style={{ animationDelay: '2.0s' }} />
        <Boxes          className="icon-drift absolute top-[40%]   left-[2%]   w-14 h-14 text-amber-500/30 rotate-3"   style={{ animationDelay: '1.4s' }} />
        <FileJson       className="icon-pulse absolute bottom-[40%] right-[2%]  w-14 h-14 text-amber-600/30 -rotate-12" style={{ animationDelay: '2.8s' }} />
        <Brackets       className="icon-float absolute top-[44%]   right-[36%] w-12 h-12 text-orange-400/25 rotate-6"   style={{ animationDelay: '3.6s' }} />
      </div>

      {/* ── 居中卡片 ── */}
      <div className="relative w-full max-w-5xl flex flex-col lg:flex-row rounded-2xl overflow-hidden shadow-2xl min-h-[66vh]">
        {/* 左侧品牌区 */}
        <BrandPanel />

        {/* 右侧表单区 */}
        <main className="flex-1 flex items-center justify-center p-8 lg:p-14 bg-background">
          <LoginForm />
        </main>
      </div>

      {/* ── 页面底部版权栏（卡片外） ── */}
      <footer className="relative mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 text-xs text-amber-900/60">
          <a href="https://gwzx.com" target="_blank" rel="noopener noreferrer" className="hover:text-amber-900 transition-colors duration-200">法律声明</a>
          <span className="text-amber-900/30">·</span>
          <a href="/privacy" className="hover:text-amber-900 transition-colors duration-200">隐私政策</a>
          <span className="text-amber-900/30">·</span>
          <a href="mailto:contact@gwzx.com" className="hover:text-amber-900 transition-colors duration-200">联系我们</a>
          <span className="text-amber-900/30">·</span>
          <a href="mailto:hr@gwzx.com" className="hover:text-amber-900 transition-colors duration-200">加入我们</a>
        </div>
        <p className="text-xs text-amber-900/40 select-none">
          © gwzx.com 上海感物知行科技有限公司版权所有
        </p>
      </footer>

    </div>
  )
}
