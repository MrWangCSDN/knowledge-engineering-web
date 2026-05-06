/**
 * src/App.tsx
 *
 * 应用顶层路由
 *
 * 路由结构：
 *   /login                              公开（任何人可访问）
 *   <RequireAuth>                       下面所有路由要求登录
 *     /                                 HomePage
 *     /search                           SearchPage
 *     /method, /method/:entityId        MethodDetailPage
 *     /impact                           ImpactAnalysisPage
 *     /table-access                     MethodTablePage
 *     /*                                NotFoundPage
 *
 * React Router v7 嵌套路由：
 *   父 Route 用 element={<Wrapper />} 风格，子 Route 渲染时会替换父组件内部的 <Outlet />。
 *   这里用 <RequireAuth><AppLayout /></RequireAuth> 当父 element：
 *     - RequireAuth 先检查登录态，未登录则跳转到 /login
 *     - 已登录则渲染 AppLayout，AppLayout 内部有 <Outlet />，子路由页面从那里呈现
 *   这样做的好处：只需一个父节点就能保护所有子路由，无需给每个子路由单独加守卫。
 */
import { Routes, Route } from 'react-router-dom'
// AppLayout：页面外壳（导航栏、侧边栏等），内部必须有 <Outlet /> 才能渲染子路由
import { AppLayout } from '@/components/layout/AppLayout'
// RequireAuth：路由守卫组件，检查登录态；未登录时重定向到 /login
import { RequireAuth } from '@/components/auth/RequireAuth'
// 公开页面 —— 不需要登录即可访问
import { LoginPage } from '@/pages/LoginPage'
// 受保护页面 —— 需要登录后才能访问
import { HomePage } from '@/pages/HomePage'
import { ChatPage } from '@/pages/ChatPage'
import { RootRedirect } from '@/pages/RootRedirect'
import { SearchPage } from '@/pages/SearchPage'
import { MethodDetailPage } from '@/pages/MethodDetailPage'
import { ImpactAnalysisPage } from '@/pages/ImpactAnalysisPage'
import { MethodTablePage } from '@/pages/MethodTablePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// 默认导出 —— 与原文件保持一致（default export）
export default function App() {
  return (
    // <Routes>：路由容器，匹配当前 URL 并渲染对应 Route
    <Routes>
      {/* ── 公开路由 ──────────────────────────────────────────────── */}
      {/* /login 不经过 RequireAuth，任何人（包括未登录用户）都可访问 */}
      <Route path="/login" element={<LoginPage />} />

      {/* ── 受保护路由组 ──────────────────────────────────────────── */}
      {/*
        父 Route 没有 path（即匹配所有路径），
        element 是 <RequireAuth><AppLayout /></RequireAuth>：
          1. RequireAuth 先运行：未登录 → 重定向 /login，终止渲染
          2. 已登录 → 渲染 AppLayout，AppLayout 的 <Outlet /> 处渲染子路由
        子路由（index / /search / ...）只有通过 RequireAuth 检查后才会被渲染。
      */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        {/* / —— 根据工程列表 redirect 到 /project/<first> 或显示空状态 */}
        <Route index element={<RootRedirect />} />

        {/* 工程主页（新对话） */}
        <Route path="/project/:projectId" element={<ChatPage />} />
        {/* 加载特定会话 */}
        <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />

        {/* 旧首页保留作 fallback（未来逐步移除） */}
        <Route path="/legacy-home" element={<HomePage />} />

        {/* 其他既有页面（v1 不变，v1.5 视情况整合到 chat 流） */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/method" element={<MethodDetailPage />} />
        <Route path="/method/:entityId" element={<MethodDetailPage />} />
        <Route path="/impact" element={<ImpactAnalysisPage />} />
        <Route path="/table-access" element={<MethodTablePage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
