/**
 * src/pages/ChatPage.tsx
 *
 * 主对话页（v1 起步版本）。
 *
 * W4：仅静态布局 — EmptyState 显示工程信息 + 示例问题；输入框收发事件。
 * W5：接入 useSSEStream + ChatStore，渲染流式答案。
 * W6：SectionRenderer 6 段式 + 实体链接。
 *
 * 设计文档：[[首页设计]] §3
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/store/projects'
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const projects = useProjectStore(s => s.projects)
  const isLoading = useProjectStore(s => s.isLoading)
  const project = projects.find(p => p.id === projectId)

  // 工程列表还没加载（首次进入）
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">加载中…</span>
      </div>
    )
  }

  // 工程列表加载完了但没找到（URL 写错或工程被删）
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

  // W4 暂用 console.log 占位；W5 接 chatStore.sendMessage
  const handleSend = (text: string) => {
    console.info('[chat] send:', text)
    // TODO(W5): chatStore.sendMessage(projectId, text) → start SSE stream
  }

  return (
    <div className="h-full flex flex-col">
      {/* 上半部：消息区（v1 暂时只渲染 EmptyState） */}
      <div className="flex-1 overflow-y-auto">
        <EmptyState project={project} onSelectQuestion={handleSend} />
      </div>

      {/* 底部：输入框 */}
      <div className="border-t p-3 bg-background">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  )
}
