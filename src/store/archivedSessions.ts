/**
 * src/store/archivedSessions.ts
 *
 * 归档 session 列表 store（跨工程汇总）。
 *
 * 与 sessionsStore 是独立的两个 store：
 *   - sessionsStore: 活动 sessions，按 project_id 分桶（sidebar 用）
 *   - archivedSessionStore: 归档 sessions，跨工程汇总（Settings 归档页用）
 *
 * 不 persist（每次进归档页都重拉，保证看到最新状态）。
 *
 * 设计：[[会话归档-设计]] §7.4。
 */
import { create } from 'zustand'

import {
  listArchivedSessions,
  unarchiveSession as apiUnarchive,
  deleteSession as apiDelete,
} from '@/api/sessions'
import type { ArchivedByProject } from '@/types/session'

interface ArchivedSessionStore {
  /** 按工程分组的归档列表。空数组 = 无归档。 */
  byProject: ArchivedByProject[]
  isLoading: boolean
  error: string | null

  /** 拉取当前用户全部归档。每次进入归档页都调一次。 */
  fetchAll: () => Promise<void>
  /** 恢复一个归档 session：调 unarchive + 从本地 byProject 移除。 */
  restore: (projectId: string, sessionId: string) => Promise<void>
  /** 彻底删除一个归档 session：调 DELETE + 从本地 byProject 移除。 */
  permanentDelete: (projectId: string, sessionId: string) => Promise<void>
  /** 重置（登出 / 路由离开归档页时调）。 */
  reset: () => void
}

export const useArchivedSessionStore = create<ArchivedSessionStore>((set) => ({
  byProject: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const groups = await listArchivedSessions()
      set({ byProject: groups, isLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载归档失败'
      set({ error: msg, isLoading: false })
    }
  },

  restore: async (projectId: string, sessionId: string) => {
    // 后端成功后再本地移除（失败保留 UI 状态）
    await apiUnarchive(projectId, sessionId)
    set(state => removeFromByProject(state.byProject, projectId, sessionId, true))
  },

  permanentDelete: async (projectId: string, sessionId: string) => {
    await apiDelete(projectId, sessionId)
    set(state => removeFromByProject(state.byProject, projectId, sessionId, false))
  },

  reset: () => set({ byProject: [], isLoading: false, error: null }),
}))


/**
 * 从 byProject 中移除指定 session。
 * @param removeEmptyGroups - 若 true，session 移除后若 project 的 sessions 数组变空，
 *                           则把整个 project 分组从列表中剔除（restore 用）；
 *                           若 false，保留空分组（permanentDelete 用）。
 */
function removeFromByProject(
  byProject: ArchivedByProject[],
  projectId: string,
  sessionId: string,
  removeEmptyGroups: boolean,
): { byProject: ArchivedByProject[] } {
  // 先把每个分组里的 session 过滤一遍
  const next = byProject.map(g => g.project_id === projectId
    ? { ...g, sessions: g.sessions.filter(s => s.id !== sessionId) }
    : g
  )
  // 只在 restore 时移除空分组（避免归档页出现空分组 UI）
  const result = removeEmptyGroups ? next.filter(g => g.sessions.length > 0) : next
  return { byProject: result }
}
