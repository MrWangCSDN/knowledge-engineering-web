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
 */
import { NavLink, Outlet } from 'react-router-dom'
import { GitBranch, Key, ChevronLeft, Users, ClipboardList, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'

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
]

export function SettingsLayout() {
  // 从全局 auth store 读取当前用户信息
  // selector 写法：只订阅 user 字段，user 不变时组件不重渲染
  const user = useAuthStore(s => s.user)

  // is_admin：布尔值，null/未登录时退化为 false（最小权限原则）
  const isAdmin = user?.is_admin ?? false

  // 根据 isAdmin 过滤 tab 列表：admin 看全部，普通用户过滤掉 adminOnly 项
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="h-full flex">
      {/* ── 左侧 Tab ── */}
      <aside className="w-[220px] shrink-0 border-r overflow-y-auto py-4 px-2">
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

        <div className="px-3 pb-2 text-[12px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          设置
        </div>

        <nav className="space-y-0.5">
          {visibleTabs.map(t => {
            const Icon = t.icon
            return (
              <NavLink
                key={t.to}
                to={t.to}
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
        <Outlet />
      </main>
    </div>
  )
}
