/**
 * src/hooks/useSSEStream.ts
 *
 * 用 fetch + ReadableStream + eventsource-parser 接收 SSE 事件流。
 *
 * 为什么不用浏览器自带 EventSource：
 *  - EventSource 只支持 GET，我们的 /qa/explain 是 POST（带 question + history）
 *  - EventSource 没法自定义 Authorization header
 *  - fetch + ReadableStream 完全可控
 *
 * 用法：
 *   const stream = useSSEStream({ url: '...', body: {...}, headers: {...} })
 *   await stream.start()
 *   stream.events       // 累积的事件数组（响应式更新 UI）
 *   stream.status       // 'idle' | 'streaming' | 'done' | 'error'
 *   stream.abort()      // 取消（点 ⏸ 停止按钮时用）
 *
 * 设计文档：[[首页设计]] §6.4 (SSE 协议) + §6.6 (Zustand stores)
 */
import { useState, useCallback, useRef } from 'react'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { SSEEvent, SSEEventType } from '@/types/chat'

interface UseSSEStreamOptions {
  /** 完整 URL（含 /api 前缀，由 apiClient.defaults.baseURL 决定）。 */
  url: string
  /** POST body；为空时走 GET。 */
  body?: unknown
  /** 额外 header（Authorization 由 apiClient 自动注入，这里通常不用传）。 */
  headers?: Record<string, string>
}

export type SSEStreamStatus = 'idle' | 'streaming' | 'done' | 'error'

interface UseSSEStreamReturn {
  events: SSEEvent[]
  status: SSEStreamStatus
  error: Error | null
  /** 启动流。返回的 Promise 在 done / error / abort 后 resolve。 */
  start: () => Promise<void>
  /** 取消流（用户点 ⏸ 停止时调）。状态切回 'idle'，已累积的 events 保留。 */
  abort: () => void
  /** 清空事件 + 状态（开新对话时调）。 */
  reset: () => void
}

/** SSE 类型守卫：data 字段 JSON 解析失败时统一视为 string。 */
function tryParseJSON(data: string): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

export function useSSEStream(opts: UseSSEStreamOptions): UseSSEStreamReturn {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [status, setStatus] = useState<SSEStreamStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setEvents([])
    setStatus('idle')
    setError(null)
  }, [])

  const start = useCallback(async () => {
    reset()
    setStatus('streaming')
    abortRef.current = new AbortController()

    try {
      const res = await fetch(opts.url, {
        method: opts.body !== undefined ? 'POST' : 'GET',
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...opts.headers,
        },
        // 让浏览器附带 cookie（refresh_token 用 HttpOnly cookie）
        credentials: 'include',
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      if (!res.body) {
        throw new Error('Empty response body')
      }

      // eventsource-parser 把 SSE 文本流解析成 EventSourceMessage 事件
      let stopped = false
      const parser = createParser({
        onEvent: (msg: EventSourceMessage) => {
          if (stopped) return
          // 没有 event 字段时跳过（注释/keepalive）
          if (!msg.event || !msg.data) return
          const ev: SSEEvent = {
            event: msg.event as SSEEventType,
            data: tryParseJSON(msg.data),
          }
          setEvents(prev => [...prev, ev])
          // 自动收尾：done / error 之后停止读流
          if (ev.event === 'done') {
            stopped = true
            setStatus('done')
          } else if (ev.event === 'error') {
            stopped = true
            setStatus('error')
          }
        },
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      // 循环读取 stream，直到 done 或 abort
      while (!stopped) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value, { stream: true }))
      }

      // 兜底：流自然结束但没收到 done 事件
      if (status !== 'error') {
        setStatus(prev => (prev === 'streaming' ? 'done' : prev))
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户主动 abort，不算错误
        setStatus('idle')
      } else {
        setError(err as Error)
        setStatus('error')
      }
    }
    // 注：故意不依赖 status（避免 closure 陷阱）；status 用 setStatus(prev => ...) 形式更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.url, JSON.stringify(opts.body), JSON.stringify(opts.headers), reset])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { events, status, error, start, abort, reset }
}
