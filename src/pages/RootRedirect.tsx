/**
 * src/pages/RootRedirect.tsx
 *
 * `/` 入口逻辑：
 *  - 工程列表加载中 → loading
 *  - 列表为空 → 显示"还没有工程"提示（admin 看到 + CLI 提示）
 *  - 否则 → redirect 到 /project/<currentProjectId 或 first-ready>
 */
import { Navigate } from 'react-router-dom'
import { useProjectStore } from '@/store/projects'
import { useAuthStore } from '@/store/auth'

export function RootRedirect() {
  const projects = useProjectStore(s => s.projects)
  const currentProjectId = useProjectStore(s => s.currentProjectId)
  const lastSessionByProject = useProjectStore(s => s.lastSessionByProject)
  const isLoading = useProjectStore(s => s.isLoading)
  const user = useAuthStore(s => s.user)

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">加载工程列表…</span>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h2 className="text-xl font-semibold mb-2">👋 欢迎使用 KE</h2>
        <p className="text-muted-foreground text-sm mb-4">
          还没有工程被索引。
        </p>
        {user?.is_admin ? (
          <div className="bg-muted p-4 rounded text-left text-sm">
            <p className="font-medium mb-2">管理员，使用 CLI 添加第一个工程：</p>
            <code className="block bg-background p-2 rounded text-xs">
              ke-admin project create \<br />
              &nbsp;&nbsp;--id deposit-system \<br />
              &nbsp;&nbsp;--name "存款系统" \<br />
              &nbsp;&nbsp;--repo /path/to/code
            </code>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">请联系管理员添加工程。</p>
        )}
      </div>
    )
  }

  // 优先用 store 的 currentProjectId，回退到第一个
  const targetId = currentProjectId ?? projects[0].id
  // 2026-05-22：恢复上次 session（ChatGPT 同款体验）— 若该工程有 lastSession 记录就直接跳进去
  // session 已被删 / user_id 不匹配 → ChatPage.loadSession 拿 404 自动 fallback 到 /project/{id}
  const lastSid = lastSessionByProject[targetId]
  if (lastSid) {
    return <Navigate to={`/project/${targetId}/chat/${lastSid}`} replace />
  }
  return <Navigate to={`/project/${targetId}`} replace />
}
