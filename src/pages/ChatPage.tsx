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
import { useParams, useNavigate, Navigate } from 'react-router-dom'

import { useProjectStore } from '@/store/projects'
import { useChatStore } from '@/store/chat'
import { getSessionDetail } from '@/api/sessions'
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageList } from '@/components/chat/MessageList'
import { ContextWindowBar } from '@/components/chat/ContextWindowBar'

export function ChatPage() {
  const { projectId, sessionId } = useParams<{ projectId: string, sessionId?: string }>()
  const navigate = useNavigate()

  const projects = useProjectStore(s => s.projects)
  const isLoadingProjects = useProjectStore(s => s.isLoading)
  const setCurrentProject = useProjectStore(s => s.setCurrentProject)
  const project = projects.find(p => p.id === projectId)

  // URL 工程 id 有效时，同步到 store（驱动 localStorage 持久化）→
  // 下次刷新 / 新 tab 打开默认进同一工程。
  useEffect(() => {
    if (project) {
      setCurrentProject(project.id)
    }
  }, [project, setCurrentProject])

  const messages = useChatStore(s => s.messages)
  const streamingMessage = useChatStore(s => s.streamingMessage)
  const status = useChatStore(s => s.status)
  const error = useChatStore(s => s.error)
  const sendMessage = useChatStore(s => s.sendMessage)
  const loadSession = useChatStore(s => s.loadSession)
  const startNew = useChatStore(s => s.startNew)
  const abort = useChatStore(s => s.abort)
  const currentSessionId = useChatStore(s => s.currentSessionId)
  // 注：useEffect 内用 useChatStore.getState().currentProjectId 直接读最新值，不通过 selector closure；
  //     因此不在此处订阅 — 删 declaration 避免 TS 报 unused（2026-05-21 修）

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

  // URL ↔ store 同步（仅响应 URL 变化，不响应 store 内部状态变化）
  //
  // 历史：deps 含 currentSessionId 会触发 race —— 新会话 sendMessage 时
  // SSE meta event 把 store.currentSessionId 从 null 设为 <new_sid>，此 useEffect
  // 被 currentSessionId 变化触发，closure 里 sessionId 还是 undef → 走 else 分支
  // 误调 startNew → 清空 messages（含已 push 的 user msg）→ done event 后只剩
  // assistant msg → 看起来 KE 回复"在用户提问之前"。
  //
  // 修：deps 去掉 currentSessionId / currentProjectId，effect 只对 URL 变化 fire；
  // 用 useChatStore.getState() 拿 store 最新值做判断，避免 closure 旧值 race。
  useEffect(() => {
    if (!projectId) return
    const live = useChatStore.getState()
    // 优先级 1：URL 有 sessionId → 总是 loadSession（不管 project 变没变）
    // 历史 bug：原代码先判 project 变化 → startNew + return → 永远跳过 loadSession
    // 复现：alice 在 proj-a 看会话 A → 点 sidebar 中 proj-b 会话 B → useEffect
    // 看 currentProjectId='proj-a' ≠ 'proj-b' → startNew('proj-b') 清空 messages → return
    // → 永远不会 loadSession('proj-b','sess_B') → 主区 EmptyState
    // 修：sessionId 存在时无条件 loadSession（loadSession 内部会重写 currentProjectId）
    if (sessionId) {
      if (sessionId !== live.currentSessionId) loadSession(projectId, sessionId)
      return
    }
    // 优先级 2：URL 无 sessionId → 仅在「project 变了」或「之前有 session 残留」时 startNew
    if (live.currentProjectId !== projectId || live.currentSessionId) {
      startNew(projectId)
    }
  }, [projectId, sessionId, loadSession, startNew])

  // 收到真实 session_id 后写回 URL
  //
  // 历史：v1.5.1 用 status guard（isStreaming）防新对话回弹 — 但快速 chit-chat
  // 流（<500ms）会让 React batch useEffect，跑时 status 已变 'idle' → skip navigate
  // → URL 不同步 → sidebar 不高亮 + 刷新页面回 EmptyState。
  //
  // 新方案：用 useChatStore.getState() 直接读 store 最新 currentSessionId，
  // 不依赖 closure 快照。这同时解决两个 race：
  // - 点「新对话」后 startNew → store.currentSessionId=null → skip navigate ✓
  // - 快速 streaming 后 currentSessionId 已 set → 拿到最新值 navigate ✓
  useEffect(() => {
    const liveSessionId = useChatStore.getState().currentSessionId
    // 方向 ①：store 有 / URL 无 → 回填（新会话拿到真 sid 后写回 URL）
    if (liveSessionId && projectId && !sessionId) {
      navigate(`/project/${projectId}/chat/${liveSessionId}`, { replace: true })
      return
    }
    // 方向 ②：URL 有 / store 无 + status='idle'（loadSession 已结束）→ URL 无效
    // 复现：切账号后浏览器还停在 /chat/sess_old_alice URL → bob 登录 → loadSession 拿 404
    // → store 清空 currentSessionId/messages → URL 依然指向无效 sid → 主区显示错误 banner
    // 修：把 URL 的尾巴去掉，回到 /project/{projectId} EmptyState
    if (sessionId && !liveSessionId && projectId && status === 'idle') {
      navigate(`/project/${projectId}`, { replace: true })
    }
  }, [currentSessionId, projectId, sessionId, navigate, status])

  // 工程未就绪 / 找不到的兜底
  if (isLoadingProjects) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">加载中…</span>
      </div>
    )
  }
  if (!project) {
    // URL 工程 id 无效（权限被撤 / 工程被删 / localStorage 过期）：
    // 有可访问工程 → 自动跳到 store 当前选择（fetchProjects 已兜底为有效项）
    // 没有可访问工程 → 提示无工程（admin 可去 CLI 创建）
    if (projects.length > 0) {
      // store.currentProjectId 由 fetchProjects 校验过是有效项；fallback 到首项
      const fallbackId = useProjectStore.getState().currentProjectId ?? projects[0].id
      return <Navigate to={`/project/${fallbackId}`} replace />
    }
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-medium mb-2">没有可访问的工程</h2>
        <p className="text-muted-foreground text-sm mb-4">
          你目前没有任何工程的访问权限，请联系管理员。
        </p>
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
        <ContextWindowBar />
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
