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

/** 默认模型上下文窗口（与后端 KE_MODEL_CONTEXT_WINDOW 一致：1M tokens）。 */
const _DEFAULT_CTX_WINDOW = 1_000_000

/** 单条消息估算 tokens（与后端 estimate_tokens 公式对齐：1 token ≈ 1.5 字符）。
 *
 * Claude Code 风格的"会话累计 token 显示"基础。assistant 真实内容在 sections 里，
 * 不能只看 m.content（参 chat.ts:188 注释）。
 */
function estimateMessageTokens(m: Pick<Message, 'content' | 'sections' | 'role'>): number {
  let text = m.content || ''
  // assistant：真实内容在 sections，content 通常空
  if ((!text || text.trim() === '') && m.sections && m.sections.length > 0) {
    text = m.sections.map(s => (s.title ? s.title + s.content : s.content)).join('')
  }
  // Math.ceil 保守偏大（同后端 context_budget.estimate_tokens）
  return Math.ceil(text.length / 1.5)
}

/** 由 messages 数组累计算会话整体 token 用量（Claude Code 风：累计而非本轮）。
 *
 * 替代后端 SSE meta 的"本轮注入量"语义 — 后端的本轮量只能反映 prompt 压力，
 * 但用户期望看到"整个会话至今用了多少 tokens"。每轮 done 后重算即可。
 */
