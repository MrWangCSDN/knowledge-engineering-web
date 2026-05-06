/**
 * src/components/chat/EmptyState.tsx
 *
 * 空状态（无对话时）：
 *   - 工程统计欢迎语（共 X 方法 · 解读完成度 Y%）
 *   - 3 条可点击示例问题
 *
 * 设计文档：[[首页设计]] §3.2 状态 A
 */
import type { Project } from '@/types/project'
import { SuggestedQuestions } from './SuggestedQuestions'

const SAMPLE_QUESTIONS = [
  { icon: '💰', text: '存款开户的设计逻辑是怎样的？' },
  { icon: '🏭', text: '产品工厂是怎么实现的？' },
  { icon: '🔀', text: 'OrderService 的调用链路' },
]

interface Props {
  project: Project
  onSelectQuestion: (text: string) => void
}

export function EmptyState({ project, onSelectQuestion }: Props) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center">
      <h2 className="text-2xl font-semibold">
        👋 你好，正在分析 [{project.name}]
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">
        共 <strong>{project.stats.methods_count}</strong> 个方法 ·
        解读完成度 <strong>{project.stats.interpretation_progress}%</strong>
      </p>
      {project.pipeline_at && (
        <p className="text-xs text-muted-foreground mt-1">
          最新于 {formatRelativeTime(project.pipeline_at)}
        </p>
      )}

      <div className="my-8 text-sm text-muted-foreground">─── 试试问问看 ───</div>

      <SuggestedQuestions questions={SAMPLE_QUESTIONS} onSelect={onSelectQuestion} />
    </div>
  )
}

/** 简单的"几小时前 / 几天前"显示。完整 dayjs/date-fns 留 W6 再加。 */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}
