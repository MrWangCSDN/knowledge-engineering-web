/**
 * hover 卡片内容：按工程 status 生成可读说明。
 * 文案与设计文档 §5 表一致；eta_seconds<=0 时不显示"约 X 分钟"。
 */
import type { Project } from '@/types/project'

interface Props {
  project: Project
}

function etaText(eta: number | undefined): string {
  if (eta == null || eta <= 0) return ''
  const mins = Math.max(1, Math.round(eta / 60))
  return `，约 ${mins} 分钟`
}

export function ProjectStatusDetail({ project }: Props) {
  let body: string
  switch (project.status) {
    case 'indexing': {
      const pct = project.indexing_progress?.percent ?? 0
      body = `正在索引代码 · 进度 ${pct}%。索引完成前暂不可提问，完成后会自动通知${etaText(project.indexing_progress?.eta_seconds)}。`
      break
    }
    case 'partial': {
      const progress = project.stats.interpretation_progress
      body = `解读进行中（${progress}%）· 已有数据可回答，但部分内容尚未解读，回答可能不完整。`
      break
    }
    case 'failed':
      body = '索引失败，请联系管理员重试。'
      break
    default:
      body = '工程已就绪。'
  }
  return (
    <div className="text-[13px] leading-relaxed text-foreground/90">
      <p className="font-medium mb-1">{project.name}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  )
}
