/**
 * src/components/session/SessionItem.tsx
 *
 * 单个会话条目。点击切到该会话；hover 显示删除按钮。
 *
 * 设计文档：[[首页设计]] §3.4
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'

import { useSessionStore } from '@/store/sessions'
import type { Session } from '@/types/session'
import type { Project } from '@/types/project'

interface Props {
  session: Session
  project: Project
}

export function SessionItem({ session, project }: Props) {
  const navigate = useNavigate()
  const { sessionId: currentSessionId } = useParams<{ sessionId?: string }>()
  const deleteSession = useSessionStore(s => s.deleteSession)
  const [confirming, setConfirming] = useState(false)

  const isActive = currentSessionId === session.id

  const onClick = () => {
    // 切到对应工程的对应会话
    navigate(`/project/${project.id}/chat/${session.id}`)
  }

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirming) {
      setConfirming(true)
      // 3 秒后自动取消确认状态
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    await deleteSession(project.id, session.id)
    setConfirming(false)
    // 如果删的是当前正在看的会话，跳回工程主页
    if (isActive) {
      navigate(`/project/${project.id}`)
    }
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
        className={`
          group flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer
          text-xs transition-colors
          ${isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }
        `}
      >
        <span className="flex-1 truncate" title={session.title}>
          {session.title || '(无标题)'}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label={confirming ? '确认删除' : '删除'}
          title={confirming ? '再次点击确认删除' : '删除'}
          className={`
            shrink-0 p-1 rounded
            ${confirming
              ? 'text-destructive opacity-100'
              : 'opacity-0 group-hover:opacity-50 hover:opacity-100 hover:text-destructive'
            }
          `}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  )
}
