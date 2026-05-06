/**
 * src/types/session.ts
 *
 * 会话相关 TypeScript 类型。
 *
 * Session 是消息的容器（一个 session 含多条 Message）。
 * 类型依赖：Session（独立）+ Message（来自 chat.ts）。
 *
 * 设计文档：[[首页设计]] §6.3
 */

import type { Message } from './chat'

/**
 * 一个问答会话。每次 + 新对话 创建一个，后续追问追加 message。
 */
export interface Session {
  id: string
  /** 会话归属的工程。切工程时左栏会话列表按这个分组。 */
  project_id: string
  /** 自动从首条消息生成的标题（最多 30 字），用户可改。 */
  title: string
  /** ISO 8601。 */
  created_at: string
  /** ISO 8601；最近活跃时间（左栏排序用）。 */
  updated_at: string
  /** 消息条数（缓存值；左栏列表一目了然）。 */
  message_count: number
}

/**
 * 会话详情（GET /sessions/{id} 返回）—— Session + 全部 Message。
 */
export interface SessionDetail {
  session: Session
  messages: Message[]
}
