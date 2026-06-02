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
  /**
   * markdown 内容；可能含 [entity_id|text] 标记。
   *
   * 例外（2026-06-02）：当 type === 'call_chain' 时，content 约定为
   * `JSON.stringify(CallChainData)` —— 前端会先尝试 `tryParseCallChain()`，
   * 命中 JSON → 渲染为 ReactFlow 调用图（CallChainFlow）；
   * 不命中（兼容老数据/降级文本）→ 走原 markdown / mermaid 渲染。
   */
  content: string
  references?: Reference[]
}

// ─── call_chain 段的 ReactFlow 数据结构（v1.11 接 ReactFlow，2026-06-02）─────

/**
 * 调用图节点 —— 后端 _build_call_chain 产出 / LLM 直接吐
 *
 * 设计上 label 是显示文本（如方法短名），其它字段是元数据用于：
 *   - kind: 节点配色 + 图标（Controller=蓝 / Service=绿 / Mapper=橙 / Method=灰）
 *   - classOf + sig: 用于 hover 提示完整签名
 *   - filePath + lineNumber: 用于点击跳源码（复用现有 EntityRef 跳转逻辑）
 *   - entityId: 用于挂到 ke://method:... 让 EntityRef 拦截器接管
 */
export interface CallChainNode {
  /** 图内唯一 id（用于 edge 引用），建议 'n1' / 'n2' 等短串 */
  id: string
  /** 节点显示文本 —— 用户在图上看到的字（方法短名 / 业务说明） */
  label: string
  /** 节点角色，决定配色 / 图标；后端可不填，前端默认 'method' */
  kind?: 'controller' | 'service' | 'mapper' | 'method' | 'external'
  /** 类全限定名（如 'com.foo.UserController'），hover 时显示 */
  classOf?: string
  /** 方法签名（如 '(Long, String)'），hover 时拼接显示 */
  sig?: string
  /** 源码相对路径，用于跳转 */
  filePath?: string
  /** 行号 */
  lineNumber?: number
  /** entity_id（含 scheme），让点击节点能复用 EntityRef 跳转链路 */
  entityId?: string
}

/**
 * 调用图边 —— from/to 引用 CallChainNode.id
 * label 是边上业务说明文字（如"触发订单收货确认"）
 */
export interface CallChainEdge {
  from: string
  to: string
  /** 边上显示的中文业务动作；可选 */
  label?: string
}

/** 整张调用图 = nodes + edges */
export interface CallChainData {
  nodes: CallChainNode[]
  edges: CallChainEdge[]
}

/**
 * 尝试把 content 字符串解析为 CallChainData。
 *
 * 解析失败（非 JSON / schema 不符）返回 null，调用方负责走 fallback。
 *
 * 容错点：
 *   - content 前后可能有空白
 *   - 后端可能用 ```json fence 包了一层，剥掉
 *   - nodes/edges 必须是数组才算合法
 *
 * @param content section.content 原文
 * @returns CallChainData | null
 */
export function tryParseCallChain(content: string): CallChainData | null {
  // 边界：空内容直接 null
  if (!content) return null

  // 1. 剥可能的 markdown fence 包装：```json\n{...}\n```
  let candidate = content.trim()
  if (candidate.startsWith('```')) {
    // 找第一个换行后到最后一个 ``` 之间的内容
    const firstNewline = candidate.indexOf('\n')
    const lastFence = candidate.lastIndexOf('```')
    if (firstNewline > 0 && lastFence > firstNewline) {
      candidate = candidate.slice(firstNewline + 1, lastFence).trim()
    }
  }

  // 2. 必须以 `{` 开头才尝试 parse —— 节省 try/catch 开销 + 避免误识别
  if (!candidate.startsWith('{')) return null

  try {
    const data = JSON.parse(candidate)
    // 3. schema 校验：必须含 nodes / edges 数组
    if (!data || typeof data !== 'object') return null
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null
    // 4. 节点至少要有 id 字段（label 可空）
    if (data.nodes.some((n: unknown) => !n || typeof (n as CallChainNode).id !== 'string')) return null
    // 5. 边至少要有 from/to 字段
    if (data.edges.some((e: unknown) => {
      const ed = e as CallChainEdge
      return !ed || typeof ed.from !== 'string' || typeof ed.to !== 'string'
    })) return null
    return data as CallChainData
  } catch {
    // JSON 不合法 → null，调用方走旧 mermaid / markdown 路径
    return null
  }
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
  /** C-frontend：agent 推理增量累计（灰字折叠展示）。 */
  thinking?: string
  /** C-frontend：agent 多步任务 checklist（todo 事件全量快照）。 */
  todos?: TodoItem[]
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
  | 'thinking'       // C-frontend：agent 推理增量（灰字折叠）
  | 'todo'           // C-frontend：多步任务 checklist 快照

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

/** C-frontend：todo checklist 一项（后端 todo_write 元工具，设计 §3.3）。 */
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}
/** thinking 事件 payload：推理增量文本。 */
export interface ThinkingPayload { delta: string }
/** todo 事件 payload：当前 todo 全量快照。 */
export interface TodoPayload { items: TodoItem[] }

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
  /** C-frontend：agent 实际查过的 entity_id（引用溯源，后端 Plan C2）。 */
  cited_entities?: string[]
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
