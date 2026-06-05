/**
 * src/store/chat.ts
 *
 * 对话状态 store —— 管理多 session 并发的流式状态。
 *
 * 2026-05-22 大重构（参考 ChatGPT / Claude.ai 设计）：
 *   旧设计：streamingMessage / messages 全局单实例 → 切走 session 后状态丢失
 *   新设计：按 sessionId 索引（streamingBySession / messagesBySession / abortBySession）
 *     - 多个 session 可以同时流式
 *     - 切走再切回看到流式继续 ✓
 *     - 后台 done 自动写到对应 session 的 messagesBySession[sid]
 *     - UI 通过 selector 根据 URL sessionId 派生当前 session view
 *
 * 数据流：
 *   sendMessage(projectId, question)
 *     ├─ user msg push 到 messagesBySession[currentSid]
 *     ├─ fetch /qa/explain (POST + SSE，AbortController 存入 abortBySession[currentSid])
 *     │   ├─ event: meta → 创建 streamingBySession[metaSid] + 更新 currentSessionId
 *     │   ├─ event: token/content/section_* → 更新 streamingBySession[metaSid]（不依赖 currentSid）
 *     │   └─ event: done → finalize: 推到 messagesBySession[metaSid]，删 streamingBySession[metaSid]
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
import { useProjectStore } from '@/store/projects'
import type {
  ChatStatus,
  Message,
  Section,
  SectionType,
  Reference,
  MessageMetadata,
  ToolCallPayload,
  TodoItem,
  ContextUsage,
} from '@/types/chat'
import type { Session } from '@/types/session'

// ─── 内部工具 ────────────────────────────────────────────────────────────

function tempId(prefix: 'msg' | 'sess'): string {
  return `${prefix}_tmp_${Math.random().toString(36).slice(2, 10)}`
}

function tryParseJSON(s: string): unknown {
  try { return JSON.parse(s) } catch { return s }
}

/**
 * 模块级稳定空数组 — selector 派生时避免每次返新引用触发 re-render。
 * 用 Message[]（非 readonly）— 与 MessageList props 对齐；约定不可变（永不 mutate）。
 */
const EMPTY_MESSAGES: Message[] = []

/** 默认模型上下文窗口（与后端 KE_MODEL_CONTEXT_WINDOW 一致：1M tokens）。 */
const _DEFAULT_CTX_WINDOW = 1_000_000

function estimateMessageTokens(m: Pick<Message, 'content' | 'sections' | 'role'>): number {
  let text = m.content || ''
  if ((!text || text.trim() === '') && m.sections && m.sections.length > 0) {
    text = m.sections.map(s => (s.title ? s.title + s.content : s.content)).join('')
  }
  return Math.ceil(text.length / 1.5)
}

function computeUsageFromMessages(messages: readonly Message[]): ContextUsage {
  const used = messages.reduce((acc, m) => acc + estimateMessageTokens(m), 0)
  const window = _DEFAULT_CTX_WINDOW
  const pct = window > 0 ? Math.min(100, (used / window) * 100) : 0
  return {
    used_tokens: used,
    window_tokens: window,
    pct: Math.round(pct * 10) / 10,
    history_trimmed: false,
  }
}

