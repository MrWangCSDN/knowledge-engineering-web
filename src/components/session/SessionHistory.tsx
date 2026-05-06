/**
 * src/components/session/SessionHistory.tsx
 *
 * 左侧栏的会话历史。
 *
 * 行为：
 *  - + 新对话 → /project/<currentProjectId>
 *  - 按工程分组（当前工程展开，其他折叠）
 *  - 点其他工程的会话 → 自动切工程 + 打开会话
 *  - hover 显示删除按钮
 *
 * 设计文档：[[首页设计]] §3.4
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, FolderClosed } from 'lucide-react'

import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { SessionItem } from './SessionItem'

export function SessionHistory() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const projects = useProjectStore(s => s.projects)
  const sessionsByProject = useSessionStore(s => s.sessionsByProject)
  const fetchedProjects = useSessionStore(s => s.fetchedProjects)
  const fetchSessions = useSessionStore(s => s.fetchSessions)

  // 工程列表加载完之后，给每个工程拉一次会话列表
  useEffect(() => {
    projects.forEach(p => {
      if (!fetchedProjects.has(p.id)) {
        fetchSessions(p.id)
      }
    })
  }, [projects, fetchedProjects, fetchSessions])

  const goNewChat = () => {
    if (projectId) navigate(`/project/${projectId}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* + 新对话 */}
      <div className="p-2">
        <button
          type="button"
          onClick={goNewChat}
          disabled={!projectId}
          className="
            w-full flex items-center gap-2 px-3 py-2 rounded
            border text-sm hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Plus className="h-4 w-4" />
          新对话
        </button>
      </div>

      {/* 按工程分组的会话列表 */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {projects.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">
            还没有工程
          </p>
        )}
        {projects.map(p => {
          const sessions = sessionsByProject[p.id] ?? []
          const isCurrent = p.id === projectId
          return (
            <details
              key={p.id}
              open={isCurrent}
              className="text-sm group"
            >
              <summary
                className="
                  flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer
                  text-xs font-medium uppercase tracking-wider text-muted-foreground
                  hover:bg-muted transition-colors
                "
              >
                <FolderClosed className="h-3 w-3" />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto text-[10px] opacity-50">
                  {sessions.length}
                </span>
              </summary>
              <ul className="mt-0.5 space-y-0.5 ml-1">
                {sessions.length === 0 ? (
                  <li className="text-xs text-muted-foreground px-3 py-1">
                    （暂无对话）
                  </li>
                ) : (
                  sessions.map(s => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      project={p}
                    />
                  ))
                )}
              </ul>
            </details>
          )
        })}
      </nav>
    </div>
  )
}
