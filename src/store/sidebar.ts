/**
 * src/store/sidebar.ts
 *
 * Sidebar 折叠状态（最近 / 工程 两层），持久化到 localStorage。
 *
 * 设计：[[会话历史层级化-设计]] §6.1
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 描述折叠状态的最小接口
interface SidebarState {
  /** 「最近」一级整体展开/折叠（默认 true）。 */
  recentExpanded: boolean
  /**
   * 每个工程的展开状态。
   * 关键不变量：projectExpanded[id] === undefined 等价于 true（默认展开），
   * 这样新工程不需要主动写入 store 即可默认展开。
   */
  projectExpanded: Record<string, boolean>

  // ─── actions ───
  toggleRecent: () => void
  toggleProject: (projectId: string) => void
  /** 当前是否展开（封装 undefined → true 的语义）。 */
  isProjectExpanded: (projectId: string) => boolean
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // 默认值
      recentExpanded: true,
      projectExpanded: {},

      toggleRecent: () =>
        set(s => ({ recentExpanded: !s.recentExpanded })),

      toggleProject: (id) =>
        set(s => {
          // 用 get().isProjectExpanded 拿到当前值（含 undefined→true 兜底）
          const current = get().isProjectExpanded(id)
          return {
            projectExpanded: { ...s.projectExpanded, [id]: !current },
          }
        }),

      isProjectExpanded: (id) => {
        const v = get().projectExpanded[id]
        // 未记录视为默认展开
        return v === undefined ? true : v
      },
    }),
    { name: 'ke-sidebar-expanded' }
  )
)
