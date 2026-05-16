/**
 * src/components/session/SessionItem.tsx
 *
 * 单个会话条目。点击切到该会话；hover 右侧「⋯」按钮打开 SessionMenu（归档 / 删除）。
 *
 * 设计文档：[[首页设计]] §3.4，[[会话归档-设计]] §8.1, §8.5
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useSessionStore } from '@/store/sessions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const renameSession = useSessionStore(s => s.renameSession)

  // 删除二次确认对话框开关
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  // inline 重命名编辑态 + 草稿值
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(session.title || '')

  const isActive = currentSessionId === session.id

  const onClick = () => {
    // 编辑态下点击不导航
    if (isEditing) return
    // 切到对应工程的对应会话
    navigate(`/project/${project.id}/chat/${session.id}`)
  }

  // Enter / blur 提交：空值或未改 → 放弃（恢复原标题），否则乐观更新 + 调 API
  const commitRename = async () => {
    const next = draft.trim()
    setIsEditing(false)
    if (!next || next === session.title) return
    try {
      await renameSession(project.id, session.id, next)
    } catch {
      // store 内部已回滚；这里静默（后续可加 toast）
    }
  }

  const doDelete = async () => {
    setConfirmDeleteOpen(false)
    try {
      await deleteSession(project.id, session.id)
      if (isActive) navigate(`/project/${project.id}`)
    } catch {
      // 静默
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
          group flex items-center gap-1 px-3 py-2 rounded-lg cursor-pointer
          text-sm transition-colors
          ${isActive
            ? 'bg-muted text-sidebar-foreground font-medium'
            : 'hover:bg-muted text-sidebar-foreground'
          }
        `}
      >
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setIsEditing(false) // 取消，draft 丢弃
              }
            }}
            onBlur={commitRename}
            className="flex-1 bg-transparent border-b border-primary outline-none text-sm"
          />
        ) : (
          <span className="flex-1 truncate" title={session.title}>
            {session.title || '(无标题)'}
          </span>
        )}

        {/* 替换旧 Trash 按钮 + 二次确认为 SessionMenu（设计 §8.1） */}
        <SessionMenu
          onRename={() => {
            setDraft(session.title || '')
            // 延后进入编辑态：等 radix 菜单关闭 + focus 归还 trigger 这一轮
            // 结束后再渲染 <input autoFocus>，否则焦点会被 trigger 抢走，
            // 触发 input.onBlur 立刻退出编辑（jsdom / 真实浏览器都有此竞态）。
            setTimeout(() => setIsEditing(true), 0)
          }}
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
          onDelete={() => setConfirmDeleteOpen(true)}
        />
      </div>

      {/* 统一的二次确认对话框（替代 window.confirm） */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={doDelete}
        title="确认删除该对话"
        message="此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
      />
    </li>
  )
}
