/**
 * src/types/chat.ts
 *
 * 对话 / 消息 / 6 段式答案 / SSE 事件 相关类型。
 *
 * 注：这个文件**不依赖**其他业务类型文件（避免循环依赖）。
 * Session 类型在 session.ts，反向依赖本文件的 Message。
 *
 * 设计文档：
 *   - [[首页设计]] §5.2 (6 段式)
 *   - [[首页设计]] §6.3 (TypeScript 类型)
 *   - [[首页设计]] §6.4 (SSE 事件协议)
 */

// ─── 实体引用（点击跳详情用）─────────────────────────────────────────────────

/**
 * 答案段落里"可点击的实体"，前端把它渲染成 <EntityLink>。
 * 后端 LLM 用 `[entity_id|display_text]` 标记，前端 markdown 解析时转链接。
 */
export interface Reference {
  /** 形如 'method://com.bank.deposit.openAccount'。 */
  entity_id: string
  /** 用户可读文本，如 'DepositController.openAccount()'。 */
  display_text: string
  kind: 'method' | 'class' | 'table' | 'doc'
}

// ─── 6 段式答案结构 ─────────────────────────────────────────────────────────

/**
 * v1 6 段式答案的 section 类型枚举。
 * v2 完整 Mode B 会再加 'extension' / 'risks' 两段（共 8 段式）。
 */
export type SectionType =
  | 'overview'      // 📋 业务概述
  | 'entry_point'   // 🚪 入口方法
  | 'call_chain'    // 🔀 调用链路
  | 'db_ops'        // 💾 数据库操作
  | 'rules'         // ⚠️ 关键约束/规则
  | 'sources'       // 🔗 引用源（含新鲜度徽章）
  | 'chit-chat'     // 💬 闲聊单段（v1.2，前端简化渲染无 h3 header）

/**
 * 答案的一段。LLM 输出 sections[]，前端按段渲染（每段独立卡片）。
 */
export interface Section {
  type: SectionType
  /** 中文标题，如 '业务概述'。 */
  title: string
  /** markdown 内容；可能含 [entity_id|text] 标记。 */
  content: string
  references?: Reference[]
}

// ─── 消息 metadata ──────────────────────────────────────────────────────────

/**
 * assistant 消息额外携带的元信息。用于：
 * - entry_points: LLM 选中的入口方法（前端可高亮）
 * - cited_entities: 答案里引用了哪些实体（v1.5 链路图组件用）
 * - interpretation_freshness: 解读基于何时的代码生成（FreshnessBadge 显示）
 * - token_usage / latency_ms: 监控 / 成本追踪
 */
export interface MessageMetadata {
  entry_points: string[]
  cited_entities: string[]
  /** ISO 8601。 */
  interpretation_freshness: string
  token_usage: number
  latency_ms: number
}

// ─── 消息本体 ───────────────────────────────────────────────────────────────

/**
 * 一条消息 — user / assistant 都用这个类型。
 * - role==='user' 时 sections / metadata 通常缺省
 * - role==='assistant' 时 sections 必填、content 可选作 markdown 兜底
 */
export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  /** markdown 文本；assistant 主要走 sections，content 是降级兜底。 */
  content: string
  sections?: Section[]
  metadata?: MessageMetadata
  /**
   * v1.3 ReAct：LLM 在本条 assistant 消息生成过程中调用的工具列表。
   * Map(id → {starting, complete?})，前端用 ToolCallCard 渲染。
   * 使用 Record 替代 Map 方便 JSON 序列化（持久化时直接用）。
   */
  tool_calls?: Record<string, { starting: ToolCallPayload; complete?: ToolCallPayload }>
  /**
   * v1.6：LLM 流式输出的"原始 token 累计"。
   * 仅在 streaming 期间存在；流末解析出 sections 后 UI 不再显示这个字段。
   * 用 ChatGPT 同款打字机效果展示。
   */
  raw_stream?: string
  /** ISO 8601。 */
  created_at: string
}

// ─── SSE 事件协议 ───────────────────────────────────────────────────────────

