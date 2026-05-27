/**
 * useInfraStore 行为测试。
 * 设计：[[基础设施健康检查与产品不可用-设计]] §4.1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInfraStore } from './infra'
import { apiClient } from '@/api/client'

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('useInfraStore', () => {
  beforeEach(() => {
    // 重置 store 到初值
    useInfraStore.setState({
      healthy: true,
      deps: undefined,
      lastCheck: null,
      fetching: false,
    })
    vi.clearAllMocks()
  })

  it('初值 healthy=true（乐观）', () => {
    expect(useInfraStore.getState().healthy).toBe(true)
  })

  it('fetchHealth 成功 → set healthy + lastCheck + fetching=false', async () => {
    ;(apiClient.get as any).mockResolvedValueOnce({
      data: { healthy: true, ts: '2026-05-26T10:00:00Z' },
    })
    await useInfraStore.getState().fetchHealth()
    const s = useInfraStore.getState()
    expect(s.healthy).toBe(true)
    expect(s.lastCheck).not.toBeNull()
    expect(s.fetching).toBe(false)
  })

  it('fetchHealth admin → deps 字段填充', async () => {
    ;(apiClient.get as any).mockResolvedValueOnce({
      data: {
        healthy: false,
        ts: '2026-05-26T10:00:00Z',
        deps: { neo4j: { ok: false, error: 'down' }, mysql: { ok: true } },
      },
    })
    await useInfraStore.getState().fetchHealth()
    const s = useInfraStore.getState()
    expect(s.healthy).toBe(false)
    expect(s.deps?.neo4j.ok).toBe(false)
  })

  it('fetchHealth 失败（后端完全连不上）→ healthy=false', async () => {
    ;(apiClient.get as any).mockRejectedValueOnce(new Error('Network down'))
    await useInfraStore.getState().fetchHealth()
    const s = useInfraStore.getState()
    expect(s.healthy).toBe(false)
    expect(s.fetching).toBe(false)
  })

  it('markUnhealthy 立即 set healthy=false + lastCheck', () => {
    useInfraStore.getState().markUnhealthy('test reason')
    const s = useInfraStore.getState()
    expect(s.healthy).toBe(false)
    expect(s.lastCheck).not.toBeNull()
  })

  it('fetching 期间 fetching=true', async () => {
    let resolveFn: (v: any) => void
    const slowPromise = new Promise(r => { resolveFn = r })
    ;(apiClient.get as any).mockReturnValueOnce(slowPromise)

    const pendingFetch = useInfraStore.getState().fetchHealth()
    expect(useInfraStore.getState().fetching).toBe(true)

    resolveFn!({ data: { healthy: true, ts: 'x' } })
    await pendingFetch
    expect(useInfraStore.getState().fetching).toBe(false)
  })
})
