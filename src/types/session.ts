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
  /** 归档时间。null/undefined = 活动 session；ISO 8601 字符串 = 已归档。
   * 设计：[[会话归档-设计]] §7.1。 */
  archived_at?: string | null
}

/**
 * 会话详情（GET /sessions/{id} 返回）—— Session + 全部 Message。
 */
export interface SessionDetail {
  session: Session
  messages: Message[]
}

/**
 * GET /api/user/archived-sessions 返回的单条归档 session 行。
 * 与 Session 类型字段相同，只是 archived_at 强制非空。
 * 设计：[[会话归档-设计]] §5.5。
 */
export interface ArchivedSession {
  id: string
  title: string | null
  archived_at: string  // ISO 8601；归档时间，必填
  created_at: string
  updated_at: string
  message_count: number
}

/**
 * 跨工程归档列表的「工程分组」。
 */
export interface ArchivedByProject {
  project_id: string
  project_name: string
  sessions: ArchivedSession[]
}