function applyContentDelta(sections: Section[], type: SectionType, delta: string): Section[] {
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

function finishSection(sections: Section[], type: SectionType, references: Reference[] | undefined): Section[] {
  const idx = sections.findIndex(s => s.type === type)
  if (idx === -1) return sections
  const next = sections.slice()
  next[idx] = { ...next[idx], references: references ?? [] }
  return next
}


// ─── store 接口 ──────────────────────────────────────────────────────────

interface ChatStore {
  /** 当前 UI 焦点的 session id（由 URL sessionId 同步过来）。null = 新对话 EmptyState。 */
  currentSessionId: string | null
  /** 当前工程 id。 */
  currentProjectId: string | null

  // ─── 按 sessionId 索引的真实源（多 session 并发） ────────────────────
  /** 每个 session 的已完成消息列表（按 sid 隔离，切走再切回不丢） */
  messagesBySession: Record<string, Message[]>
  /** 每个 session 正在流式中的 assistant 临时消息（仅含进行中；done 后移到 messagesBySession） */
  streamingBySession: Record<string, Message>
  /** 每个 session 的 fetch AbortController（用户点 ⏹ 停止时按 sid abort） */
  abortBySession: Record<string, AbortController>

  // ─── 与当前 session 强相关的全局 UI 状态 ─────────────────────────────
  status: ChatStatus
  error: string | null
  /** 当前 session 的上下文用量（每轮 done 重算）。 */
  contextUsage: ContextUsage | null

  // ─── actions ───
  loadSession: (projectId: string, sessionId: string) => Promise<void>
  startNew: (projectId: string) => void
  sendMessage: (projectId: string, question: string) => Promise<void>
  /** 停止当前 session 的流式（默认 currentSessionId；可传具体 sid 停别的）。 */
  abort: (sessionId?: string) => void
  voteMessage: (projectId: string, sessionId: string, messageId: string, vote: 'up' | 'down') => Promise<void>
  /** 完全清空（登出 / 切工程时）。 */
  reset: () => void

  // ─── selectors（外部调用方便：直接拿当前 session view） ────────────
  /** 当前 sessionId 对应的 messages（无 sid → 空数组）。模块级常量 EMPTY_MESSAGES 保稳定 ref。 */
  getCurrentMessages: () => Message[]
  /** 当前 sessionId 对应的 streamingMessage（无 sid / 该 sid 无流 → null）。 */
  getCurrentStreaming: () => Message | null
}


// ─── store 实现 ──────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
  currentSessionId: null,
  currentProjectId: null,
  messagesBySession: {},
  streamingBySession: {},
  abortBySession: {},
  status: 'idle',
  error: null,
  contextUsage: null,

  getCurrentMessages: () => {
    const sid = get().currentSessionId
    if (!sid) return EMPTY_MESSAGES
    return get().messagesBySession[sid] ?? EMPTY_MESSAGES
  },

  getCurrentStreaming: () => {
    const sid = get().currentSessionId
    if (!sid) return null
    return get().streamingBySession[sid] ?? null
  },

  startNew: (projectId: string) => {
    // 新对话：clear currentSessionId（URL 变 /project/{pid} 无 sid）
    // 不动 messagesBySession / streamingBySession —— 其他 session 的状态保留
    set({
      currentSessionId: null,
      currentProjectId: projectId,
      status: 'idle',
      error: null,
      contextUsage: null,
    })
  },

  loadSession: async (projectId: string, sessionId: string) => {
    set({ status: 'submitting', error: null })
    try {
      const detail = await getSessionDetail(projectId, sessionId)

      // 关键：按 sessionId 索引存进 byId map（messagesBySession[sid] = detail.messages）
      // streamingBySession[sid] 如果该 session 正流式（background fetch 仍在跑）会自动 reuse
      // → ChatPage selector 看到 streaming 仍在，UI 立即恢复流式 widget
      set(s => {
        const existingStreaming = s.streamingBySession[sessionId]
        return {
          currentSessionId: sessionId,
          currentProjectId: projectId,
          messagesBySession: { ...s.messagesBySession, [sessionId]: detail.messages },
          // streamingBySession 不动 —— 各 session 自己的 streaming 仍累积
          status: existingStreaming ? 'streaming' : 'idle',
          contextUsage: computeUsageFromMessages(detail.messages),
        }
      })
      // 记忆"该 project 最后访问的 session"
      useProjectStore.getState().setLastSession(projectId, sessionId)
    } catch (err) {
      const axErr = err as { response?: { status?: number } }
      if (axErr?.response?.status === 404) {
        // 404 = sessionId 失效（被删 / 不属于该 user / 不存在）
        // 必须清 4 件：
        //   ① currentSessionId → null（让 ChatPage URL sync useEffect 跳到 /project/{pid}）
        //   ② messagesBySession[sessionId] → 删（防止用户按"后退"键回到失效 URL 时
        //      selector 还从缓存读到旧消息 — 2026-05-22 bug：清服务器记忆后，
        //      stale React state 让主区仍显示旧对话直到用户硬刷新）
        //   ③ streamingBySession[sessionId] → 删（同上；该 session 显然不会再流式）
        //   ④ abortBySession[sessionId] → 删（防止泄露 AbortController）
        // 别的 session（其他 sid 的 messagesBySession 项）不动 — 用户切到其他 session 不受影响
        set(s => {
          const { [sessionId]: _msgGone, ...remainingMessages } = s.messagesBySession
          const { [sessionId]: _streamGone, ...remainingStreams } = s.streamingBySession
          const { [sessionId]: _ctrlGone, ...remainingAborts } = s.abortBySession
          return {
            currentSessionId: null,
            currentProjectId: projectId,
            messagesBySession: remainingMessages,
            streamingBySession: remainingStreams,
            abortBySession: remainingAborts,
            status: 'idle',
            contextUsage: null,
            error: null,
          }
        })
        return
      }
      set({ status: 'error', error: (err as Error).message })
    }
  },

  abort: (sessionId?: string) => {
    // ChatGPT 同款"停止生成"行为：保留已生成部分推到 messages 列表
    const targetSid = sessionId ?? get().currentSessionId
    if (!targetSid) return

    // abort fetch（用户点 ⏹ 停止时）
    const ctrl = get().abortBySession[targetSid]
    ctrl?.abort()

    set(s => {
      const sm = s.streamingBySession[targetSid]
      // 准备清掉 streamingBySession[targetSid] + abortBySession[targetSid] 的工具函数
      const { [targetSid]: _streamGone, ...remainingStreams } = s.streamingBySession
      const { [targetSid]: _ctrlGone, ...remainingAborts } = s.abortBySession
      const isCurrent = s.currentSessionId === targetSid

      if (!sm) {
        // 流刚起就停（无 streaming msg）— 仅清 controller
        return {
          abortBySession: remainingAborts,
          status: isCurrent ? 'idle' : s.status,
        }
      }

      // 收集已累积的内容
      const rawText = (sm.raw_stream || '').trim()
      const hasSections = sm.sections && sm.sections.some(sec => sec.content?.trim().length > 0)
      const hasContent = !!(rawText || hasSections || (sm.content && sm.content.trim().length > 0))

      if (!hasContent) {
        // 流刚起就停（没任何 token）→ 直接清，不留空消息
        return {
          streamingBySession: remainingStreams,
          abortBySession: remainingAborts,
          status: isCurrent ? 'idle' : s.status,
        }
      }

      // 构造 final message（与 case 'done' 同形态，但无 metadata）
      const finalMsg: Message = { ...sm }
      if (rawText && !hasSections) {
        // chit-chat 主路径：raw_stream → chit-chat section（AssistantMessage 非 streaming 渲染走 sections）
        finalMsg.sections = [{
          type: 'chit-chat',
          title: '',
          content: rawText,
          references: [],
        }]
      }
      delete (finalMsg as { raw_stream?: string }).raw_stream

      // 推到 messagesBySession[targetSid]（按 sid 索引，不污染其他 session）
      const existing = s.messagesBySession[targetSid] ?? []
      return {
        messagesBySession: { ...s.messagesBySession, [targetSid]: [...existing, finalMsg] },
        streamingBySession: remainingStreams,
        abortBySession: remainingAborts,
        status: isCurrent ? 'idle' : s.status,
      }
    })
  },

  sendMessage: async (projectId: string, question: string) => {
    const state = get()
    if (state.status === 'streaming' || state.status === 'submitting') return

    // ① currentSid 处理：新对话时为 null，后端 meta event 给真实 sid 后再补
    //    用占位 sid 让 user msg 也能写到 byId map（meta 后会把占位 key 的 messages 迁移过去）
    const initialSid = state.currentSessionId ?? tempId('sess')

    // ② 立即加一条 user 消息（临时 id）
    const userMsg: Message = {
      id: tempId('msg'),
      session_id: initialSid,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }
    // 空 assistant 占位（与 case 'meta' 创建的 newStreaming 同形态）：放进 streamingBySession[initialSid]，
    // 让 AssistantMessage 立刻显示「正在思考…」（streaming=true + 内容空）。meta 到达时被 realSid 的真 streaming 替换；
    // 中途点停止 → abort 的 !hasContent 分支直接清掉它（不残留空气泡）。
    const thinkingPlaceholder: Message = {
      id: tempId('msg'),
      session_id: initialSid,
      role: 'assistant',
      content: '',
      sections: [],
      tool_calls: {},
      created_at: new Date().toISOString(),
    }
    set(s => {
      const existing = s.messagesBySession[initialSid] ?? []
      return {
        messagesBySession: { ...s.messagesBySession, [initialSid]: [...existing, userMsg] },
        // 思考态占位：assistant 侧立刻冒「正在思考…」，乐观窗口（点发送→meta）不再只有孤零零的用户气泡
        streamingBySession: { ...s.streamingBySession, [initialSid]: thinkingPlaceholder },
        status: 'submitting',
        error: null,
        currentProjectId: projectId,
        // 乐观渲染：点发送的瞬间就把 currentSessionId 置为本会话（新对话=临时 sid）。
        // ChatPage 据此立刻把 user msg + 思考态渲染出来，不再干等后端首个 meta 往返（~1s）。
        // 既有会话续问时 initialSid===currentSessionId，等价 no-op；
        // meta 拿到真 sid 后此值被改写为 realSid（见下方 case 'meta'），临时 sid 经迁移逻辑替换。
        currentSessionId: initialSid,
      }
    })

    // ③ 发起 SSE 流式请求；ctrl 存到 abortBySession[initialSid]
    //    meta event 后如果 sid 变了（新对话），把 ctrl 迁移到真实 sid
    const ctrl = new AbortController()
    set(s => ({ abortBySession: { ...s.abortBySession, [initialSid]: ctrl } }))

    // 取最近 20 条历史（assistant 优先取 sections）— 用 byId map 取当前 sid
    const currentMsgs = get().messagesBySession[initialSid] ?? []
    const history = currentMsgs.slice(-20).map(m => {
      let text = m.content || ''
      if ((!text || text.trim() === '') && m.sections && m.sections.length > 0) {
        text = m.sections.map(s => (s.title ? `## ${s.title}\n${s.content}` : s.content)).join('\n\n')
      }
      return { role: m.role, content: text }
    })

    // metaSessionId 提升到 try/catch 外作用域 — catch 块需要访问以做错误归属（按 sid 清理）
    // 初始等于 initialSid（占位或既有 sid），meta event 收到后改写为真实 sid
    let metaSessionId: string = initialSid

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
          session_id: state.currentSessionId,
          history,
          model: useAuthStore.getState().user?.preferred_model ?? null,
        }),
        credentials: 'include',
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        // 识别 503 INFRA_UNHEALTHY → 标记 infra store，让 InfraBanner 立即弹出
        // SSE 用的是原生 fetch，不经过 axios 拦截器，需要在这里单独处理
        // 设计：[[基础设施健康检查与产品不可用-设计]] §4.7
        if (res.status === 503) {
          try {
            // JSON.parse：把响应体字符串解析成 JS 对象；若 body 不是合法 JSON 会抛异常，用 catch 忽略
            const body = JSON.parse(text) as { detail?: { code?: string } }
            if (body?.detail?.code === 'INFRA_UNHEALTHY') {
              // dynamic import：运行时按需加载，避免与 client.ts 形成循环依赖
              const { useInfraStore } = await import('@/store/infra')
              useInfraStore.getState().markUnhealthy('SSE 503 INFRA_UNHEALTHY')
            }
          } catch { /* JSON parse 失败时忽略，不影响主流程的错误抛出 */ }
        }
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
      }
      if (!res.body) throw new Error('Empty response body')

      set({ status: 'streaming' })

      // SSE 事件 — 用 metaSessionId（已在 try 外提升声明）作为 byId map key
      // 这样切走 currentSessionId 后，token 仍写到正确的 streamingBySession[metaSid]，不丢
      let stopped = false
      let metaMessageId: string | null = null
      let migratedFromTemp = false  // 占位 sid → 真实 sid 迁移只做一次

      // 内部 helper：根据 metaSessionId 更新 streamingBySession[sid]
      // 同步当前 UI 也展示（如果 currentSessionId === metaSessionId）
      const updateStream = (updater: (sm: Message) => Message) => {
        set(s => {
          const existing = s.streamingBySession[metaSessionId]
          if (!existing) return s
          const next = updater(existing)
          return {
            streamingBySession: { ...s.streamingBySession, [metaSessionId]: next },
          }
        })
      }

      const parser = createParser({
        onEvent: (msg: EventSourceMessage) => {
          if (stopped || !msg.event || !msg.data) return
          const data = tryParseJSON(msg.data) as Record<string, unknown>

          switch (msg.event) {
            case 'meta': {
              const realSid = (data.session_id as string) ?? metaSessionId
              metaMessageId = (data.message_id as string) ?? null

              // context_usage 校验
              const cu = data.context_usage
              const validCu =
                cu != null && typeof cu === 'object' &&
                typeof (cu as { pct?: unknown }).pct === 'number' &&
                typeof (cu as { used_tokens?: unknown }).used_tokens === 'number' &&
                typeof (cu as { window_tokens?: unknown }).window_tokens === 'number' &&
                typeof (cu as { history_trimmed?: unknown }).history_trimmed === 'boolean'

              set(s => {
                // 占位 sid → 真实 sid 迁移（新对话首次拿到 server 给的 sid）
                let nextMessagesBySession = s.messagesBySession
                let nextAbortBySession = s.abortBySession
                let nextStreamingBySession = s.streamingBySession
                if (!migratedFromTemp && realSid !== initialSid && initialSid.startsWith('sess_tmp_')) {
                  // 把 messagesBySession[initialSid]（user msg 暂存于此）迁移到 [realSid]
                  const tempMsgs = s.messagesBySession[initialSid] ?? []
                  const { [initialSid]: _gone, ...rest } = s.messagesBySession
                  nextMessagesBySession = { ...rest, [realSid]: tempMsgs.map(m =>
                    m.session_id === initialSid ? { ...m, session_id: realSid } : m
                  ) }
                  // ctrl 也迁移到 realSid
                  const { [initialSid]: ctrlGone, ...restAborts } = s.abortBySession
                  if (ctrlGone) nextAbortBySession = { ...restAborts, [realSid]: ctrlGone }
                  // 删掉临时 sid 的「正在思考」占位（下面会在 realSid 下重建真 streaming，避免占位孤儿残留）
                  const { [initialSid]: _streamGone, ...restStream } = s.streamingBySession
                  nextStreamingBySession = restStream
                  migratedFromTemp = true
                }

                // 创建空的 streamingMessage 放到 byId map
                const newStreaming: Message = {
                  id: metaMessageId ?? tempId('msg'),
                  session_id: realSid,
                  role: 'assistant',
                  content: '',
                  sections: [],
                  tool_calls: {},
                  created_at: new Date().toISOString(),
                }

                // 仅当用户没切走时才同步 currentSessionId / contextUsage：
                //   - currentSessionId === initialSid（含 null / tempId / 已 load 的 sid）→ 用户仍在本会话
                //   - 否则用户已 loadSession(其他 sid)，本 meta 不应抢走 UI
                // 这样：用户在新对话发送 → 切走 → meta 拿到 realSid → 不抢 URL；
                // 后台 SSE 仍写 streamingBySession[realSid]；切回时 selector 自然恢复流式。
                const isStillOnThisSession =
                  s.currentSessionId === initialSid ||
                  (initialSid.startsWith('sess_tmp_') && s.currentSessionId === null)

                return {
                  messagesBySession: nextMessagesBySession,
                  abortBySession: nextAbortBySession,
                  // 用 nextStreamingBySession（已删临时 sid 占位）再在 realSid 下建真 streaming；
                  // 既有会话续问时 initialSid===realSid，这里直接覆盖同 key 的占位，无孤儿。
                  streamingBySession: { ...nextStreamingBySession, [realSid]: newStreaming },
                  currentSessionId: isStillOnThisSession ? realSid : s.currentSessionId,
                  contextUsage: isStillOnThisSession && validCu ? (cu as ContextUsage) : s.contextUsage,
                }
              })

              metaSessionId = realSid

              // 记忆 lastSession
              if (projectId) {
                useProjectStore.getState().setLastSession(projectId, realSid)
              }
              break
            }

            case 'tool_call': {
              const payload = data as unknown as ToolCallPayload
              updateStream(sm => {
                const tcs = { ...(sm.tool_calls || {}) }
                const existing = tcs[payload.id] || { starting: payload }
                // at 优先用后端给的流式偏移（调工具时刻的字符数，权威）；缺失时回退本地 raw_stream 长度。
                // 后端本地都缺 → 末尾。修"调用图甩到最后"。
                const atPos = typeof payload.at === 'number' ? payload.at : (sm.raw_stream || '').length
                if (payload.phase === 'starting') {
                  // 渲染类工具（render_call_graph）：starting 即按 at 插一个「调用中」loading 占位（等待层），
                  // 让用户在图生成期间看到"正在画调用图"，complete 时原位换成真图。
                  tcs[payload.id] = {
                    ...existing, starting: payload,
                    ...(payload.name === 'render_call_graph'
                      ? { render: { kind: 'loading', data: null }, at: atPos }
                      : {}),
                  }
                } else {
                  // complete：有 render → 原位换真图；渲染类工具最终没出图（无调用边）→ 清掉 loading 占位。
                  const next = { ...existing, complete: payload }
                  if (payload.render != null) {
                    next.render = payload.render
                    next.at = atPos
                  } else if (next.render && next.render.kind === 'loading') {
                    delete next.render
                    delete next.at
                  }
                  tcs[payload.id] = next
                }
                return { ...sm, tool_calls: tcs }
              })
              break
            }

            case 'token': {
              const delta = (data.delta as string) ?? ''
              if (!delta) break
              updateStream(sm => ({ ...sm, raw_stream: (sm.raw_stream || '') + delta }))
              break
            }

            case 'thinking': {
              const delta = (data.delta as string) ?? ''
              if (!delta) break
              // 累加到 streaming.thinking（范式同 token 的 raw_stream 累计）
              updateStream(sm => ({ ...sm, thinking: (sm.thinking ?? '') + delta }))
              break
            }

            case 'todo': {
              // 后端每次全量发当前 todo 列表 → 覆盖（非累加）
              const items = (data.items as TodoItem[]) ?? []
              updateStream(sm => ({ ...sm, todos: items }))
              break
            }

            case 'step':
              break

            case 'section_start': {
              const type = data.section as SectionType
              const title = (data.title as string) ?? ''
              updateStream(sm => ({ ...sm, sections: startSection(sm.sections ?? [], type, title) }))
              break
            }

            case 'content': {
              const type = data.section as SectionType
              const delta = (data.delta as string) ?? ''
              updateStream(sm => ({ ...sm, sections: applyContentDelta(sm.sections ?? [], type, delta) }))
              break
            }

            case 'section_done': {
              const type = data.section as SectionType
              const references = data.references as Reference[] | undefined
              updateStream(sm => ({ ...sm, sections: finishSection(sm.sections ?? [], type, references) }))
              break
            }

            case 'done': {
              const metadata: MessageMetadata = {
                entry_points: [],
                cited_entities: (data.cited_entities as string[]) ?? [],
                interpretation_freshness: new Date().toISOString(),
                token_usage: (data.total_tokens as number) ?? 0,
                latency_ms: (data.latency_ms as number) ?? 0,
              }
              set(s => {
                const sm = s.streamingBySession[metaSessionId]
                if (!sm) return s
                const finalMsg: Message = { ...sm, metadata }
                // 移除 raw_stream 字段（非 streaming 时不再用）
                delete (finalMsg as { raw_stream?: string }).raw_stream

                const existing = s.messagesBySession[metaSessionId] ?? []
                const nextMessages = [...existing, finalMsg]

                // 删 streamingBySession[metaSessionId] + abortBySession[metaSessionId]
                const { [metaSessionId]: _streamGone, ...remainingStreams } = s.streamingBySession
                const { [metaSessionId]: _ctrlGone, ...remainingAborts } = s.abortBySession

                const isCurrent = s.currentSessionId === metaSessionId
                const usage = isCurrent ? computeUsageFromMessages(nextMessages) : s.contextUsage
                // 保留 history_trimmed 提示
                if (isCurrent && usage && s.contextUsage?.history_trimmed) {
                  usage.history_trimmed = true
                }

                return {
                  messagesBySession: { ...s.messagesBySession, [metaSessionId]: nextMessages },
                  streamingBySession: remainingStreams,
                  abortBySession: remainingAborts,
                  status: isCurrent ? 'idle' : s.status,
                  contextUsage: usage,
                }
              })

              // 新会话：把 session 加到 sidebar
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
              set(s => {
                const { [metaSessionId]: _streamGone, ...remainingStreams } = s.streamingBySession
                const { [metaSessionId]: _ctrlGone, ...remainingAborts } = s.abortBySession
                const isCurrent = s.currentSessionId === metaSessionId
                return {
                  status: isCurrent ? 'error' : s.status,
                  error: isCurrent ? errMsg : s.error,
                  streamingBySession: remainingStreams,
                  abortBySession: remainingAborts,
                }
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

      // 兜底：流自然结束但没收到 done
      set(s => {
        const stillStreaming = s.streamingBySession[metaSessionId]
        if (!stillStreaming) return s
        const { [metaSessionId]: _gone, ...remaining } = s.streamingBySession
        const { [metaSessionId]: _ctrlGone, ...remainingAborts } = s.abortBySession
        const isCurrent = s.currentSessionId === metaSessionId
        return {
          streamingBySession: remaining,
          abortBySession: remainingAborts,
          status: isCurrent ? 'idle' : s.status,
        }
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户主动 abort — 已由 abort action 处理；这里仅同步状态
        return
      }
      set(s => {
        const isCurrent = s.currentSessionId === metaSessionId
        const { [metaSessionId]: _streamGone, ...remainingStreams } = s.streamingBySession
        const { [metaSessionId]: _ctrlGone, ...remainingAborts } = s.abortBySession
        return {
          status: isCurrent ? 'error' : s.status,
          error: isCurrent ? (err as Error).message : s.error,
          streamingBySession: remainingStreams,
          abortBySession: remainingAborts,
        }
      })
    }
  },

  voteMessage: async (projectId, sessionId, messageId, vote) => {
    await apiVoteMessage({ projectId, sessionId, messageId, vote })
  },

  reset: () => {
    // 切账号 / 登出时：abort 所有 in-flight + 清所有 byId map
    const s = get()
    Object.values(s.abortBySession).forEach(c => c.abort())
    set({
      currentSessionId: null,
      currentProjectId: null,
      messagesBySession: {},
      streamingBySession: {},
      abortBySession: {},
      status: 'idle',
      error: null,
      contextUsage: null,
    })
  },
}))
