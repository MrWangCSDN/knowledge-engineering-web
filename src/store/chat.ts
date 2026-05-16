/**
 * src/store/chat.ts
 *
 * 对话状态 store —— 管理当前会话的消息列表 + 流式中状态。
 *
 * 数据流：
 *   sendMessage(projectId, question)
 *     ├─ 立即加一条 user 消息 (临时 id, 状态 idle→submitting)
 *     ├─ fetch /qa/explain (POST + SSE)
 *     │   ├─ event: meta → 创建 streamingMessage(空)、记录真实 message_id/session_id
 *     │   ├─ event: section_start → streamingMessage.sections 加新段
 *     │   ├─ event: content → 累加 delta 到当前段
 *     │   ├─ event: section_done → 该段加 references
 *     │   └─ event: done → finalize: streamingMessage 转入 messages，状态回 idle
 *     └─ error → 状态 error
 *
 * 设计文档：[[首页设计]] §3.3 (状态机) + §6.4 (SSE)
 */
import { create } from 'zustand'
import { createParser, type EventSourceMessage } from 'eventsource-parser'

import { apiClient } from '@/api/client'
import { getSessionDetail, voteMessage as apiVoteMessage } from '@/api/sessions'
import { useSessionStore } from '@/store/sessions'
import { useAuthStore } from '@/store/auth'
import type {
  ChatStatus,
  Message,
  Section,
  SectionType,
  Reference,
  MessageMetadata,
  ToolCallPayload,
} from '@/types/chat'
import type { Session } from '@/types/session'

// ─── 内部工具 ────────────────────────────────────────────────────────────

function tempId(prefix: 'msg' | 'sess'): string {
  return `${prefix}_tmp_${Math.random().toString(36).slice(2, 10)}`
}

function tryParseJSON(s: string): unknown {
  try { return JSON.parse(s) } catch { return s }
}

/** 累积流式答案的工具：根据 section type 找/建段、累 delta、补 references。 */
function applyContentDelta(
  sections: Section[],
  type: SectionType,
  delta: string,
): Section[] {
  const idx = sections.findIndex(s => s.type === type)
  if (idx === -1) return sections
  const next = sections.slice()
  next[idx] = { ...next[idx], content: next[idx].content + delta }
  return next
}

function startSection(sections: Section[], type: SectionType, title: string): Section[] {
  if (sections.some(s => s.type === type)) return sections
  return [...sections, { type, title, content: '', references: [] }]
}

function finishSection(
  sections: Section[],
  type: SectionType,
  references: Reference[] | undefined,
): Section[] {
  const idx = sections.findIndex(s => s.type === type)
  if (idx === -1) return sections
  const next = sections.slice()
  next[idx] = { ...next[idx], references: references ?? [] }
  return next
}


// ─── store 接口 ──────────────────────────────────────────────────────────

interface ChatStore {
  /** 当前会话 id（URL → path param 同步进来）。null 表示新对话。 */
  currentSessionId: string | null
  /** 当前工程 id（防止跨工程消息混进来）。 */
  currentProjectId: string | null
  messages: Message[]
  /** 流式中的临时 assistant 消息（done 后转入 messages）。 */
  streamingMessage: Message | null
  status: ChatStatus
  error: string | null
  /** 中止控制器（用户点 ⏸ 停止时调）。 */
  _abortCtrl: AbortController | null

  // ─── actions ───
  /** 切换激活会话（URL 变化时调）。会触发后端拉取消息历史。 */
  loadSession: (projectId: string, sessionId: string) => Promise<void>
  /** 开始一个新对话（清空消息）。 */
  startNew: (projectId: string) => void
  /** 发送一条消息 → POST /qa/explain → 接 SSE 流。 */
  sendMessage: (projectId: string, question: string) => Promise<void>
  /** 取消正在进行中的流。 */
  abort: () => void
  /** 投票 / 取消投票一条 assistant 消息。 */
  voteMessage: (
    projectId: string,
    sessionId: string,
    messageId: string,
    vote: 'up' | 'down',
  ) => Promise<void>
  /** 完全清空（登出/切工程时）。 */
  reset: () => void
}


