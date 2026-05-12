/**
 * src/types/audit.ts
 *
 * 审计日志（Audit Log）相关 TypeScript 类型定义。
 *
 * 对应后端 v2 audit_router.py / audit_models.py。
 * 审计日志记录系统中所有敏感操作（如创建/删除凭证、修改成员权限等），
 * 用于安全追溯和合规审计。
 *
 * 设计文档：[[audit-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */

// ─── AuditLogEntry ────────────────────────────────────────────────────────────

/**
 * 单条审计日志记录。
 *
 * 字段说明：
 *   - actor_user_id / actor_username：系统任务触发时可能为 null（无操作人）
 *   - metadata：灵活的键值对，记录操作的额外上下文（如旧值/新值、变更原因等）
 *     Record<string, unknown> 是 TS 内置工具类型：
 *     等效于 { [key: string]: unknown }，表示"key 是字符串、value 可以是任意类型"
 *   - ip_address：记录操作来源 IP，null 表示系统内部操作
 */
export interface AuditLogEntry {
  /** 日志记录唯一 ID（数据库自增整数） */
  id: number
  /** 操作人用户 ID，系统触发时为 null */
  actor_user_id: number | null
  /** 操作人用户名，系统触发时为 null */
  actor_username: string | null
  /** 操作动词，例如 "create_credential"、"delete_member"、"update_project" */
  action: string
  /** 被操作的资源类型，例如 "credential"、"group"、"project_member" */
  resource_type: string
  /** 被操作的资源 ID（字符串，兼容数字 ID 和 slug） */
  resource_id: string
  /**
   * 操作附加元数据（如变更前后的值）。
   * Record<string, unknown> 等效于 { [key: string]: unknown }：
   *   - string：所有 key 都是字符串类型
   *   - unknown：value 可以是任意类型（比 any 更安全，使用前需类型断言）
   */
  metadata: Record<string, unknown>
  /** 操作来源 IP 地址，系统内部触发时为 null */
  ip_address: string | null
  /** 日志创建时间，ISO 8601 格式字符串 */
  created_at: string
}

// ─── AuditLogResponse ─────────────────────────────────────────────────────────

/**
 * 审计日志分页响应（GET /admin/audit-logs、GET /groups/{gid}/audit-logs）。
 *
 * 分页说明：
 *   - total：满足筛选条件的总记录数（不是本页条数）
 *   - page：当前页码，从 1 开始
 *   - limit：每页最大条数（由请求参数决定）
 *
 * 典型用法：
 *   总页数 = Math.ceil(total / limit)
 *   是否有下一页 = page * limit < total
 */
export interface AuditLogResponse {
  /** 当前页的日志条目列表 */
  entries: AuditLogEntry[]
  /** 总记录数（用于计算分页） */
  total: number
  /** 当前页码（从 1 开始） */
  page: number
  /** 每页最大条数 */
  limit: number
}
