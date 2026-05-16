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
import {
  listSessions,
  deleteSession as apiDeleteSession,
  archiveSession as apiArchiveSession,
  unarchiveSession as apiUnarchiveSession,
  renameSession as apiRenameSession,
} from '@/api/sessions'
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
  /** 归档单个 session：调后端 + 本地从 sessionsByProject 移除。 */
  archiveSession: (projectId: string, sessionId: string) => Promise<void>
  /** 取消归档：调后端；返回后 sidebar 端通常需要 fetchSessions 刷新。 */
  unarchiveSession: (projectId: string, sessionId: string) => Promise<void>
  /** SSE 流完成时由 chatStore 调，把新创建的 session 插到顶部。 */
  prependSession: (session: Session) => void
  /** SSE session_title 事件用：直接改某 session 标题（不调 API）。 */
  updateSessionTitle: (sessionId: string, title: string) => void
  /** 用户手动重命名：乐观更新 + 调 API，失败回滚。 */
  renameSession: (projectId: string, sessionId: string, title: string) => Promise<void>
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

  archiveSession: async (projectId: string, sessionId: string) => {
    // 后端成功后才本地移除（保证失败时 sidebar 仍能看到）
    await apiArchiveSession(projectId, sessionId)
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

  unarchiveSession: async (projectId: string, sessionId: string) => {
    // 仅调后端；本地是否注入由调用方决定（归档页恢复 → 触发 fetchSessions 拉一遍）
    await apiUnarchiveSession(projectId, sessionId)
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

  updateSessionTitle: (sessionId, title) => {
    set(state => {
      const next: Record<string, Session[]> = {}
      // 跨所有 project 桶找到该 session 改 title（不依赖调用方知道 projectId）
      for (const [pid, list] of Object.entries(state.sessionsByProject)) {
        next[pid] = list.map(s => (s.id === sessionId ? { ...s, title } : s))
      }
      return { sessionsByProject: next }
    })
  },

  renameSession: async (projectId, sessionId, title) => {
    // 存旧标题用于回滚（zustand 允许在 action 内自引用 getState 读当前值）
    const prev = useSessionStore
      .getState()
      .sessionsByProject[projectId]?.find(s => s.id === sessionId)?.title
    // 乐观更新
    set(state => ({
      sessionsByProject: {
        ...state.sessionsByProject,
        [projectId]: (state.sessionsByProject[projectId] ?? []).map(s =>
          s.id === sessionId ? { ...s, title } : s,
        ),
      },
    }))
    try {
      await apiRenameSession(projectId, sessionId, title)
    } catch (err) {
      // 回滚到旧标题
      set(state => ({
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: (state.sessionsByProject[projectId] ?? []).map(s =>
            s.id === sessionId ? { ...s, title: prev ?? s.title } : s,
          ),
        },
      }))
      throw err
    }
  },

  reset: () => {
    set({ sessionsByProject: {}, fetchedProjects: new Set(), isLoading: false, error: null })
  },
}))
