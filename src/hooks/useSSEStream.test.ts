/**
 * src/hooks/useSSEStream.test.ts
 *
 * mock fetch + ReadableStream，喂入 SSE 文本，验证：
 *  - 事件按顺序累积
 *  - done 事件后状态变 'done'
 *  - error 事件后状态变 'error'
 *  - HTTP 4xx 直接置 error
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSSEStream } from './useSSEStream'

/**
 * 把 SSE 文本流转成 ReadableStream。
 * 用 TextEncoder 把字符串编码成 Uint8Array。
 */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(enc.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
}

function mockFetch(opts: { ok: boolean; status?: number; body?: string[] }) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: opts.ok,
    status: opts.status ?? 200,
    statusText: 'OK',
    body: opts.body ? makeStream(opts.body) : null,
  } as Response) as never
}

describe('useSSEStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ─── 正常流 ───

  it('累积 meta + content + done 三个事件', async () => {
    mockFetch({
      ok: true,
      body: [
        'event: meta\ndata: {"session_id":"s1"}\n\n',
        'event: content\ndata: {"section":"overview","delta":"hi"}\n\n',
        'event: done\ndata: {"session_id":"s1","total_tokens":100}\n\n',
      ],
    })

    const { result } = renderHook(() =>
      useSSEStream({ url: '/api/x', body: { question: 'q' } }),
    )
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.events).toHaveLength(3)
    expect(result.current.events[0].event).toBe('meta')
    expect(result.current.events[1].event).toBe('content')
    expect(result.current.events[2].event).toBe('done')
    expect(result.current.status).toBe('done')
    expect(result.current.error).toBeNull()
  })

  it('error 事件后状态变 error', async () => {
    mockFetch({
      ok: true,
      body: [
        'event: meta\ndata: {}\n\n',
        'event: error\ndata: {"code":"x","message":"boom","recoverable":true}\n\n',
      ],
    })

    const { result } = renderHook(() => useSSEStream({ url: '/api/x', body: {} }))
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.events.at(-1)?.event).toBe('error')
  })

  it('HTTP 4xx 立即置 error，不读 body', async () => {
    mockFetch({ ok: false, status: 404 })

    const { result } = renderHook(() => useSSEStream({ url: '/api/x', body: {} }))
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error?.message).toContain('404')
  })

  it('reset() 清空 events + status', async () => {
    mockFetch({
      ok: true,
      body: [
        'event: meta\ndata: {}\n\n',
        'event: done\ndata: {}\n\n',
      ],
    })

    const { result } = renderHook(() => useSSEStream({ url: '/api/x', body: {} }))
    await act(async () => {
      await result.current.start()
    })
    expect(result.current.events).toHaveLength(2)

    act(() => result.current.reset())
    expect(result.current.events).toHaveLength(0)
    expect(result.current.status).toBe('idle')
  })

  it('JSON 解析失败时事件 data 保留为字符串', async () => {
    mockFetch({
      ok: true,
      body: [
        'event: content\ndata: not json\n\n',
        'event: done\ndata: {}\n\n',
      ],
    })

    const { result } = renderHook(() => useSSEStream({ url: '/api/x', body: {} }))
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.events[0].event).toBe('content')
    expect(result.current.events[0].data).toBe('not json')
  })
})
