/**
 * 顶栏当前工程状态徽章 + hover 详情卡片。
 * 渲染规则：flag 关 / 无工程 / ready → null（顶栏只在"有事要说"时出现）。
 */
import type { Project } from '@/types/project'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import { StatusChip } from './StatusChip'
import { ProjectStatusDetail } from './ProjectStatusDetail'

interface Props {
  project: Project | undefined
  enabled: boolean
}

export function CurrentProjectStatus({ project, enabled }: Props) {
  if (!enabled || !project || project.status === 'ready') return null
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-flex items-center" aria-label="工程状态">
          <StatusChip status={project.status} progress={project.stats.interpretation_progress} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent>
        <ProjectStatusDetail project={project} />
      </HoverCardContent>
    </HoverCard>
  )
}
