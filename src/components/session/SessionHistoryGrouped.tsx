/**
 * src/components/session/SessionHistoryGrouped.tsx
 *
 * Sidebar 中段主组件。
 *
 * 三层结构：「最近 → 工程 → session」
 *  - 顶部 RecentHeader 控制整组折叠
 *  - 中间按 max(session.updated_at) 倒序的 ProjectGroup 列表
 *  - 只显示有 session 的工程（设计 §3 决策 8）
 *
 * 设计：[[会话历史层级化-设计]] §4, §6
 */
import { useEffect, useMemo } from 'react'

import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { useSidebarStore } from '@/store/sidebar'
import { RecentHeader } from './RecentHeader'
import { ProjectGroup } from './ProjectGroup'

export function SessionHistoryGrouped() {
  // 顶层折叠状态
  const recentExpanded = useSidebarStore(s => s.recentExpanded)
  // 数据源
  const projects = useProjectStore(s => s.projects)
  const sessionsByProject = useSessionStore(s => s.sessionsByProject)
  const fetchedProjects = useSessionStore(s => s.fetchedProjects)
  const fetchSessions = useSessionStore(s => s.fetchSessions)

  // mount + projects 变化时给每个未拉过的工程拉一次 sessions（沿用旧 SessionHistory 的模式）
  useEffect(() => {
    projects.forEach(p => {
      if (!fetchedProjects.has(p.id)) {
        fetchSessions(p.id)
      }
    })
  }, [projects, fetchedProjects, fetchSessions])

  // 派生：排序后的工程列表（过滤 + 排序），不污染 store
  const sortedProjects = useMemo(() => {
    return projects
      .map(p => {
        const sessions = sessionsByProject[p.id] ?? []
        // max(session.updated_at) 作为该工程"最后活跃时间"；没 session 则为 0
        const lastActive = sessions.length > 0
          ? Math.max(...sessions.map(s => new Date(s.updated_at).getTime()))
          : 0
        return { project: p, sessions, lastActive }
      })
      .filter(x => x.sessions.length > 0)  // 决策 8：只显示有 session 的工程
      .sort((a, b) => b.lastActive - a.lastActive)  // 决策 7：倒序
  }, [projects, sessionsByProject])

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-2">
      <RecentHeader />

      {/* 顶层折叠时不渲染下面任何工程 */}
      {recentExpanded && (
        <>
          {sortedProjects.length === 0 ? (
            <p className="px-3 py-4 text-sm text-sidebar-muted-foreground text-center">
              还没有对话历史 — 点上方「+ 新对话」开始
            </p>
          ) : (
            <div className="mt-1 space-y-1">
              {sortedProjects.map(({ project, sessions }) => (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  sessions={sessions}
                />
              ))}
            </div>
          )}
        </>
      )}
    </nav>
  )
}
