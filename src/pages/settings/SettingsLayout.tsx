/**
 * src/pages/settings/SettingsLayout.tsx
 *
 * 设置页外层 — 左 Tab 导航 + 右 Outlet 渲染子路由内容。
 *
 * v2.0 子路由：
 *   /settings/projects       工程管理（所有用户）
 *   /settings/groups         组管理（所有用户）
 *   /settings/credentials    凭证管理（所有用户）
 *   /settings/users          用户管理（仅 admin）
 *   /settings/audit-logs     审计日志（仅 admin）
 *
 * Admin gating：从 useAuthStore 读 user.is_admin；
 * 非 admin 用户看不到"用户"和"审计日志" tab（UI 层隐藏，后端 API 同样 403 兜底）。
 *
 * v2.1 background-location 模式：
 *   当 location.state.background 存在时，说明这个 SettingsLayout 是在模态框内渲染的。
 *   此时：
 *     1. 隐藏"返回主页"Link（依靠模态 X 关闭）
 *     2. Tab NavLink 切换时携带 { background } state，保持模态不丢失
 */
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { GitBranch, Key, ChevronLeft, Users, ClipboardList, Layers, Archive, GitFork } from 'lucide-react'
import { Link } from 'react-router-dom'
// type Location：react-router-dom 的 Location 类型，用于类型注解
import type { Location } from 'react-router-dom'

import { useAuthStore } from '@/store/auth'

interface TabItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  adminOnly?: boolean
}

// TABS 声明为 readonly，枚举所有 settings 子路由的 tab 配置
const TABS: TabItem[] = [
  { to: '/settings/projects',    icon: GitBranch,    label: '工程' },
  { to: '/settings/groups',      icon: Layers,       label: '组' },
  { to: '/settings/credentials', icon: Key,          label: '凭证' },
  { to: '/settings/users',       icon: Users,        label: '用户',      adminOnly: true },
  { to: '/settings/audit-logs',  icon: ClipboardList, label: '审计日志', adminOnly: true },
  { to: '/settings/archived-chats', icon: Archive,   label: '已归档对话' },
  { to: '/settings/connections',    icon: GitFork,   label: '连接' },
]

export function SettingsLayout() {
  // 从全局 auth store 读取当前用户信息
  // selector 写法：只订阅 user 字段，user 不变时组件不重渲染
  const user = useAuthStore(s => s.user)

  // is_admin：布尔值，null/未登录时退化为 false（最小权限原则）
  const isAdmin = user?.is_admin ?? false

  // 根据 isAdmin 过滤 tab 列表：admin 看全部，普通用户过滤掉 adminOnly 项
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  // useLocation：读取当前路由 location 对象（包括 state）
  const location = useLocation()

  // 从 state 读取 background：background-location 模式下，
  // App.tsx 渲染的 SettingsModal 套这个 SettingsLayout，
  // state.background 指向打开模态前的页面 location
  // (location.state as { background?: Location } | null)：类型断言，安全读取 state
  const background = (location.state as { background?: Location } | null)?.background

  // inModal：布尔值，表示当前是否在模态框内渲染
  // 有 background = 模态模式；无 background = 全页 fallback 模式
  const inModal = !!background

  return (
    <div className="h-full flex">
      {/* ── 左侧 Tab ── */}
      <aside className="w-[220px] shrink-0 border-r overflow-y-auto py-4 px-2">
        {/* 全页模式（直接访问 /settings/*）才显示"返回主页"；
            模态模式靠模态右上角的 X 按钮关闭，不需要这个 Link */}
        {!inModal && (
          <Link
            to="/"
            className="
              flex items-center gap-1.5 px-3 py-2 mb-3 rounded-lg
              text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground
              transition-colors
            "
          >
            <ChevronLeft className="h-4 w-4" />
            返回主页
          </Link>
        )}

        {/* 模态内顶部留一点空间，对齐右上角关闭按钮 */}
        {inModal && <div className="h-3" />}

        <div className="px-3 pb-2 text-[12px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          设置
        </div>

        <nav className="space-y-0.5">
          {visibleTabs.map(t => {
            const Icon = t.icon
            return (
              // NavLink：react-router-dom 的链接组件，isActive 自动匹配当前路由
              // 关键陷阱：在模态内点 tab 如果不携带 state.background，
              //   路由跳转后 location.state 会丢失，导致 App.tsx 认为不在模态模式，
              //   结果模态关闭变成全页渲染。
              // 解法：模态内（inModal=true）时给每个 NavLink 的 state 带上 { background }，
              //   这样 tab 切换不会丢失模态状态。
              <NavLink
                key={t.to}
                to={t.to}
                // state：background-location 模式下传入 background，保持模态不关闭；
                // 全页模式（inModal=false）不传 state，行为与原来一致
                state={inModal ? { background } : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {t.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* ── 右侧内容 ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Outlet：react-router-dom 的插槽，渲染当前匹配的子路由组件 */}
        <Outlet />
      </main>
    </div>
  )
}
