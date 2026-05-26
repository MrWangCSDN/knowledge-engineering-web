/** agent 多步任务 checklist（后端 todo_write，设计 §3.3）。状态色走 index.css token（守前端宪法）。 */
import { Circle, Loader2, CheckCircle2 } from 'lucide-react'
import type { TodoItem } from '@/types/chat'

const STATUS_ICON: Record<TodoItem['status'], { Icon: typeof Circle; cls: string; label: string; spin?: boolean }> = {
  pending: { Icon: Circle, cls: 'text-[var(--status-pending)]', label: '待处理' },
  in_progress: { Icon: Loader2, cls: 'text-[var(--status-progress)]', label: '进行中', spin: true },
  completed: { Icon: CheckCircle2, cls: 'text-[var(--status-done)]', label: '已完成' },
}

export function TodoList({ todos }: { todos?: TodoItem[] }) {
  if (!todos || todos.length === 0) return null
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
      <div className="mb-1.5 font-medium text-muted-foreground">任务进度</div>
      <ul className="space-y-1">
        {todos.map((t, i) => {
          const { Icon, cls, label, spin } = STATUS_ICON[t.status] ?? STATUS_ICON.pending
          return (
            <li key={i} className="flex items-start gap-2">
              {/* 图标纯装饰（aria-hidden）；状态由下方 sr-only 文本传达给读屏（不靠颜色/图标）*/}
              <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${cls} ${spin ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              <span className="sr-only">{label}</span>
              <span className={t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground/85'}>
                {t.content}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
