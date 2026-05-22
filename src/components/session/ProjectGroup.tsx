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
    <div>
      {/* 工程名行（点击 toggle，不切工程）
          字体规格（v4，2026-05-21）：层级中位
            - text-[13px] 比"最近"(text-sm=14px)小一档
            - font-medium 弱于"最近"的 font-semibold
            - px-4 缩进比"最近"(px-2)深一级（视觉层级感）*/}
      <button
        type="button"
        onClick={() => toggleProject(project.id)}
        aria-expanded={isExpanded}
        className="
          w-full flex items-center gap-1 px-4 py-1.5
          text-[13px] font-medium text-sidebar-foreground
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

      {/* 展开时渲染 sessions 列表 — ul pl-3 让 session 整体再缩进一级（最深） */}
      {isExpanded && (
        <ul className="space-y-0.5 pl-3">
          {sessions.map(s => (
            <SessionItem key={s.id} session={s} project={project} />
          ))}
        </ul>
      )}
    </div>
  )
}
