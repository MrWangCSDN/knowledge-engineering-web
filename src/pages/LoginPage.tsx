import { BrandPanel } from '@/components/auth/BrandPanel'
import { LoginForm } from '@/components/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4 lg:p-8">

      {/* ── 居中卡片 ── */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row rounded-2xl overflow-hidden shadow-2xl">
        {/* 左侧品牌区 */}
        <BrandPanel />

        {/* 右侧表单区 */}
        <main className="flex-1 flex items-center justify-center p-8 lg:p-14 bg-background">
          <LoginForm />
        </main>
      </div>

      {/* ── 页面底部版权栏（卡片外） ── */}
      <footer className="mt-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 text-xs text-white/30">
          <a href="https://gwzx.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors duration-200">法律声明</a>
          <span className="text-white/15">·</span>
          <a href="/privacy" className="hover:text-white/60 transition-colors duration-200">隐私政策</a>
          <span className="text-white/15">·</span>
          <a href="mailto:contact@gwzx.com" className="hover:text-white/60 transition-colors duration-200">联系我们</a>
          <span className="text-white/15">·</span>
          <a href="mailto:hr@gwzx.com" className="hover:text-white/60 transition-colors duration-200">加入我们</a>
        </div>
        <p className="text-xs text-white/20 select-none">
          © gwzx.com 上海感物知行科技有限公司版权所有
        </p>
      </footer>

    </div>
  )
}
