import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectStore } from './projects'
import * as projectsApi from '@/api/projects'
import type { Project } from '@/types/project'

vi.mock('@/api/projects', () => ({
  listProjects: vi.fn(),
}))

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'P1', status: 'ready',
  stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  pipeline_at: null,
  ...over,
})

describe('useProjectStore', () => {
  beforeEach(() => {
    // projects store 用 persist 中间件把 currentProjectId/lastSessionByProject 持久化到 localStorage，
    // 且 reset() 故意保留 currentProjectId（store 注释：登出靠 UserMenu 的 hard-redirect 整页刷新清 in-memory，
    // currentProjectId 留 localStorage 让同一用户重登回到上次工程）。
    // 测试共享 store 单例 + localStorage → 必须显式清干净，否则 currentProjectId 会跨用例泄漏（旧测试 3 红的根因）。
    localStorage.clear()
    useProjectStore.setState({
      projects: [], currentProjectId: null, lastSessionByProject: {}, isLoading: false, error: null,
    })
    vi.clearAllMocks()
  })

  // ─── fetchProjects ───

  it('fetchProjects: 加载并设置首个 ready 项目为当前', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      mkProject({ id: 'p1', status: 'indexing' }),  // 不算
      mkProject({ id: 'p2', status: 'ready' }),     // 选这个
      mkProject({ id: 'p3', status: 'ready' }),
    ])
    await useProjectStore.getState().fetchProjects()
    const state = useProjectStore.getState()
    expect(state.projects).toHaveLength(3)
    expect(state.currentProjectId).toBe('p2')  // 跳过 indexing 选首个 ready
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('fetchProjects: 全是 indexing 时也兜底选第一个', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      mkProject({ id: 'p1', status: 'indexing' }),
      mkProject({ id: 'p2', status: 'failed' }),
    ])
    await useProjectStore.getState().fetchProjects()
    expect(useProjectStore.getState().currentProjectId).toBe('p1')
  })

  it('fetchProjects: currentProjectId 仍在新列表中时保留（即便它是 indexing，也不被换成 ready 的）', async () => {
    // 现行 store 语义：current 只要仍是列表里的有效项就保留——尊重用户/URL 的显式选择
    useProjectStore.setState({ currentProjectId: 'p2' })
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      mkProject({ id: 'p1', status: 'ready' }),
      mkProject({ id: 'p2', status: 'indexing' }),  // current 指向它，虽 indexing 仍保留
    ])
    await useProjectStore.getState().fetchProjects()
    expect(useProjectStore.getState().currentProjectId).toBe('p2')
  })

  it('fetchProjects: currentProjectId 已失效（不在新列表）时换成首个 ready', async () => {
    // 权限被撤 / 工程被删 / localStorage 持久化的旧 id 过期 → 失效 → 兜底重选
    useProjectStore.setState({ currentProjectId: 'stale' })
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      mkProject({ id: 'p1', status: 'indexing' }),
      mkProject({ id: 'p2', status: 'ready' }),
    ])
    await useProjectStore.getState().fetchProjects()
    expect(useProjectStore.getState().currentProjectId).toBe('p2')  // 失效 → 首个 ready
  })

  it('fetchProjects: 失败时设 error，不抛出', async () => {
    vi.mocked(projectsApi.listProjects).mockRejectedValue(new Error('网络错误'))
    await useProjectStore.getState().fetchProjects()
    const state = useProjectStore.getState()
    expect(state.error).toBe('网络错误')
    expect(state.isLoading).toBe(false)
    expect(state.projects).toEqual([])
  })

  // ─── setCurrentProject / reset ───

  it('setCurrentProject 更新 id', () => {
    useProjectStore.getState().setCurrentProject('p9')
    expect(useProjectStore.getState().currentProjectId).toBe('p9')
  })

  it('reset 清 projects/error，但【有意保留】currentProjectId（登出靠 hard-redirect 清，非 reset）', () => {
    // store 设计：reset 只清瞬时态（projects 每次重拉、error/isLoading 复位）；
    // currentProjectId 持久化、跨 reset 保留，让同一用户重登回到上次工程（见 store 注释）。
    useProjectStore.setState({
      projects: [mkProject()],
      currentProjectId: 'p1',
      error: 'x',
      isLoading: true,
    })
    useProjectStore.getState().reset()
    const state = useProjectStore.getState()
    expect(state.projects).toEqual([])           // 列表清空（每次重拉）
    expect(state.error).toBeNull()               // error 复位
    expect(state.isLoading).toBe(false)          // isLoading 复位
    expect(state.currentProjectId).toBe('p1')    // ← 有意保留（非 bug）：persist + 重登回到上次工程
  })
})
