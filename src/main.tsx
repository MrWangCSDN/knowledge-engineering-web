/**
 * src/main.tsx
 *
 * React 应用入口 —— ReactDOM 渲染根组件
 *
 * Provider 嵌套顺序（从外到内）：
 *   StrictMode            → 开启严格模式（开发期检查副作用/生命周期问题）
 *   QueryClientProvider   → 提供 TanStack Query（数据请求/缓存）上下文
 *   BrowserRouter         → 提供路由 history 上下文（URL 与组件映射）
 *   AppWithAutoRefresh    → 包裹 App，注入 useAutoRefresh hook
 *
 * 为什么需要 AppWithAutoRefresh wrapper？
 *   React 规则：hook 只能在函数组件或自定义 hook 内部调用，
 *   不能在模块顶层（如 createRoot 调用之前）直接调用。
 *   所以用一个简单的包裹组件，在组件体内先调 useAutoRefresh()，
 *   再返回真正的 <App />，即可满足 React 的 hook 调用规则。
 */
import { StrictMode } from 'react'
// createRoot：React 18 的新渲染 API，替代旧版 ReactDOM.render()
import { createRoot } from 'react-dom/client'
// BrowserRouter：使用 HTML5 History API 管理路由（URL 不带 #）
import { BrowserRouter } from 'react-router-dom'
// QueryClient：TanStack Query 的客户端实例，存储请求缓存和配置
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// 默认导出的 App 组件（与 App.tsx 的 export default 对应）
import App from '@/App'
// useAutoRefresh：自动续期 token 的自定义 hook
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
// 全局 CSS 样式
import '@/index.css'

// 创建 QueryClient 实例，配置全局默认请求行为
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime：数据在多少毫秒内视为"新鲜"，期间不会重新请求
      staleTime: 30_000,
      // retry：请求失败后最多重试次数
      retry: 1,
      // refetchOnWindowFocus：切换窗口时是否自动重新请求，这里关闭
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * AppWithAutoRefresh —— 启动 token 自动续期，然后渲染 App
 *
 * 这是一个普通 React 函数组件（满足 hook 调用的前提条件）。
 * 把 hook 放在这里而不是 main.tsx 顶层，遵守了 React 的"hook 只能在组件内调用"规则：
 *   - 错误写法（会报错）：在 createRoot 外面调 useAutoRefresh()
 *   - 正确写法：在函数组件体内调 useAutoRefresh()，再 return <App />
 *
 * react-refresh：需要导出这个组件，使 HMR 能追踪其变化
 */
export function AppWithAutoRefresh() {
  // useAutoRefresh：自定义 hook，内部启动定时器定期刷新访问令牌
  // 调用后无需手动处理返回值，副作用（定时刷新）自动运行
  useAutoRefresh()

  // 渲染真正的路由/页面组件
  return <App />
}

// 找到 HTML 中 id="root" 的挂载点，创建 React 渲染根
// "!" 是 TypeScript 的非空断言：告诉编译器这个元素一定存在（不为 null）
createRoot(document.getElementById('root')!).render(
  // StrictMode：仅在开发环境生效，会故意双调用组件函数来帮助发现副作用
  <StrictMode>
    {/* QueryClientProvider：将 queryClient 注入子树，子组件可用 useQuery 等 hook */}
    <QueryClientProvider client={queryClient}>
      {/* BrowserRouter：注入路由上下文，子组件可用 useNavigate / useParams 等 */}
      <BrowserRouter>
        {/* AppWithAutoRefresh：先激活 token 自动刷新，再渲染路由树 */}
        <AppWithAutoRefresh />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
