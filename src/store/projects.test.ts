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
    useProjectStore.getState().reset()
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

  it('fetchProjects: 已有 currentProjectId 时不覆盖', async () => {
    useProjectStore.setState({ currentProjectId: 'preset' })
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      mkProject({ id: 'p1' }),
    ])
    await useProjectStore.getState().fetchProjects()
    expect(useProjectStore.getState().currentProjectId).toBe('preset')
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

  it('reset 清空一切', () => {
    useProjectStore.setState({
      projects: [mkProject()],
      currentProjectId: 'p1',
      error: 'x',
    })
    useProjectStore.getState().reset()
    const state = useProjectStore.getState()
    expect(state.projects).toEqual([])
    expect(state.currentProjectId).toBeNull()
    expect(state.error).toBeNull()
  })
})
