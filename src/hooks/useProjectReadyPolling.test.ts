import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useProjectReadyPolling } from './useProjectReadyPolling'
import { useProjectStore } from '@/store/projects'

describe('useProjectReadyPolling', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('enabled+非ready → 周期调用 fetchProjects', () => {
    const fetchSpy = vi.spyOn(useProjectStore.getState(), 'fetchProjects').mockResolvedValue()
    renderHook(() => useProjectReadyPolling('p1', 'indexing', true))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('enabled=false 或 ready → 不轮询', () => {
    const fetchSpy = vi.spyOn(useProjectStore.getState(), 'fetchProjects').mockResolvedValue()
    renderHook(() => useProjectReadyPolling('p1', 'ready', true))
    renderHook(() => useProjectReadyPolling('p1', 'indexing', false))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('status 由非ready→ready → onReady 回调触发一次', () => {
    vi.spyOn(useProjectStore.getState(), 'fetchProjects').mockResolvedValue()
    const onReady = vi.fn()
    const { rerender } = renderHook(
      ({ status }) => useProjectReadyPolling('p1', status, true, onReady),
      { initialProps: { status: 'indexing' as const } },
    )
    expect(onReady).not.toHaveBeenCalled()
    rerender({ status: 'ready' as const })
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('卸载后清除 interval，不再轮询', () => {
    const fetchSpy = vi.spyOn(useProjectStore.getState(), 'fetchProjects').mockResolvedValue()
    const { unmount } = renderHook(() => useProjectReadyPolling('p1', 'indexing', true))
    expect(fetchSpy).toHaveBeenCalledTimes(1) // 立即一次
    unmount()
    act(() => { vi.advanceTimersByTime(15000) })
    expect(fetchSpy).toHaveBeenCalledTimes(1) // 卸载后不再增加
  })
})
