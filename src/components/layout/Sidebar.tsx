/**
 * src/components/layout/Sidebar.tsx
 *
 * 极简侧栏 —— 跟随 ChatGPT 风格：
 *  - 顶部：折叠按钮 + Logo
 *  - 一组动作项（新对话 / 搜索对话）
 *  - 当前工程的会话历史（不分组，按 updated_at 倒序）
 *  - 底部：设置 / 帮助 + 主题切换
 *
 * 注：因为已经有 TopBar 的工程选择器作为切工程入口，
 *     侧栏只展示当前工程的会话即可（参考 ChatGPT，不做多项目分组）。
 */
import { useEffect } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { Edit, Search, Settings, HelpCircle, Moon, Sun, PanelLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { SessionItem } from '@/components/session/SessionItem'

export function Sidebar() {
  const theme = useThemeStore(s => s.theme)
  const toggleTheme = useThemeStore(s => s.toggleTheme)
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const projects = useProjectStore(s => s.projects)
  const currentProject = projects.find(p => p.id === projectId)
  const sessionsByProject = useSessionStore(s => s.sessionsByProject)
  const fetchedProjects = useSessionStore(s => s.fetchedProjects)
  const fetchSessions = useSessionStore(s => s.fetchSessions)

  // 当前工程一切换就拉一次会话
  useEffect(() => {
    if (currentProject && !fetchedProjects.has(currentProject.id)) {
      fetchSessions(currentProject.id)
    }
  }, [currentProject, fetchedProjects, fetchSessions])

  const sessions = currentProject ? (sessionsByProject[currentProject.id] ?? []) : []

  const goNewChat = () => {
    if (projectId) navigate(`/project/${projectId}`)
  }

  return (
    <aside className="hidden lg:flex w-[260px] flex-col bg-background border-r overflow-hidden shrink-0">
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

      {/* ─── 动作组（字号 +1，全部用 text-foreground 保证暗色全亮） ─── */}
      <div className="px-2 py-1 space-y-0.5">
        <button
          type="button"
          onClick={goNewChat}
          disabled={!projectId}
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-[15px] font-medium text-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Edit className="h-[18px] w-[18px]" />
          新对话
        </button>
        <button
          type="button"
          disabled
          title="搜索对话（v1.5 上线）"
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-[15px] text-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Search className="h-[18px] w-[18px]" />
          搜索对话
        </button>
      </div>

      {/* ─── 会话历史（统一 15px + foreground） ─── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {currentProject && (
          <div className="px-3 pt-3 pb-1.5 text-[15px] font-medium text-foreground">
            {currentProject.name} 的对话
          </div>
        )}
        {!currentProject && (
          <div className="px-3 py-4 text-[15px] text-foreground text-center">
            请先在顶部选择工程
          </div>
        )}
        <ul className="space-y-0.5">
          {currentProject && sessions.length === 0 && (
            <li className="px-3 py-2 text-[15px] text-foreground">
              暂无对话
            </li>
          )}
          {currentProject && sessions.map(s => (
            <SessionItem key={s.id} session={s} project={currentProject} />
          ))}
        </ul>
      </nav>

      {/* ─── 底部：套餐 / 设置 / 帮助 + 主题 ─── */}
      <div className="border-t p-2 space-y-0.5">
        <SidebarFooterLink to="/settings" icon={Settings} label="设置" />
        <SidebarFooterLink to="/help" icon={HelpCircle} label="帮助" disabled />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 font-normal text-[15px] text-foreground"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
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
          text-[15px] text-muted-foreground cursor-not-allowed
        "
        title="v1.5 上线"
      >
        <Icon className="h-[18px] w-[18px]" />
        {label}
      </div>
    )
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[15px] transition-colors ${
          isActive ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted text-foreground'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  )
}