// ─── store 实现 ──────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
  currentSessionId: null,
  currentProjectId: null,
  messages: [],
  streamingMessage: null,
  status: 'idle',
  error: null,
  _abortCtrl: null,

  startNew: (projectId: string) => {
    set({
      currentSessionId: null,
      currentProjectId: projectId,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
    })
  },

  loadSession: async (projectId: string, sessionId: string) => {
    set({ status: 'submitting', error: null })
    try {
      const detail = await getSessionDetail(projectId, sessionId)
      set({
        currentSessionId: sessionId,
        currentProjectId: projectId,
        messages: detail.messages,
        streamingMessage: null,
        status: 'idle',
      })
    } catch (err) {
      set({ status: 'error', error: (err as Error).message })
    }
  },

  abort: () => {
    get()._abortCtrl?.abort()
    set({ status: 'idle', _abortCtrl: null, streamingMessage: null })
  },

  sendMessage: async (projectId: string, question: string) => {
    const state = get()
    if (state.status === 'streaming' || state.status === 'submitting') return

    // 1. 立即加一条 user 消息（用临时 id）
    const userMsg: Message = {
      id: tempId('msg'),
      session_id: state.currentSessionId ?? tempId('sess'),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }
    set(s => ({
      messages: [...s.messages, userMsg],
      status: 'submitting',
      error: null,
      currentProjectId: projectId,
    }))

    // 2. 发起 SSE 流式请求
    const ctrl = new AbortController()
    set({ _abortCtrl: ctrl })

    // 取最近 10 条历史发给后端（多轮对话）
    const history = get().messages.slice(-10).map(m => ({
      role: m.role, content: m.content,
    }))

    try {
      const baseUrl = (apiClient.defaults.baseURL || '/api').replace(/\/+$/, '')
      const url = `${baseUrl}/projects/${encodeURIComponent(projectId)}/qa/explain`
      const accessToken = useAuthStore.getState().accessToken
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          question,
          session_id: get().currentSessionId,
          history,
        }),
        credentials: 'include',
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
      }
      if (!res.body) throw new Error('Empty response body')

      // 3. 状态切换到 streaming
      set({ status: 'streaming' })

      // 4. 解析 SSE 事件
      let stopped = false
      let metaSessionId = state.currentSessionId
      let metaMessageId: string | null = null

      const parser = createParser({
        onEvent: (msg: EventSourceMessage) => {
          if (stopped || !msg.event || !msg.data) return
          const data = tryParseJSON(msg.data) as Record<string, unknown>

          switch (msg.event) {
            case 'meta': {
              metaSessionId = (data.session_id as string) ?? metaSessionId
              metaMessageId = (data.message_id as string) ?? null
              // 创建空的 streamingMessage
              set({
                streamingMessage: {
                  id: metaMessageId ?? tempId('msg'),
                  session_id: metaSessionId ?? '',
                  role: 'assistant',
                  content: '',
                  sections: [],
                  tool_calls: {},  // v1.3 ReAct：累积 tool 调用
                  created_at: new Date().toISOString(),
                },
                currentSessionId: metaSessionId,
              })
              break
            }
            case 'tool_call': {
              // v1.3 ReAct 事件：LLM 调工具 starting / complete 各发一次
              const payload = data as unknown as ToolCallPayload
              set(s => {
                if (!s.streamingMessage) return s
                const tcs = { ...(s.streamingMessage.tool_calls || {}) }
                const existing = tcs[payload.id] || { starting: payload }
                // phase='starting' → 占位 / phase='complete' → 补上结果
                if (payload.phase === 'starting') {
                  tcs[payload.id] = { ...existing, starting: payload }
                } else {
                  tcs[payload.id] = { ...existing, complete: payload }
                }
                return {
                  streamingMessage: {
                    ...s.streamingMessage,
                    tool_calls: tcs,
                  },
                }
              })
              break
            }
            case 'token': {
              // v1.6：LLM 流式 token chunk
              // 累计到 raw_stream；UI 用它显示打字机效果
              // 一旦 section_start / content 开始流入，UI 会切回结构化展示
              const delta = (data.delta as string) ?? ''
              if (!delta) break
              set(s => {
                if (!s.streamingMessage) return s
                return {
                  streamingMessage: {
                    ...s.streamingMessage,
                    raw_stream: (s.streamingMessage.raw_stream || '') + delta,
                  },
                }
              })
              break
            }
            case 'step':
              // step 事件用作 UI 反馈（"正在检索..."），暂时只更新 thinking 文案；W6 渲染时会用
              break
            case 'section_start': {
              const type = data.section as SectionType
              const title = (data.title as string) ?? ''
              set(s => {
                if (!s.streamingMessage) return s
                return {
                  streamingMessage: {
                    ...s.streamingMessage,
                    sections: startSection(s.streamingMessage.sections ?? [], type, title),
                  },
                }
              })
              break
            }
            case 'content': {
              const type = data.section as SectionType
              const delta = (data.delta as string) ?? ''
              set(s => {
                if (!s.streamingMessage) return s
                return {
                  streamingMessage: {
                    ...s.streamingMessage,
                    sections: applyContentDelta(s.streamingMessage.sections ?? [], type, delta),
                  },
                }
              })
              break
            }
            case 'section_done': {
              const type = data.section as SectionType
              const references = data.references as Reference[] | undefined
              set(s => {
                if (!s.streamingMessage) return s
                return {
                  streamingMessage: {
                    ...s.streamingMessage,
                    sections: finishSection(s.streamingMessage.sections ?? [], type, references),
                  },
                }
              })
              break
            }
            case 'done': {
              stopped = true
              const metadata: MessageMetadata = {
                entry_points: [],
                cited_entities: [],
                interpretation_freshness: new Date().toISOString(),
                token_usage: (data.total_tokens as number) ?? 0,
                latency_ms: (data.latency_ms as number) ?? 0,
              }
              set(s => {
                if (!s.streamingMessage) return s
                const finalMsg: Message = {
                  ...s.streamingMessage,
                  metadata,
                }
                return {
                  messages: [...s.messages, finalMsg],
                  streamingMessage: null,
                  status: 'idle',
                  _abortCtrl: null,
                }
              })

              // 把当前 session 加到左栏（如果是新会话）
              const currentProject = get().currentProjectId
              if (currentProject && metaSessionId && !state.currentSessionId) {
                const newSession: Session = {
                  id: metaSessionId,
                  project_id: currentProject,
                  title: question.slice(0, 30),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  message_count: 2,
                }
                useSessionStore.getState().prependSession(newSession)
              }
              break
            }
            case 'session_title': {
              // 后端首轮异步总结完成，推来新标题 → 实时刷新侧栏
              // 设计：[[会话标题-重命名与智能总结-设计]] §4.2
              const sid = data.session_id as string
              const title = data.title as string
              if (sid && title) {
                useSessionStore.getState().updateSessionTitle(sid, title)
              }
              break
            }
            case 'error': {
              stopped = true
              const errMsg = (data.message as string) ?? '未知错误'
              set({
                status: 'error',
                error: errMsg,
                streamingMessage: null,
                _abortCtrl: null,
              })
              break
            }
          }
        },
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (!stopped) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value, { stream: true }))
      }

      // 兜底：流自然结束但没收到 done 事件
      if (get().status === 'streaming') {
        set({ status: 'idle', streamingMessage: null, _abortCtrl: null })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户主动 abort
        set({ status: 'idle', streamingMessage: null, _abortCtrl: null })
        return
      }
      set({
        status: 'error',
        error: (err as Error).message,
        streamingMessage: null,
        _abortCtrl: null,
      })
    }
  },

  voteMessage: async (projectId, sessionId, messageId, vote) => {
    await apiVoteMessage({ projectId, sessionId, messageId, vote })
  },

  reset: () => {
    get()._abortCtrl?.abort()
    set({
      currentSessionId: null,
      currentProjectId: null,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
      _abortCtrl: null,
    })
  },
}))
