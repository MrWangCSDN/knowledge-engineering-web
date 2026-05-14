import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useArchivedSessionStore } from './archivedSessions'
import * as sessionsApi from '@/api/sessions'
import type { ArchivedByProject } from '@/types/session'

vi.mock('@/api/sessions', () => ({
  listArchivedSessions: vi.fn(),
  unarchiveSession: vi.fn(),
  deleteSession: vi.fn(),
}))

const mkGroup = (over: Partial<ArchivedByProject> = {}): ArchivedByProject => ({
  project_id: 'p1',
  project_name: 'P1',
  sessions: [
    {
      id: 's1', title: 'x', archived_at: '2026-05-13T10:00:00Z',
      created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-10T00:00:00Z',
      message_count: 2,
    },
  ],
  ...over,
})

describe('useArchivedSessionStore', () => {
  beforeEach(() => {
    useArchivedSessionStore.getState().reset()
    vi.clearAllMocks()
  })

  it('默认状态：byProject 空数组，isLoading false', () => {
    const s = useArchivedSessionStore.getState()
    expect(s.byProject).toEqual([])
    expect(s.isLoading).toBe(false)
  })

  it('fetchAll: 拉取归档列表并写入 byProject', async () => {
    vi.mocked(sessionsApi.listArchivedSessions).mockResolvedValue([mkGroup()])
    await useArchivedSessionStore.getState().fetchAll()
    expect(useArchivedSessionStore.getState().byProject).toHaveLength(1)
  })

  it('fetchAll 失败 → error 字段', async () => {
    vi.mocked(sessionsApi.listArchivedSessions).mockRejectedValue(new Error('boom'))
    await useArchivedSessionStore.getState().fetchAll()
    expect(useArchivedSessionStore.getState().error).toBe('boom')
  })

  it('restore: 调 unarchive + 从 byProject 移除', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup({ project_id: 'p1', sessions: [
        { id: 's1', title: 'x', archived_at: '2026-05-13T10:00:00Z',
          created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-10T00:00:00Z',
          message_count: 2 },
        { id: 's2', title: 'y', archived_at: '2026-05-12T10:00:00Z',
          created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
          message_count: 1 },
      ]})],
    })
    vi.mocked(sessionsApi.unarchiveSession).mockResolvedValue()
    await useArchivedSessionStore.getState().restore('p1', 's1')
    const list = useArchivedSessionStore.getState().byProject[0].sessions
    expect(list.map(s => s.id)).toEqual(['s2'])
  })

  it('permanentDelete: 调 deleteSession + 从 byProject 移除', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup()],
    })
    vi.mocked(sessionsApi.deleteSession).mockResolvedValue()
    await useArchivedSessionStore.getState().permanentDelete('p1', 's1')
    expect(useArchivedSessionStore.getState().byProject[0].sessions).toHaveLength(0)
  })

  it('restore 让 project 变空时移除整个 group', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup()],  // 只有一条 session
    })
    vi.mocked(sessionsApi.unarchiveSession).mockResolvedValue()
    await useArchivedSessionStore.getState().restore('p1', 's1')
    // project 整体消失（因为里面 sessions 空了）
    expect(useArchivedSessionStore.getState().byProject).toHaveLength(0)
  })

  it('reset 清空', () => {
    useArchivedSessionStore.setState({ byProject: [mkGroup()], error: 'x' })
    useArchivedSessionStore.getState().reset()
    expect(useArchivedSessionStore.getState().byProject).toEqual([])
    expect(useArchivedSessionStore.getState().error).toBeNull()
  })
})
