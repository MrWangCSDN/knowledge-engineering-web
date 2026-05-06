/**
 * src/components/project/ProjectStatusBadge.tsx
 *
 * 显示工程状态徽章（💚 就绪 / 🟡 索引中 / 🟠 部分就绪 / 🔴 失败）。
 *
 * 用在：
 *  - 顶栏 ProjectSwitcher 下拉项
 *  - 顶栏 banner（当前工程状态提示）
 *
 * 设计文档：[[首页设计]] §4.3
 */
import type { ProjectStatus } from '@/types/project'

interface Props {
  status: ProjectStatus
  /** 仅 status='indexing' 时有意义；显示 "进度 X%"。 */
  progress?: number
}

const STATUS_CONFIG: Record<ProjectStatus, { icon: string; label: string; color: string }> = {
  ready:    { icon: '💚', label: '就绪',     color: 'text-emerald-500' },
  indexing: { icon: '🟡', label: '索引中',   color: 'text-amber-500'   },
  partial:  { icon: '🟠', label: '部分就绪', color: 'text-orange-500'  },
  failed:   { icon: '🔴', label: '索引失败', color: 'text-red-500'     },
}

export function ProjectStatusBadge({ status, progress }: Props) {
  const cfg = STATUS_CONFIG[status]
  const text = status === 'indexing' && progress != null
    ? `${cfg.label} · 进度 ${progress}%`
    : cfg.label
  return (
    <span className={`text-xs ${cfg.color}`}>
      {cfg.icon} {text}
    </span>
  )
}
