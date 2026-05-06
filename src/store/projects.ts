/**
 * src/store/projects.ts
 *
 * 工程列表全局 store。
 *
 * 职责：
 *  - 拉取 / 缓存当前用户可访问的工程列表
 *  - 维护"当前选中工程"（顶栏选择器、URL 同步）
 *  - 提供 fetchProjects / setCurrentProject 等 actions
 *
 * 跟 auth store 的区别：不持久化（每次刷新都重新拉，保证拿到最新 indexing 进度）。
 *
 * 设计文档：[[首页设计]] §6.6
 */
import { create } from 'zustand'
import { listProjects } from '@/api/projects'
import type { Project } from '@/types/project'

interface ProjectStore {
  projects: Project[]
  /** 当前选中的工程 id；由 URL 驱动，但 store 也维护一份方便其他组件读。 */
  currentProjectId: string | null
  isLoading: boolean
  error: string | null

  // ─── actions ───
  /** 拉取列表。每次进入 ChatPage / 顶栏挂载时都应该调一次。 */
  fetchProjects: () => Promise<void>
  /** 设置当前工程；通常由 URL 变化驱动（useEffect 监听 useParams）。 */
  setCurrentProject: (id: string | null) => void
  /** 清空 store（登出时调）。 */
  reset: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await listProjects()
      set({ projects, isLoading: false })

      // 兜底：如果当前还没选工程而列表非空，自动选第一个 ready 状态的
      // （只用 ready 是为避免 default 选到 indexing/failed 卡住用户）
      if (!get().currentProjectId) {
        const firstReady = projects.find(p => p.status === 'ready')
        const fallback = firstReady ?? projects[0]
        if (fallback) set({ currentProjectId: fallback.id })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载工程失败'
      set({ error: msg, isLoading: false })
    }
  },

  setCurrentProject: (id: string | null) => {
    set({ currentProjectId: id })
  },

  reset: () => {
    set({ projects: [], currentProjectId: null, isLoading: false, error: null })
  },
}))
