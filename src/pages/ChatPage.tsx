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
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useProjectStore } from '@/store/projects'
import { useChatStore } from '@/store/chat'
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
  useEffect(() => {
    if (currentSessionId && projectId && !sessionId) {
      navigate(`/project/${projectId}/chat/${currentSessionId}`, { replace: true })
    }
  }, [currentSessionId, projectId, sessionId, navigate])

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

  // 空状态：EmptyState 自带居中输入框，无需底部输入
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
      <div className="flex-1 overflow-y-auto">
        <MessageList messages={messages} streaming={streamingMessage} />
      </div>

      {error && <ErrorBar message={error} />}

      <div className="px-4 py-3 bg-background">
        <ChatInput
          onSend={handleSend}
          loading={isLoading}
          onAbort={abort}
          placeholder="继续追问..."
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
