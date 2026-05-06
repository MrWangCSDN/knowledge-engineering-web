/**
 * src/store/sessions.ts
 *
 * 会话历史 store。
 *
 * 数据按 project_id 分桶（左栏按工程分组展示）。
 * 不持久化（每次刷新重新拉，确保 message_count 等字段最新）。
 *
 * 设计文档：[[首页设计]] §6.6
 */
import { create } from 'zustand'
import { listSessions, deleteSession as apiDeleteSession } from '@/api/sessions'
import type { Session } from '@/types/session'

interface SessionStore {
  /** 按 project_id 分组的会话列表。 */
  sessionsByProject: Record<string, Session[]>
  /** 标记每个 project 是否已经请求过（避免重复请求）。 */
  fetchedProjects: Set<string>
  isLoading: boolean
  error: string | null

  // ─── actions ───
  /** 拉取指定工程的会话列表（如果已经拉过，强制刷新）。 */
  fetchSessions: (projectId: string) => Promise<void>
  /** 删除会话；调后端 + 同步 store。 */
  deleteSession: (projectId: string, sessionId: string) => Promise<void>
  /** SSE 流完成时由 chatStore 调，把新创建的 session 插到顶部。 */
  prependSession: (session: Session) => void
  /** 清空（登出 / 切工程时）。 */
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessionsByProject: {},
  fetchedProjects: new Set(),
  isLoading: false,
  error: null,

  fetchSessions: async (projectId: string) => {
    set({ isLoading: true, error: null })
    try {
      const sessions = await listSessions(projectId)
      set(state => ({
        sessionsByProject: { ...state.sessionsByProject, [projectId]: sessions },
        fetchedProjects: new Set([...state.fetchedProjects, projectId]),
        isLoading: false,
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载会话失败'
      set({ error: msg, isLoading: false })
    }
  },

  deleteSession: async (projectId: string, sessionId: string) => {
    await apiDeleteSession(projectId, sessionId)
    // 同步 store：从对应 project 桶里移除
    set(state => {
      const list = state.sessionsByProject[projectId] ?? []
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: list.filter(s => s.id !== sessionId),
        },
      }
    })
  },

  prependSession: (session: Session) => {
    set(state => {
      const list = state.sessionsByProject[session.project_id] ?? []
      // 已存在则不重复加（更新 updated_at 应该走另外的逻辑）
      if (list.some(s => s.id === session.id)) return state
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [session.project_id]: [session, ...list],
        },
      }
    })
  },

  reset: () => {
    set({ sessionsByProject: {}, fetchedProjects: new Set(), isLoading: false, error: null })
  },
}))
