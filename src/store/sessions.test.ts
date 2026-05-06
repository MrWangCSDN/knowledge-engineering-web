import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSessionStore } from './sessions'
import * as sessionsApi from '@/api/sessions'
import type { Session } from '@/types/session'

vi.mock('@/api/sessions', () => ({
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
}))

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1', project_id: 'p1', title: 'Q?',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
    vi.clearAllMocks()
  })

  it('fetchSessions: 加载并按 project 分桶', async () => {
    vi.mocked(sessionsApi.listSessions).mockResolvedValue([
      mkSession({ id: 's1', project_id: 'p1' }),
      mkSession({ id: 's2', project_id: 'p1' }),
    ])
    await useSessionStore.getState().fetchSessions('p1')
    const state = useSessionStore.getState()
    expect(state.sessionsByProject.p1).toHaveLength(2)
    expect(state.fetchedProjects.has('p1')).toBe(true)
  })

  it('fetchSessions 失败 → error 字段', async () => {
    vi.mocked(sessionsApi.listSessions).mockRejectedValue(new Error('boom'))
    await useSessionStore.getState().fetchSessions('p1')
    expect(useSessionStore.getState().error).toBe('boom')
  })

  it('deleteSession 同步 store', async () => {
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1' }), mkSession({ id: 's2' })],
      },
    })
    vi.mocked(sessionsApi.deleteSession).mockResolvedValue()
    await useSessionStore.getState().deleteSession('p1', 's1')
    expect(useSessionStore.getState().sessionsByProject.p1).toEqual([
      expect.objectContaining({ id: 's2' }),
    ])
  })

  it('prependSession 插到顶部', () => {
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's_old' })],
      },
    })
    useSessionStore.getState().prependSession(mkSession({ id: 's_new' }))
    const list = useSessionStore.getState().sessionsByProject.p1
    expect(list[0].id).toBe('s_new')
    expect(list[1].id).toBe('s_old')
  })

  it('prependSession 已存在不重复加', () => {
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1' })],
      },
    })
    useSessionStore.getState().prependSession(mkSession({ id: 's1', title: '改了' }))
    expect(useSessionStore.getState().sessionsByProject.p1).toHaveLength(1)
  })

  it('reset 清空', () => {
    useSessionStore.setState({
      sessionsByProject: { p1: [mkSession()] },
      fetchedProjects: new Set(['p1']),
    })
    useSessionStore.getState().reset()
    const state = useSessionStore.getState()
    expect(state.sessionsByProject).toEqual({})
    expect(state.fetchedProjects.size).toBe(0)
  })
})
