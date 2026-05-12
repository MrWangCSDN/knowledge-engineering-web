/**
 * src/api/projectMembers.ts
 *
 * 工程成员（Project Members）管理 HTTP API 的薄封装。
 *
 * 后端路由：knowledge-engineering-auth/src/service/project_member_router.py
 *   GET    /projects/{pid}/members              listProjectMembers
 *   POST   /projects/{pid}/members              addProjectMember
 *   PATCH  /projects/{pid}/members/{uid}        changeProjectMemberRole
 *   DELETE /projects/{pid}/members/{uid}        removeProjectMember
 *
 * 注意：GET 响应包含 direct（直接成员）和 inherited（继承成员）两个数组，
 * 前者可以直接在工程层面修改角色/移除，后者只能通过 Group 操作。
 */
import { apiClient } from './client'
import type {
  ProjectMembers,
  ProjectDirectMember,
  ProjectMemberRole,
} from '@/types/project'

// ─── Project Members API ──────────────────────────────────────────────────────

/**
 * 获取工程成员列表（直接成员 + 继承成员）。
 *
 * @param projectId - 工程 ID（业务可读 slug，例如 'deposit-system'）
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMembers> {
  const { data } = await apiClient.get<ProjectMembers>(
    `/projects/${encodeURIComponent(projectId)}/members`,
  )
  return data
}

/**
 * 直接将用户添加为工程成员。
 *
 * @param projectId - 目标工程 ID
 * @param userId    - 用户数据库主键 ID（整数）
 * @param role      - 赋予的角色（'reporter' | 'maintainer' | 'owner'）
 */
export async function addProjectMember(
  projectId: string,
  userId: number,
  role: ProjectMemberRole,
): Promise<ProjectDirectMember> {
  const { data } = await apiClient.post<ProjectDirectMember>(
    `/projects/${encodeURIComponent(projectId)}/members`,
    { user_id: userId, role },
  )
  return data
}

/**
 * 修改工程直接成员的角色（PATCH 语义，只传 role 字段）。
 *
 * 注意：只能修改直接成员的角色，继承成员需在 Group 层面操作。
 *
 * @param projectId - 目标工程 ID
 * @param userId    - 目标成员的用户 ID
 * @param role      - 新角色
 */
export async function changeProjectMemberRole(
  projectId: string,
  userId: number,
  role: ProjectMemberRole,
): Promise<ProjectDirectMember> {
  const { data } = await apiClient.patch<ProjectDirectMember>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(String(userId))}`,
    { role },
  )
  return data
}

/**
 * 从工程中移除直接成员。
 *
 * 只能移除直接成员，继承成员需通过 Group 操作。
 * 移除后用户失去对该工程的所有直接授权（继承的权限不受影响）。
 *
 * @param projectId - 目标工程 ID
 * @param userId    - 要移除的用户 ID
 */
export async function removeProjectMember(
  projectId: string,
  userId: number,
): Promise<void> {
  await apiClient.delete(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(String(userId))}`,
  )
}
