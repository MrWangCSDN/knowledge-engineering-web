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
import { Routes, Route, Navigate } from 'react-router-dom'
// v1.9.1：React.lazy 让"用到时才下载"
// Suspense 给 lazy 组件提供 loading fallback
import { lazy, Suspense } from 'react'

// AppLayout：页面外壳（导航栏、侧边栏等），内部必须有 <Outlet /> 才能渲染子路由
// **不 lazy**：所有受保护页面都要它，单独 chunk 反而增加请求数
import { AppLayout } from '@/components/layout/AppLayout'
// RequireAuth：路由守卫组件；同样所有页面都用，保持静态
import { RequireAuth } from '@/components/auth/RequireAuth'
// 登录页 **不 lazy**：第一屏（也是用户最常进入的入口），保持快速首屏
import { LoginPage } from '@/pages/LoginPage'
// RootRedirect 体积极小（30 行），不值得拆 chunk
import { RootRedirect } from '@/pages/RootRedirect'

// ─── v1.9.1：业务页面全部 lazy load ───────────────────────────────────
//
// `lazy(() => import('...'))` 的写法：
//   - 构建时 Vite 把这个 import 切成独立 chunk
//   - 运行时 Suspense 看到 lazy 组件第一次渲染才发请求加载
//   - `.then(m => ({ default: ... }))` 是把 named export 转成 default export
//     （lazy 协议要求模块默认导出一个组件）

const ChatPage = lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })))
const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))
const SearchPage = lazy(() => import('@/pages/SearchPage').then(m => ({ default: m.SearchPage })))
const MethodDetailPage = lazy(() => import('@/pages/MethodDetailPage').then(m => ({ default: m.MethodDetailPage })))
const ImpactAnalysisPage = lazy(() => import('@/pages/ImpactAnalysisPage').then(m => ({ default: m.ImpactAnalysisPage })))
const MethodTablePage = lazy(() => import('@/pages/MethodTablePage').then(m => ({ default: m.MethodTablePage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

// Settings 页面（admin 才用）一起放进一个 chunk
const SettingsLayout = lazy(() => import('@/pages/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })))
const RepositoryListPage = lazy(() => import('@/pages/settings/RepositoryListPage').then(m => ({ default: m.RepositoryListPage })))
const CredentialListPage = lazy(() => import('@/pages/settings/CredentialListPage').then(m => ({ default: m.CredentialListPage })))
// v2.0 新增：多租户 settings 页面
const GroupListPage = lazy(() => import('@/pages/settings/GroupListPage').then(m => ({ default: m.GroupListPage })))
const GroupDetailPage = lazy(() => import('@/pages/settings/GroupDetailPage').then(m => ({ default: m.GroupDetailPage })))
const ProjectDetailPage = lazy(() => import('@/pages/settings/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const UserListPage = lazy(() => import('@/pages/settings/UserListPage').then(m => ({ default: m.UserListPage })))
const AuditLogPage = lazy(() => import('@/pages/settings/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const ArchivedSessionsPage = lazy(() => import('@/pages/settings/ArchivedSessionsPage').then(m => ({ default: m.ArchivedSessionsPage })))


/**
 * 路由切换时显示的加载占位。
 *
 * 设计：
 *   - 极简灰色文字 + spinner 风格的脉冲点；不抢眼但能让用户感知"在加载"
 *   - 不用全屏 spinner 因为大多数 chunk < 100KB，加载 < 200ms，反而显得"闪烁"
 */
function RouteSuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground text-[14px]">
      <span className="animate-pulse">加载中…</span>
    </div>
  )
}

// 默认导出 —— 与原文件保持一致（default export）
export default function App() {
  return (
    // v1.9.1：用 Suspense 包外层，捕获所有 lazy 组件的加载等待
    // 一个 Suspense 覆盖全 Routes 是最简模型；细粒度需求可再拆
    <Suspense fallback={<RouteSuspenseFallback />}>
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

          {/* Settings — v2.0 多租户 RBAC 扩展
              - admin-only tab（users / audit-logs）由 SettingsLayout 内部根据 is_admin 控制可见性
              - 后端 /admin/* 路由会拦截非 admin 调用，双重保护 */}
          <Route path="/settings" element={<SettingsLayout />}>
            {/* 默认重定向到工程列表 */}
            <Route index element={<Navigate to="/settings/projects" replace />} />
            {/* 工程管理（原 repos，v2.0 改名 projects） */}
            <Route path="projects" element={<RepositoryListPage />} />
            {/* 工程详情（新） */}
            <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            {/* 组管理（新） */}
            <Route path="groups" element={<GroupListPage />} />
            {/* 组详情（新） */}
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            {/* 凭证管理（既有，已改 user-scoped） */}
            <Route path="credentials" element={<CredentialListPage />} />
            {/* 用户管理（新，admin only） */}
            <Route path="users" element={<UserListPage />} />
            {/* 审计日志（新，admin only） */}
            <Route path="audit-logs" element={<AuditLogPage />} />
            {/* 已归档对话（新，所有登录用户都可访问；归档列表按 current_user.id 过滤）*/}
            <Route path="archived-chats" element={<ArchivedSessionsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
