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
        {/* index Route：匹配根路径 "/"，渲染 HomePage */}
        <Route index element={<HomePage />} />
        {/* 普通路由：path 与 URL 精确匹配后渲染对应页面组件 */}
        <Route path="/search" element={<SearchPage />} />
        <Route path="/method" element={<MethodDetailPage />} />
        {/* 动态段 :entityId 会作为 URL 参数传入组件，可通过 useParams() 读取 */}
        <Route path="/method/:entityId" element={<MethodDetailPage />} />
        <Route path="/impact" element={<ImpactAnalysisPage />} />
        <Route path="/table-access" element={<MethodTablePage />} />
        {/* 通配路由 "*"：匹配所有未命中的路径，渲染 404 页面 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
