/**
 * src/components/session/SessionItem.tsx
 *
 * 单个会话条目。点击切到该会话；hover 右侧「⋯」按钮打开 SessionMenu（归档 / 删除）。
 *
 * 设计文档：[[首页设计]] §3.4，[[会话归档-设计]] §8.1, §8.5
 */
import { useNavigate, useParams } from 'react-router-dom'

import { useSessionStore } from '@/store/sessions'
import { SessionMenu } from './SessionMenu'
import type { Session } from '@/types/session'
import type { Project } from '@/types/project'

interface Props {
  session: Session
  project: Project
}

export function SessionItem({ session, project }: Props) {
  const navigate = useNavigate()
  const { sessionId: currentSessionId } = useParams<{ sessionId?: string }>()
  const archive = useSessionStore(s => s.archiveSession)
  const deleteSession = useSessionStore(s => s.deleteSession)

  const isActive = currentSessionId === session.id

  const onClick = () => {
    // 切到对应工程的对应会话
    navigate(`/project/${project.id}/chat/${session.id}`)
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
        className={`
          group flex items-center gap-1 px-3 py-2 rounded-lg cursor-pointer
          text-[13px] transition-colors
          ${isActive
            ? 'bg-muted text-foreground font-medium'
            : 'hover:bg-muted text-foreground'
          }
        `}
      >
        <span className="flex-1 truncate" title={session.title}>
          {session.title || '(无标题)'}
        </span>

        {/* 替换旧 Trash 按钮 + 二次确认为 SessionMenu（设计 §8.1） */}
        <SessionMenu
          onArchive={async () => {
            try {
              await archive(project.id, session.id)
              // 归档的是当前 active session → 跳回工程主页（设计 §8.5）
              if (isActive) {
                navigate(`/project/${project.id}`)
              }
            } catch {
              // 失败时静默 — store 已保留状态；后续可加 toast
            }
          }}
          onDelete={async () => {
            if (!window.confirm('确认删除该对话？此操作不可恢复。')) return
            try {
              await deleteSession(project.id, session.id)
              if (isActive) navigate(`/project/${project.id}`)
            } catch {
              // 静默
            }
          }}
        />
      </div>
    </li>
  )
}
