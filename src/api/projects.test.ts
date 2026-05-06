/**
 * src/api/projects.test.ts
 *
 * 验证 listProjects / getProject / createProject 的 URL + 响应解构逻辑。
 * mock 掉 apiClient（axios 实例）让测试不发真请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './client'
import { listProjects, getProject, createProject } from './projects'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const fakeProject = {
  id: 'p1',
  name: 'P1',
  status: 'ready' as const,
  stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  pipeline_at: null,
}

describe('api/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  // ─── listProjects ───

  it('listProjects: 解构 projects 字段', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { projects: [fakeProject] },
    })
    const result = await listProjects()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(apiClient.get).toHaveBeenCalledWith('/projects')
  })

  it('listProjects: 空数组', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { projects: [] } })
    expect(await listProjects()).toEqual([])
  })

  // ─── getProject ───

  it('getProject: 走 /projects/{id}', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: fakeProject })
    const result = await getProject('p1')
    expect(result.id).toBe('p1')
    expect(apiClient.get).toHaveBeenCalledWith('/projects/p1')
  })

  it('getProject: id 中的特殊字符被 encode', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: fakeProject })
    await getProject('a/b')
    expect(apiClient.get).toHaveBeenCalledWith('/projects/a%2Fb')
  })

  // ─── createProject ───

  it('createProject: POST 到 /projects 带 body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { ...fakeProject, status: 'indexing' },
    })
    const result = await createProject({ id: 'new', name: 'New' })
    expect(result.status).toBe('indexing')
    expect(apiClient.post).toHaveBeenCalledWith('/projects', { id: 'new', name: 'New' })
  })
})
