/**
 * src/pages/ChatPage.tsx
 *
 * 主对话页（W5 接 chatStore + SSE 流）。
 *
 * 状态机：
 *   - 没消息且不在 streaming → 渲染 EmptyState
 *   - 有消息 / 正在 streaming → 渲染 MessageList
 *   - 错误 → 错误条 + 重试
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

  // ── URL ↔ store 同步 ──
  useEffect(() => {
    if (!projectId) return
    // URL 切了工程 → reset 对话
    if (currentProjectId && currentProjectId !== projectId) {
      startNew(projectId)
      return
    }
    if (sessionId) {
      // URL 带 sessionId → 加载该会话
      if (sessionId !== currentSessionId) {
        loadSession(projectId, sessionId)
      }
    } else {
      // URL 不带 sessionId → 新对话（如果之前有别的会话状态，清空）
      if (currentSessionId) {
        startNew(projectId)
      } else if (!currentProjectId) {
        startNew(projectId)
      }
    }
  }, [projectId, sessionId, currentProjectId, currentSessionId, loadSession, startNew])

  // ── 提交时如果切到新 session_id，更新 URL ──
  useEffect(() => {
    if (currentSessionId && projectId && !sessionId) {
      // 后端给了真实的 session_id（meta 事件），更新 URL（不阻塞 unmount）
      navigate(`/project/${projectId}/chat/${currentSessionId}`, { replace: true })
    }
  }, [currentSessionId, projectId, sessionId, navigate])

  // ── 工程加载状态 ──
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
        <h2 className="text-xl font-semibold mb-2">⚠️ 找不到工程</h2>
        <p className="text-muted-foreground text-sm mb-4">
          工程 ID <code className="bg-muted px-1 rounded">{projectId}</code> 不存在或已被删除。
        </p>
        {projects.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/project/${projects[0].id}`)}
            className="text-primary underline text-sm hover:text-primary/80"
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState project={project} onSelectQuestion={handleSend} />
        ) : (
          <MessageList messages={messages} streaming={streamingMessage} />
        )}
      </div>

      {/* 错误条（出现在输入框上方） */}
      {error && (
        <div className="max-w-3xl mx-auto w-full px-4 py-2 mb-2 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded">
          ❌ {error}
        </div>
      )}

      {/* 底部输入框 */}
      <div className="border-t p-3 bg-background">
        <ChatInput
          onSend={handleSend}
          loading={isLoading}
          onAbort={abort}
          placeholder={isEmpty ? '输入你的问题...' : '继续追问...'}
        />
      </div>
    </div>
  )
}
