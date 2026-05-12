/**
 * src/api/users.ts
 *
 * Admin 用户管理 HTTP API 的薄封装。
 *
 * 后端路由：knowledge-engineering-auth/src/service/admin_user_router.py
 *   GET    /admin/users              listAdminUsers
 *   POST   /admin/users              createAdminUser
 *   PATCH  /admin/users/{uid}        updateAdminUser
 *   DELETE /admin/users/{uid}        deleteAdminUser
 *
 * 所有接口需要 admin 权限（后端 middleware 校验），
 * 401/403 由 apiClient 拦截器统一处理（无需在此处理）。
 */
import { apiClient } from './client'
import type {
  AdminUser,
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
} from '@/types/user'

// ─── Admin Users API ──────────────────────────────────────────────────────────

/**
 * 列出所有用户（admin only）。
 *
 * 支持可选的分页和搜索参数：
 *   - page / limit：分页控制
 *   - search：按用户名或邮箱模糊搜索
 */
export async function listAdminUsers(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<AdminUser[]> {
  const { data } = await apiClient.get<{ users: AdminUser[] }>('/admin/users', { params })
  return data.users
}

/**
 * 创建新用户（admin only）。
 *
 * 409 Conflict：用户名或邮箱已存在，由 apiClient 拦截器抛错，调用方处理。
 *
 * @param req - 创建请求，包含用户名、邮箱、初始密码
 */
export async function createAdminUser(req: AdminUserCreateRequest): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>('/admin/users', req)
  return data
}

/**
 * 更新用户信息（PATCH 语义，只传需要修改的字段）。
 *
 * 常见用途：
 *   - 修改 is_admin（授予/撤销管理员权限）
 *   - 修改 is_active（停用/恢复账号）
 *
 * @param userId - 目标用户 ID（数据库主键，整数）
 * @param patch  - 部分更新字段（未传的字段不修改）
 */
export async function updateAdminUser(
  userId: number,
  patch: AdminUserUpdateRequest,
): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(
    `/admin/users/${encodeURIComponent(String(userId))}`,
    patch,
  )
  return data
}

/**
 * 删除用户（admin only）。
 *
 * 后端通常为软删除（标记 is_active=false）或物理删除，
 * 具体行为见后端实现。404 时 apiClient 会抛错。
 *
 * @param userId - 要删除的用户 ID
 */
export async function deleteAdminUser(userId: number): Promise<void> {
  await apiClient.delete(`/admin/users/${encodeURIComponent(String(userId))}`)
}
