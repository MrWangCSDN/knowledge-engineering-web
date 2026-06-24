/**
 * src/components/settings/SettingsModal.tsx
 *
 * 路由式设置模态框（ChatGPT background-location 模式）。
 *
 * 工作原理：
 *   - App.tsx 在主 Routes 外用 {background && <Routes>} 额外渲染一套 /settings/* 路由。
 *   - 当 location.state.background 存在时，该组件被挂载，显示遮罩 + 居中面板。
 *   - 面板内复用 SettingsLayout（有 <Outlet/>），子路由继续在面板内渲染。
 *   - 关闭时 navigate 回 background，回到打开设置前的页面。
 *
 * 直接访问 /settings/*（无 state.background）：
 *   - 此组件不会被渲染（由 App.tsx 的 background 条件保护）。
 *   - 主 Routes 正常渲染全页 SettingsLayout（fallback）。
 */

// useNavigate：在不刷新页面的情况下跳转路由的 hook
// useLocation：读取当前 location 对象（pathname / state 等）
// type Location：react-router-dom 的 Location 类型，用于类型注解
import { useNavigate, useLocation, type Location } from 'react-router-dom'

// useEffect：副作用 hook，这里用来监听键盘事件（Esc 关闭）
import { useEffect, useCallback } from 'react'

// X 图标：右上角关闭按钮用的 X 形图标（来自 lucide-react 图标库）
import { X } from 'lucide-react'

// SettingsLayout：设置页的左导航 + Outlet 布局；模态内复用同一份组件
import { SettingsLayout } from '@/pages/settings/SettingsLayout'

/**
 * SettingsModal
 *
 * 在 background-location 模式下渲染的设置模态框。
 * 由 App.tsx 在检测到 location.state.background 时挂载。
 */
export function SettingsModal() {
  // useLocation：拿到当前的 location 对象
  // location.state 里存着 { background: Location }（由 UserMenu 打开时写入）
  const location = useLocation()

  // useNavigate：返回 navigate 函数，用于编程式路由跳转
  const navigate = useNavigate()

  // 从 state 中读取打开模态前的背景 location
  // (location.state as { background?: Location } | null)：类型断言，安全读取
  const background = (location.state as { background?: Location } | null)?.background

  // onClose：关闭模态框，navigate 回背景页
  // useCallback：缓存函数引用，避免 useEffect 的依赖每次重新创建
  const onClose = useCallback(() => {
    // 如果有背景 location 就回去，否则回首页（兜底）
    navigate(background ?? '/')
  }, [navigate, background])

  // useEffect：挂载时监听键盘 Esc 键，卸载时移除监听（防止内存泄漏）
  // 依赖项 [onClose]：onClose 变化时重新注册监听器
  useEffect(() => {
    // onKey：键盘按下事件处理函数
    const onKey = (e: KeyboardEvent) => {
      // 只响应 Escape 键
      if (e.key === 'Escape') {
        onClose()
      }
    }
    // document.addEventListener：给整个文档注册键盘事件监听
    document.addEventListener('keydown', onKey)

    // 返回清理函数：组件卸载或 onClose 变化时移除监听，避免重复注册
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    // 遮罩层：fixed 固定定位覆盖整个视口，inset-0 = top/right/bottom/left 全 0
    // z-50：层叠顺序，确保在普通内容之上
    // flex items-center justify-center：居中放置子面板
    // p-4：四周 padding，防止小屏面板贴边
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      // role="dialog"：告诉辅助技术（屏幕阅读器）这是一个对话框
      role="dialog"
      // aria-modal="true"：通知屏幕阅读器模态外的内容暂不可访问
      aria-modal="true"
      // aria-label：对话框的无障碍标签
      aria-label="设置"
    >
      {/* ── 遮罩背景 ──
          absolute inset-0：绝对定位撑满父容器（即整个视口）
          bg-black/40：黑色 40% 透明度（design token 兼容写法：黑色是通用色，无需 CSS 变量）
          backdrop-blur-sm：背景高斯模糊，给被遮挡内容加磨玻璃效果
          点击遮罩调用 onClose 关闭模态 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        // aria-hidden：遮罩是纯视觉装饰，屏幕阅读器跳过
        aria-hidden="true"
      />

      {/* ── 模态面板 ──
          relative：让内部 absolute 元素（如关闭按钮）相对于面板定位
          w-full max-w-4xl：最大宽度 896px，响应式收缩
          h-[80vh]：面板高度占视口 80%
          overflow-hidden：防止子内容溢出圆角
          bg-background：CSS token —— light 下白色，dark 下深色，自动跟主题
          border：边框（border-border token）
          rounded-xl：大圆角（12px），现代感
          shadow-2xl：大投影
          flex：让 SettingsLayout 撑满面板 */}
      <div
        className="
          relative w-full max-w-4xl h-[80vh] overflow-hidden
          bg-background border rounded-xl shadow-2xl
          flex flex-col
        "
      >
        {/* ── 右上角关闭按钮 ──
            absolute top-3 right-3：绝对定位到面板右上角
            z-10：确保在 SettingsLayout 内容之上 */}
        <button
          type="button"
          onClick={onClose}
          // aria-label：屏幕阅读器读出"关闭"
          aria-label="关闭设置"
          // p-1.5 rounded：内边距 + 圆角
          // hover:bg-muted：悬停时浅色背景（design token，light/dark 自动适配）
          // text-muted-foreground：dimmed 文字色（design token）
          // transition-colors：颜色变化动画
          className="
            absolute top-3 right-3 z-10
            p-1.5 rounded
            hover:bg-muted text-muted-foreground hover:text-foreground
            transition-colors
          "
        >
          {/* X 图标 h-4 w-4 = 16×16px */}
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* ── 面板内容 ──
            flex-1：撑满面板剩余高度
            overflow-hidden：让 SettingsLayout 内部自己管理滚动
            SettingsLayout 自带 flex h-full 布局，左导航 + 右 Outlet */}
        <div className="flex-1 overflow-hidden flex">
          {/* 复用同一份 SettingsLayout，面板内 <Outlet/> 渲染当前子路由页面 */}
          <SettingsLayout />
        </div>
      </div>
    </div>
  )
}
