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
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
// type Location：react-router-dom 的 Location 类型，用于类型注解
import type { Location } from 'react-router-dom'
// v1.9.1：React.lazy 让"用到时才下载"
// Suspense 给 lazy 组件提供 loading fallback
import { lazy, Suspense } from 'react'

// AppLayout：页面外壳（导航栏、侧边栏等），内部必须有 <Outlet /> 才能渲染子路由
// **不 lazy**：所有受保护页面都要它，单独 chunk 反而增加请求数
import { AppLayout } from '@/components/layout/AppLayout'
// InfraBanner：基础设施不可用横幅 —— 放在 App 顶层（routes 之外），
// 让登录页也能看到，覆盖「mysql 挂时用户连登录都看不到错误」的场景
import { InfraBanner } from '@/components/layout/InfraBanner'
import { useInfraHealthBootstrap } from '@/hooks/useInfraHealthBootstrap'
// RequireAuth：路由守卫组件；同样所有页面都用，保持静态
import { RequireAuth } from '@/components/auth/RequireAuth'
// 登录页 **不 lazy**：第一屏（也是用户最常进入的入口），保持快速首屏
import { LoginPage } from '@/pages/LoginPage'
// RootRedirect 体积极小（30 行），不值得拆 chunk
import { RootRedirect } from '@/pages/RootRedirect'
// dev only：markdown 渲染验证页 — 不走 RequireAuth，方便快速调样式
// 验证完可以连同 /dev/md-preview 路由一起删
import { DevMarkdownPreview } from '@/pages/DevMarkdownPreview'

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
// SettingsLayout：SettingsModal（静态 import）也依赖此模块，
// 故改为静态 import（dynamic import 在两者同时存在时会被 bundler 合并到主 chunk，
// lazy 声明实际不生效，消除 rolldown 的 INEFFECTIVE_DYNAMIC_IMPORT warning）。
// 静态 import 在 App 启动时就加载，符合"设置模态频繁打开"的场景。
import { SettingsLayout } from '@/pages/settings/SettingsLayout'
const RepositoryListPage = lazy(() => import('@/pages/settings/RepositoryListPage').then(m => ({ default: m.RepositoryListPage })))
const CredentialListPage = lazy(() => import('@/pages/settings/CredentialListPage').then(m => ({ default: m.CredentialListPage })))
// v2.0 新增：多租户 settings 页面
const GroupListPage = lazy(() => import('@/pages/settings/GroupListPage').then(m => ({ default: m.GroupListPage })))
const GroupDetailPage = lazy(() => import('@/pages/settings/GroupDetailPage').then(m => ({ default: m.GroupDetailPage })))
const ProjectDetailPage = lazy(() => import('@/pages/settings/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })))
const UserListPage = lazy(() => import('@/pages/settings/UserListPage').then(m => ({ default: m.UserListPage })))
const AuditLogPage = lazy(() => import('@/pages/settings/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const ArchivedSessionsPage = lazy(() => import('@/pages/settings/ArchivedSessionsPage').then(m => ({ default: m.ArchivedSessionsPage })))
// SCM 连接向导页面（P6 B-i）
const ConnectionListPage = lazy(() => import('@/pages/connect/ConnectionListPage').then(m => ({ default: m.ConnectionListPage })))
const ConnectCallbackPage = lazy(() => import('@/pages/connect/ConnectCallbackPage').then(m => ({ default: m.ConnectCallbackPage })))
// 选仓页（P6 B-ii）
const SelectRepoPage = lazy(() => import('@/pages/connect/SelectRepoPage').then(m => ({ default: m.SelectRepoPage })))
// 绑定确认页（P6 B-iii）
const BindRepoPage = lazy(() => import('@/pages/connect/BindRepoPage').then(m => ({ default: m.BindRepoPage })))

// SettingsModal：background-location 模式下的设置模态框（v2.1 新增）
// 不 lazy：模态打开频繁，且体积小，静态 import 避免首次点击延迟
import { SettingsModal } from '@/components/settings/SettingsModal'


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

// ─── settings 子路由集合（共享 helper）────────────────────────────────────────
// 将 /settings 子路由集中管理，主 Routes（全页）和 modal Routes 各 spread 一份，
// 避免两处各自手写子路由导致遗漏/不一致。
// 注意：这是一个 JSX 数组（React.ReactNode[]），不是组件；每个元素都是 <Route/>。
function SettingsChildRoutes() {
  // 返回 /settings 下的所有子路由，供父 Route 嵌套
  // Fragment 写法（<>...</>）配合 React Router v7 嵌套路由使用
  return (
    <>
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
      {/* SCM 连接列表（P6 B-i：GitHub 连接向导入口）*/}
      <Route path="connections" element={<ConnectionListPage />} />
      {/* 选仓页（P6 B-ii：连接向导屏 2）*/}
      <Route path="connections/:connId/select" element={<SelectRepoPage />} />
      {/* 绑定确认页（P6 B-iii：连接向导屏 3+4 合一）*/}
      <Route path="connections/:connId/bind" element={<BindRepoPage />} />
    </>
  )
}

// 默认导出 —— 与原文件保持一致（default export）
export default function App() {
  // mount 时调一次 /health（全局，覆盖登录页和登录后所有页面）
  useInfraHealthBootstrap()

  // useLocation：读取当前 location 对象
  // background-location 模式核心：当用户从应用内点「设置」时，
  //   UserMenu 把当前 location 存入 state.background，然后 navigate 到 /settings/*。
  //   此时 location.pathname 变为 /settings/projects，但 state.background 是跳转前的页面。
  const location = useLocation()

  // 读取 background：如果存在，说明正在以模态模式访问 /settings/*
  // (location.state as { background?: Location } | null)：
  //   类型断言，安全地从 state 对象取 background 字段
  const background = (location.state as { background?: Location } | null)?.background

  return (
    // v1.9.1：用 Suspense 包外层，捕获所有 lazy 组件的加载等待
    // 一个 Suspense 覆盖全 Routes 是最简模型；细粒度需求可再拆
    <Suspense fallback={<RouteSuspenseFallback />}>
      {/* InfraBanner：顶层注入，sticky top-0 让任何路由（含 /login）都能看到「系统不可用」 */}
      <InfraBanner />

      {/* ── 主 Routes ──────────────────────────────────────────────────────────
          background-location 模式关键：
            - 有 background 时：<Routes location={background}> 渲染背景页（打开模态前的页面），
              让背景页保持在模态后面可见（虽然被遮罩遮住）。
            - 无 background 时：<Routes location={location}> 正常渲染当前页面，
              包括直接访问 /settings/* 的全页 fallback 场景。
          location prop：React Router v7 允许传入 location 对象覆盖当前 URL 用于渲染，
            这样 Routes 会以 background location 来匹配路由，而不是 /settings/projects。 */}
      <Routes location={background ?? location}>
        {/* ── 公开路由 ──────────────────────────────────────────────── */}
        {/* /login 不经过 RequireAuth，任何人（包括未登录用户）都可访问 */}
        <Route path="/login" element={<LoginPage />} />
        {/* dev only：markdown 渲染验证页 — 不需要登录 */}
        <Route path="/dev/md-preview" element={<DevMarkdownPreview />} />

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

          {/* Settings — v2.0 多租户 RBAC 扩展 / v2.1 background-location 全页 fallback
              - 直接访问 /settings/* 或刷新页面时（无 state.background），渲染全页设置。
              - 从应用内点「设置」时，background 存在，主 Routes 渲染背景页，
                下方的 modal Routes 渲染 SettingsModal。
              - admin-only tab（users / audit-logs）由 SettingsLayout 内部根据 is_admin 控制。 */}
          <Route path="/settings" element={<SettingsLayout />}>
            {SettingsChildRoutes()}
          </Route>

          {/* GitHub App 安装回调中转（OAuth 回跳，不放 SettingsLayout，不要 settings 框）*/}
          <Route path="/connect/callback" element={<ConnectCallbackPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>

      {/* ── 模态 Routes（background-location 模式）────────────────────────────
          background 存在时才渲染（即：从应用内以模态模式打开 /settings/*）。
          这是一个独立的 <Routes>，它使用真实的当前 location（/settings/projects 等），
          匹配到 /settings 路由后渲染 SettingsModal（而不是主 Routes 里的全页 SettingsLayout）。
          SettingsModal 内部渲染 SettingsLayout + Outlet，子路由内容在模态面板内显示。 */}
      {background && (
        <Routes>
          {/* /settings 模态路由：element 是 SettingsModal，内部已包含 SettingsLayout */}
          <Route path="/settings" element={<SettingsModal />}>
            {/* 与全页 /settings 下的子路由保持逐条一致，让模态内 Outlet 能正确渲染子页 */}
            {SettingsChildRoutes()}
          </Route>
        </Routes>
      )}
    </Suspense>
  )
}