/**
 * SSE 事件类型枚举（详见 spec §6.4）。
 * 后端按这个顺序发：meta → step* → (section_start → content* → section_done)+ → done
 */
export type SSEEventType =
  | 'meta'           // 会话/计划信息
  | 'step'           // 中间步骤（"检索代码..." "提取链路..."）
  | 'section_start'  // 一段开始
  | 'content'        // token 增量
  | 'section_done'   // 一段结束（含 references）
  | 'done'           // 整个回答完成
  | 'error'          // 出错
  | 'tool_call'      // v1.3 ReAct：LLM 调工具前后各发一次
  | 'token'          // v1.6：LLM 流式输出的单个 token chunk

/**
 * SSE 事件通用包装。data 类型由具体 event 决定（见各事件 payload 类型）。
 */
export interface SSEEvent<T = unknown> {
  event: SSEEventType
  data: T
}

// ─── 各 SSE 事件的 data payload 类型（按 spec §6.4）──────────────────────

/** 上下文窗口用量（后端 qa_router 每轮经 meta 事件发；设计 §5.1）。 */
export interface ContextUsage {
  used_tokens: number
  window_tokens: number
  /** 后端已 clamp 0–100、1 位小数。 */
  pct: number
  /** 本轮是否触发了 §18 自动裁史/压缩。 */
  history_trimmed: boolean
}

export interface MetaPayload {
  session_id: string
  message_id: string
  plan_steps: string[]
  entry_points?: string[]
  /** v1.1 路由决策：skill 名（business / dependency / data-flow / architecture）。 */
  skill_id?: string
  /** v1.1：路由来源 'keyword' | 'llm' | 'llm-fallback' | 'llm-error'。 */
  route_source?: string
  /** v1.1：关键词路径命中的具体词（用于 UI 解释"识别到 X / Y"）。 */
  matched_keywords?: string[]
  /** 上下文窗口用量（旧后端/ chit-chat 不发 → 可选）。设计 §5.1 */
  context_usage?: ContextUsage
}

export interface StepPayload {
  /** searching / chain_extraction / synthesizing / etc. */
  phase: string
  desc: string
}

/**
 * v1.3 ReAct tool_call 事件 payload。
 * - phase='starting'：LLM 刚发出调用，没结果
 * - phase='complete'：已经执行完，result_preview 是序列化的 dict 截断
 */
export interface ToolCallPayload {
  phase: 'starting' | 'complete'
  /** OpenAI 给的调用 id，用来配对 starting 和 complete。 */
  id: string
  /** 工具名，如 'ke_callees' / 'ke_search'。 */
  name: string
  /** phase==='starting' 时存在：LLM 传给工具的入参。 */
  arguments?: Record<string, unknown>
  /** phase==='complete' 时存在：工具返回的 JSON 字符串预览（前 600 字符）。 */
  result_preview?: string
}

/**
 * v1.6 LLM streaming token 事件 payload。
 * 每个 LLM chunk 一条；store 累计到 streamingMessage.raw_stream。
 */
export interface TokenPayload {
  delta: string
}

export interface SectionStartPayload {
  section: SectionType
  title: string
}

export interface ContentPayload {
  section: SectionType
  /** token 增量；前端累积渲染。 */
  delta: string
}

export interface SectionDonePayload {
  section: SectionType
  references?: Reference[]
}

export interface DonePayload {
  session_id: string
  message_id: string
  total_tokens: number
  cost_yuan: number
  latency_ms: number
}

export interface ErrorPayload {
  code: string
  message: string
  /** true 表示前端可显示重试按钮；false 表示直接终态。 */
  recoverable: boolean
}

// ─── 前端 chat 状态机 ───────────────────────────────────────────────────────

/**
 * Chat 顶层状态（spec §3.3）。
 * - idle: 未发起请求（包含初始空状态）
 * - submitting: POST 发了但还没收到首个 SSE 事件
 * - streaming: 正在接收 SSE 流
 * - error: 出错（可重试）
 */
export type ChatStatus = 'idle' | 'submitting' | 'streaming' | 'error'