function computeUsageFromMessages(messages: Message[]): ContextUsage {
  const used = messages.reduce((acc, m) => acc + estimateMessageTokens(m), 0)
  const window = _DEFAULT_CTX_WINDOW
  // Math.min clamp 防超 100%（极端长会话）；pct 1 位小数与后端一致
  const pct = window > 0 ? Math.min(100, (used / window) * 100) : 0
  return {
    used_tokens: used,
    window_tokens: window,
    pct: Math.round(pct * 10) / 10,
    history_trimmed: false,  // 累计语义下 trim 信息由 SSE meta 单独保留（见 done 事件）
  }
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
  /** 上下文窗口用量（每轮 meta 刷新；新会话/切会话/重置归 null）。设计 §5.2 */
  contextUsage: ContextUsage | null

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
  contextUsage: null,

  startNew: (projectId: string) => {
    set({
      currentSessionId: null,
      currentProjectId: projectId,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
      contextUsage: null,
    })
  },

  loadSession: async (projectId: string, sessionId: string) => {
    set({ status: 'submitting', error: null })
    try {
      const detail = await getSessionDetail(projectId, sessionId)

      // 2026-05-21 — Step 1 流式持续：判断是否切回正在流式的同一 session
      //   场景：sess_A 流式中 → 用户切 sess_B → 切回 sess_A
      //   原行为：streamingMessage 在第一次切走时被清 null → 切回时 fs 还没写完 → 主区空白
      //   新行为：切回原流式 session 时，保留 streamingMessage + status=streaming
      //          (fetch 在 background 持续 update streamingMessage，UI 立刻看到累积进度)
      const live = get()
      const currentStreaming = live.streamingMessage
      const isResumingOwnStream =
        currentStreaming != null && currentStreaming.session_id === sessionId

      set({
        currentSessionId: sessionId,
        currentProjectId: projectId,
        messages: detail.messages,
        // 切回原流式 session 时保留；其他情况清掉（防其他 session 的流式残留污染 UI）
        streamingMessage: isResumingOwnStream ? currentStreaming : null,
        status: isResumingOwnStream ? 'streaming' : 'idle',
        contextUsage: computeUsageFromMessages(detail.messages),
      })
    } catch (err) {
      // 404 = sessionId 失效（用户切账号后 URL 残留 / session 已被删 / 跨用户访问被拒）
      // 不要把 404 错误 banner 抛给用户，回退到 startNew 状态即可，由 ChatPage 监听
      // currentSessionId=null 触发 URL 重定向到 /project/{projectId}（清掉残留尾巴）
      const axErr = err as { response?: { status?: number } }
      if (axErr?.response?.status === 404) {
        set({
          currentSessionId: null,
          currentProjectId: projectId,
          messages: [],
          streamingMessage: null,
          status: 'idle',
          contextUsage: null,
          error: null,
        })
        return
      }
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

    // 取最近 20 条历史发给后端（多轮对话）
    // 历史 bug：曾经只取 slice(-10) → 多轮长对话早期信息丢失（5 种算法只答 2 种）
    // 改 20 是临时缓和（仍依赖后端 §18 trim_history_to_budget 按 token 兜底）；
    // 根治方案待 S6 后端直接从 fs 读 messages，前端不再传 history。
    //
    // 双重 bug：assistant 的真正回答在 m.sections（6 段式或单段 chit-chat），
    // 而 m.content 通常是空字符串。原代码直接 m.content → LLM 看到的历史只剩
    // user 提问 + assistant 空回复 → 上下文等同没记忆（"java 排序算法" 只答 2 种）。
    // 修：assistant 优先取 sections 文本拼接；为空才 fallback 到 content。
    const history = get().messages.slice(-20).map(m => {
      let text = m.content || ''
      if ((!text || text.trim() === '') && m.sections && m.sections.length > 0) {
        // 多段式（business 6 段）：用 markdown 风格拼回，保留语义边界；
        // chit-chat 单段：title 为空，直接取 content
        text = m.sections.map(s => (s.title ? `## ${s.title}\n${s.content}` : s.content)).join('\n\n')
      }
      return { role: m.role, content: text }
    })

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
          // 多模型支持（2026-05-21）：发当前用户的 preferred_model
          // 后端校验 + 兜底：未知 model 自动回退默认（详见 llm_factory.get_llm_provider）
          // 若 user 未设置 preferred_model（首次登录），传 null，后端走 DEFAULT_MODEL_ID
          model: useAuthStore.getState().user?.preferred_model ?? null,
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
              // 上下文窗口用量（设计 §5.2/§6）：全字段形状校验，任一缺失/类型不符
              // 一律存 null（绝不抛、绝不存结构残缺对象——否则进度条 NaN%/徽标失效）
              const cu = data.context_usage
              const validCu =
                cu != null && typeof cu === 'object' &&
                typeof (cu as { pct?: unknown }).pct === 'number' &&
                typeof (cu as { used_tokens?: unknown }).used_tokens === 'number' &&
                typeof (cu as { window_tokens?: unknown }).window_tokens === 'number' &&
                typeof (cu as { history_trimmed?: unknown }).history_trimmed === 'boolean'
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
                contextUsage: validCu ? (cu as ContextUsage) : null,
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
              // ⚠️ 不要在这里 set stopped=true（2026-05-16 修）：
              // 后端在 done 之后还会（首轮异步总结时）发一个 session_title 事件。
              // 若此处 stopped=true，下面的 `while (!stopped)` 循环立即退出、
              // reader 停止读取 → session_title 永远收不到 → 侧栏标题不刷新。
              // 循环的退出由 reader.read() 的 done=true（流自然结束）兜底，
              // 后端总会在 done(+可选 session_title) 后关流，所以不会卡死。
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
                const nextMessages = [...s.messages, finalMsg]
                // Claude Code 风进度条：done 后重算累计 token（覆盖 meta 阶段的本轮注入量）。
                // 保留 meta 阶段拿到的 history_trimmed 标志（若 SSE 已提示"自动压缩"则保留提示）。
                const usage = computeUsageFromMessages(nextMessages)
                if (s.contextUsage?.history_trimmed) {
                  usage.history_trimmed = true
                }
                return {
                  messages: nextMessages,
                  streamingMessage: null,
                  status: 'idle',
                  _abortCtrl: null,
                  contextUsage: usage,
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
      contextUsage: null,
    })
  },
}))
