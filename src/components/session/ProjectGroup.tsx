/**
 * src/components/session/ProjectGroup.tsx
 *
 * 单个工程的折叠组：工程名（折叠头）+ session 列表。
 *
 * 点工程名行 → 仅 toggle 折叠（不切工程，设计 §3 决策 3）。
 * 点 session 项 → 由 SessionItem 负责 navigate（设计 §7）。
 *
 * 设计：[[会话历史层级化-设计]] §4
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar'
import { SessionItem } from './SessionItem'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

interface Props {
  project: Project
  sessions: Session[]
}

export function ProjectGroup({ project, sessions }: Props) {
  // 当前工程的展开状态（含 undefined → true 兜底）
  const isExpanded = useSidebarStore(s => s.isProjectExpanded(project.id))
  const toggleProject = useSidebarStore(s => s.toggleProject)

  return (
    <div className="text-sm">
      {/* 工程名行（点击 toggle，不切工程） */}
      <button
        type="button"
        onClick={() => toggleProject(project.id)}
        aria-expanded={isExpanded}
        // 字体规格（v3，2026-05-15）：用 sidebar-foreground 跟随 sidebar 主题
        className="
          w-full flex items-center gap-1 px-3 py-1.5
          text-sm font-medium text-sidebar-foreground
          hover:bg-muted rounded transition-colors
        "
      >
        {isExpanded ? (
          <ChevronDown
            data-testid={`project-${project.id}-chevron-down`}
            className="h-3.5 w-3.5 text-sidebar-muted-foreground"
          />
        ) : (
          <ChevronRight
            data-testid={`project-${project.id}-chevron-right`}
            className="h-3.5 w-3.5 text-sidebar-muted-foreground"
          />
        )}
        <span className="truncate">{project.name}</span>
      </button>

      {/* 展开时渲染 sessions 列表 */}
      {isExpanded && (
        <ul className="space-y-0.5">
          {sessions.map(s => (
            <SessionItem key={s.id} session={s} project={project} />
          ))}
        </ul>
      )}
    </div>
  )
}
