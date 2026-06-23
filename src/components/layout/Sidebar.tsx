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
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Edit, Search, PanelLeft } from 'lucide-react'

import { UserMenu } from '@/components/auth/UserMenu'
import { SessionHistoryGrouped } from '@/components/session/SessionHistoryGrouped'

export function Sidebar() {
  const navigate = useNavigate()
  // 拿 projectId + sessionId：URL 有 projectId 但无 sessionId = 在「新对话」EmptyState
  // 此时「新对话」按钮 active；进入某个 session 后 active 转移到对应 SessionItem
  const { projectId, sessionId } = useParams<{ projectId: string; sessionId?: string }>()
  const isNewChatActive = !!projectId && !sessionId

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
          // active 态视觉与 SessionItem 选中对齐：bg-foreground/10 加深背景 + font-medium
          // 不加 border-l（"新对话" 是 action 按钮非 list item，左色条视觉不自然）
          className={`
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-sm text-sidebar-foreground transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isNewChatActive
              ? 'bg-foreground/10 font-medium'
              : 'hover:bg-muted'
            }
          `}
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

      {/* ─── 底部：ChatGPT 式账号菜单（设置/帮助/主题/登出都在弹窗里）─── */}
      <div className="border-t p-2">
        {/* UserMenu：radix DropdownMenu，向上弹出，撑满侧栏宽度 */}
        <UserMenu />
      </div>
    </aside>
  )
}
