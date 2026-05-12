/**
 * src/api/auditLogs.ts
 *
 * 全局审计日志（Admin Audit Logs）HTTP API 的薄封装。
 *
 * 后端路由：knowledge-engineering-auth/src/service/audit_router.py
 *   GET    /admin/audit-logs         listAdminAuditLogs
 *
 * 组级别的审计日志（GET /groups/{gid}/audit-logs）封装在 groups.ts，
 * 这里只处理全局 admin 视角的查询。
 */
import { apiClient } from './client'
import type { AuditLogResponse } from '@/types/audit'

// ─── Admin Audit Logs ─────────────────────────────────────────────────────────

/**
 * 查询全局审计日志（admin only，支持多维度筛选和分页）。
 *
 * 筛选参数说明：
 *   - page / limit：分页控制，limit 建议 10-100
 *   - action：操作类型过滤，例如 "create_credential"、"delete_member"
 *   - resource_type：资源类型过滤，例如 "credential"、"group"、"project_member"
 *   - actor_user_id：按操作人 ID 过滤（查某用户做了什么）
 *   - since / until：时间范围过滤，ISO 8601 格式，例如 "2026-05-01T00:00:00Z"
 *
 * 所有参数均可选（? 号），未传时后端返回全部日志（按时间倒序）。
 *
 * @returns AuditLogResponse 包含 entries 列表及分页信息
 */
export async function listAdminAuditLogs(params?: {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页条数，建议 10-100 */
  limit?: number
  /** 操作类型过滤，例如 "create_credential" */
  action?: string
  /** 资源类型过滤，例如 "group"、"project_member" */
  resource_type?: string
  /** 按操作人 user_id 过滤 */
  actor_user_id?: number
  /** 时间范围起点（ISO 8601 格式字符串） */
  since?: string
  /** 时间范围终点（ISO 8601 格式字符串） */
  until?: string
}): Promise<AuditLogResponse> {
  const { data } = await apiClient.get<AuditLogResponse>('/admin/audit-logs', { params })
  return data
}
