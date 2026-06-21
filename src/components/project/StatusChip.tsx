/**
 * 工程状态彩色徽章。亮/暗双套（dark: 变体）。
 * 从 GroupTreeSelector 抽出，供下拉项与顶栏当前工程徽章共用。
 *
 * progress 仅 partial 时用于渲染"解读 N%"；indexing 显示"索引中"（不显示 0%，免误读为失败）。
 */
import type { ProjectStatus } from '@/types/project'

interface Props {
  status: ProjectStatus
  /** 仅 partial 时用于"解读 N%"；其它状态忽略。 */
  progress?: number
}

const MAP: Record<ProjectStatus, { label: string; cls: string }> = {
  ready: { label: '就绪', cls: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  indexing: { label: '索引中', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  partial: { label: '部分', cls: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  failed: { label: '失败', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
}

export function StatusChip({ status, progress }: Props) {
  const { label, cls } = MAP[status]
  const text = status === 'partial' && progress != null ? `解读 ${progress}%` : label
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {text}
    </span>
  )
}
