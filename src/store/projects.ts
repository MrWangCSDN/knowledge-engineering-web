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
 * 持久化策略：**仅** currentProjectId 写 localStorage（用户偏好），
 * projects 列表每次刷新重新拉（保证拿到最新 indexing 进度 + 权限变更）。
 *
 * 设计文档：[[首页设计]] §6.6
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { listProjects } from '@/api/projects'
import type { Project } from '@/types/project'

interface ProjectStore {
  projects: Project[]
  /** 当前选中的工程 id；由 URL 驱动 + 持久化到 localStorage。 */
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

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      isLoading: false,
      error: null,

      fetchProjects: async () => {
        set({ isLoading: true, error: null })
        try {
          const projects = await listProjects()
          set({ projects, isLoading: false })

          // 兜底：currentProjectId 缺失 / 已不在新列表（权限被撤 / 工程被删
          // / localStorage 持久化的 id 已过期）→ 选首个 ready，否则任一非空。
          // 只用 ready 是为避免 default 选到 indexing/failed 卡住用户。
          const current = get().currentProjectId
          const stillValid = current !== null && projects.some(p => p.id === current)
          if (!stillValid) {
            const firstReady = projects.find(p => p.status === 'ready')
            const fallback = firstReady ?? projects[0]
            set({ currentProjectId: fallback?.id ?? null })
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
        // 注意：保留 currentProjectId persist（同一用户重新登录会回到上次工程）
        // 如要彻底清除偏好，调用方需另调 localStorage.removeItem
        set({ projects: [], isLoading: false, error: null })
      },
    }),
    {
      name: 'ke-project-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化 currentProjectId — projects 列表每次刷新重拉，
      // 否则会带回过期 projects（含已无权限的）覆盖真实 server 数据
      partialize: (state) => ({ currentProjectId: state.currentProjectId }),
    },
  ),
)
