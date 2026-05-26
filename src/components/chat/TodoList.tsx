/** agent 多步任务 checklist（后端 todo_write，设计 §3.3）。状态色走 index.css token（守前端宪法）。 */
import { Circle, Loader2, CheckCircle2 } from 'lucide-react'
import type { TodoItem } from '@/types/chat'

const STATUS_ICON: Record<TodoItem['status'], { Icon: typeof Circle; cls: string; spin?: boolean }> = {
  pending: { Icon: Circle, cls: 'text-[var(--status-pending)]' },
  in_progress: { Icon: Loader2, cls: 'text-[var(--status-progress)]', spin: true },
  completed: { Icon: CheckCircle2, cls: 'text-[var(--status-done)]' },
}

export function TodoList({ todos }: { todos?: TodoItem[] }) {
  if (!todos || todos.length === 0) return null
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
      <div className="mb-1.5 font-medium text-muted-foreground">任务进度</div>
      <ul className="space-y-1">
        {todos.map((t, i) => {
          const { Icon, cls, spin } = STATUS_ICON[t.status] ?? STATUS_ICON.pending
          return (
            <li key={i} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls} ${spin ? 'animate-spin' : ''}`} />
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
