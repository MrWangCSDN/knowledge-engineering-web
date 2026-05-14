/**
 * src/pages/ChatPage.tsx
 *
 * 主对话页 — 极简风格。
 *
 * 状态机：
 *   - 没消息 → 居中 EmptyState（自带居中输入框，主区不显示底部输入框）
 *   - 有消息 / streaming → MessageList + 底部输入框
 *
 * 设计文档：[[首页设计]] §3
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useProjectStore } from '@/store/projects'
import { useChatStore } from '@/store/chat'
import { getSessionDetail } from '@/api/sessions'
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageList } from '@/components/chat/MessageList'

export function ChatPage() {
  const { projectId, sessionId } = useParams<{ projectId: string, sessionId?: string }>()
  const navigate = useNavigate()

  const projects = useProjectStore(s => s.projects)
  const isLoadingProjects = useProjectStore(s => s.isLoading)
  const project = projects.find(p => p.id === projectId)

  const messages = useChatStore(s => s.messages)
  const streamingMessage = useChatStore(s => s.streamingMessage)
  const status = useChatStore(s => s.status)
  const error = useChatStore(s => s.error)
  const sendMessage = useChatStore(s => s.sendMessage)
  const loadSession = useChatStore(s => s.loadSession)
  const startNew = useChatStore(s => s.startNew)
  const abort = useChatStore(s => s.abort)
  const currentSessionId = useChatStore(s => s.currentSessionId)
  const currentProjectId = useChatStore(s => s.currentProjectId)

  // 归档状态：本地 state 存 archived_at，null = 活动 session
  const [archivedAt, setArchivedAt] = useState<string | null | undefined>(undefined)

  // sessionId 变化时拉取 session 详情以获取 archived_at
  useEffect(() => {
    if (!projectId || !sessionId) {
      setArchivedAt(undefined)
      return
    }
    setArchivedAt(undefined) // 重置，避免残留上一个 session 的状态
    getSessionDetail(projectId, sessionId)
      .then(detail => setArchivedAt(detail.session.archived_at ?? null))
      .catch(() => setArchivedAt(null)) // 获取失败时当作未归档，不阻塞主流程
  }, [projectId, sessionId])

  // 是否归档（archived_at 非空 = 只读模式）
  const isArchived = archivedAt != null && archivedAt !== undefined

  // URL ↔ store 同步
  useEffect(() => {
    if (!projectId) return
    if (currentProjectId && currentProjectId !== projectId) {
      startNew(projectId)
      return
    }
    if (sessionId) {
      if (sessionId !== currentSessionId) loadSession(projectId, sessionId)
    } else {
      if (currentSessionId) startNew(projectId)
      else if (!currentProjectId) startNew(projectId)
    }
  }, [projectId, sessionId, currentProjectId, currentSessionId, loadSession, startNew])

  // 收到真实 session_id 后写回 URL
  // 注意：必须用 status guard，否则用户从 /chat/<sid> 点「新对话」回 /project/<pid> 时，
  // 这个 useEffect 的 closure 拿到的 currentSessionId 还是旧值（同一帧 startNew 还没 propagate）,
  // 会把 URL replace 回旧 sess，看起来「新对话」不生效。
  // 只在 SSE 流式过程中（status=submitting/streaming）才同步 URL — 这正是后端刚返 session_id 的场景。
  useEffect(() => {
    const isStreaming = status === 'streaming' || status === 'submitting'
    if (isStreaming && currentSessionId && projectId && !sessionId) {
      navigate(`/project/${projectId}/chat/${currentSessionId}`, { replace: true })
    }
  }, [currentSessionId, projectId, sessionId, status, navigate])

  // 工程未就绪 / 找不到的兜底
  if (isLoadingProjects) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">加载中…</span>
      </div>
    )
  }
  if (!project) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-medium mb-2">找不到工程</h2>
        <p className="text-muted-foreground text-sm mb-4">
          工程 ID <code className="bg-muted px-1 rounded text-xs">{projectId}</code> 不存在或已被删除。
        </p>
        {projects.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/project/${projects[0].id}`)}
            className="text-sm underline hover:no-underline"
          >
            切换到 {projects[0].name}
          </button>
        )}
      </div>
    )
  }

  const handleSend = (text: string) => {
    if (!projectId) return
    void sendMessage(projectId, text)
  }

  const isEmpty = messages.length === 0 && !streamingMessage
  const isLoading = status === 'streaming' || status === 'submitting'

  // 归档 banner（empty state 和有消息两个路径都需要，抽成变量复用）
  const archivedBanner = isArchived && (
    <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 mb-3 mx-4">
      <p className="text-sm text-foreground">
        <strong>该对话已归档</strong> — 恢复后可继续提问。
        你可以在{' '}
        <a href="/settings/archived-chats" className="underline text-primary">
          设置 → 已归档对话
        </a>{' '}
        里恢复它。
      </p>
    </div>
  )

  // 空状态 + 归档：跳过 EmptyState（它内部有 ChatInput，会产生第二个 textbox），
  // 直接渲染 banner + 一个 disabled 输入框
  if (isEmpty && isArchived) {
    return (
      <div className="h-full flex flex-col">
        {archivedBanner}
        {error && <ErrorBar message={error} />}
        <div className="flex-1" />
        <div className="px-4 py-3 bg-background">
          <ChatInput
            onSend={handleSend}
            loading={false}
            onAbort={abort}
            disabled={true}
            placeholder="该对话已归档，无法继续提问"
          />
        </div>
      </div>
    )
  }

  // 空状态（活动 session）：EmptyState 自带居中输入框，无需底部输入
  if (isEmpty) {
    return (
      <div className="h-full flex flex-col">
        {error && <ErrorBar message={error} />}
        <div className="flex-1 overflow-y-auto">
          <EmptyState
            project={project}
            onSend={handleSend}
            loading={isLoading}
            onAbort={abort}
          />
        </div>
      </div>
    )
  }

  // 有消息：列表 + 底部输入
  return (
    <div className="h-full flex flex-col">
      {archivedBanner}
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} streaming={streamingMessage} projectId={projectId} />
      </div>

      {error && <ErrorBar message={error} />}

      <div className="px-4 py-3 bg-background">
        <ChatInput
          onSend={handleSend}
          loading={isLoading}
          onAbort={abort}
          disabled={isArchived}
          placeholder={isArchived ? '该对话已归档，无法继续提问' : '继续追问...'}
        />
      </div>
    </div>
  )
}

function ErrorBar({ message }: { message: string }) {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 mt-2">
      <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
        ❌ {message}
      </div>
    </div>
  )
}
