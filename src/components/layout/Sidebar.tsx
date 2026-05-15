/**
 * src/components/layout/Sidebar.tsx
 *
 * 极简侧栏 —— 跟随 ChatGPT 风格：
 *  - 顶部：折叠按钮 + Logo
 *  - 一组动作项（新对话 / 搜索对话）
 *  - 会话历史：三层折叠树（最近 → 工程 → session），由 SessionHistoryGrouped 负责
 *  - 底部：设置 / 帮助 + 主题切换
 *
 * 设计：[[会话历史层级化-设计]] §4
 */
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { Edit, Search, Settings, HelpCircle, Moon, Sun, PanelLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { SessionHistoryGrouped } from '@/components/session/SessionHistoryGrouped'

export function Sidebar() {
  const theme = useThemeStore(s => s.theme)
  const toggleTheme = useThemeStore(s => s.toggleTheme)
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  // sessions 拉取 / 排序 / 过滤都交给 SessionHistoryGrouped

  const goNewChat = () => {
    if (projectId) navigate(`/project/${projectId}`)
  }

  return (
    <aside className="hidden lg:flex w-[260px] flex-col bg-sidebar text-sidebar-foreground border-r overflow-hidden shrink-0">
      {/* ─── 顶部 header：logo + 折叠按钮（hover 效果对齐） ─── */}
      <div className="h-12 flex items-center justify-between px-2 shrink-0">
        <Link
          to="/"
          aria-label="KE 首页"
          className="
            flex items-center p-1.5 rounded
            hover:bg-muted transition-colors
          "
        >
          <img
            src="/logo-icon.png"
            alt="KE"
            draggable={false}
            className="h-5 w-auto select-none block dark:hidden"
          />
          <img
            src="/logo-icon-white.png"
            alt="KE"
            draggable={false}
            className="h-5 w-auto select-none hidden dark:block"
          />
        </Link>
        <button
          type="button"
          aria-label="折叠侧栏"
          title="折叠侧栏（v1.5）"
          disabled
          className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      {/* ─── 动作组（ChatGPT 对齐：text-sm regular + 16px icon，密度更紧凑） ─── */}
      <div className="px-2 py-1 space-y-0.5">
        <button
          type="button"
          onClick={goNewChat}
          disabled={!projectId}
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-sm text-sidebar-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Edit className="h-4 w-4" />
          新对话
        </button>
        <button
          type="button"
          disabled
          title="搜索对话（v1.5 上线）"
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-sm text-sidebar-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Search className="h-4 w-4" />
          搜索对话
        </button>
      </div>

      {/* ─── 会话历史（三层折叠树，v1.5）─── */}
      <SessionHistoryGrouped />

      {/* ─── 底部：套餐 / 设置 / 帮助 + 主题（字号统一 text-sm，与 ChatGPT 对齐） ─── */}
      <div className="border-t p-2 space-y-0.5">
        <SidebarFooterLink to="/settings" icon={Settings} label="设置" />
        <SidebarFooterLink to="/help" icon={HelpCircle} label="帮助" disabled />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 font-normal text-sm text-sidebar-foreground"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? '亮色模式' : '暗色模式'}</span>
        </Button>
      </div>
    </aside>
  )
}

function SidebarFooterLink({
  to,
  icon: Icon,
  label,
  disabled,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
}) {
  if (disabled) {
    return (
      <div
        className="
          flex items-center gap-2.5 px-3 py-2 rounded-lg
          text-sm text-sidebar-muted-foreground cursor-not-allowed
        "
        title="v1.5 上线"
      >
        <Icon className="h-4 w-4" />
        {label}
      </div>
    )
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-muted font-medium text-sidebar-foreground'
            : 'hover:bg-muted text-sidebar-foreground'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  )
}
