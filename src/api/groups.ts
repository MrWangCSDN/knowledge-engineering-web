/**
 * src/api/groups.ts
 *
 * 用户组（Group）相关 HTTP API 的薄封装。
 *
 * 后端路由：knowledge-engineering-auth/src/service/group_router.py
 *   GET    /groups                              listVisibleGroups
 *   POST   /groups                              createGroup
 *   GET    /groups/{gid}                        getGroup
 *   PATCH  /groups/{gid}                        updateGroup
 *   DELETE /groups/{gid}                        deleteGroup
 *   GET    /groups/{gid}/members                listGroupMembers
 *   POST   /groups/{gid}/members                addGroupMember
 *   PATCH  /groups/{gid}/members/{uid}          changeGroupMemberRole
 *   DELETE /groups/{gid}/members/{uid}          removeGroupMember
 *   GET    /groups/{gid}/audit-logs             listGroupAuditLogs
 */
import { apiClient } from './client'
import type { Group, GroupCreateRequest, GroupMember, Role } from '@/types/group'
import type { AuditLogResponse } from '@/types/audit'

// ─── Group CRUD ───────────────────────────────────────────────────────────────

/** 列出当前用户可见的所有用户组（按权限过滤）。
 *
 * 后端返回 raw array（FastAPI `response_model=list[GroupResponse]`），
 * 不是 `{ groups: [...] }` 包装；这里直接拿 data。
 */
export async function listVisibleGroups(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>('/groups')
  return data
}

/** 创建新用户组（需要 admin 或 group-create 权限）。 */
export async function createGroup(req: GroupCreateRequest): Promise<Group> {
  const { data } = await apiClient.post<Group>('/groups', req)
  return data
}

/** 获取指定用户组详情。404 时 apiClient 拦截器会抛错。 */
export async function getGroup(groupId: string): Promise<Group> {
  const { data } = await apiClient.get<Group>(
    `/groups/${encodeURIComponent(groupId)}`,
  )
  return data
}

/**
 * 更新用户组属性（PATCH 语义：只传需要修改的字段）。
 *
 * 后端接受部分更新：未传的字段不会被覆盖。
 * Partial<Pick<GroupCreateRequest, 'name' | 'description'>> 是 TS 工具类型：
 *   - Pick<T, K>：从 T 中只取 K 指定的字段
 *   - Partial<T>：把 T 的所有字段变成可选（每个字段加 ?）
 *   等效于 { name?: string; description?: string }
 */
export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<GroupCreateRequest, 'name' | 'description'>>,
): Promise<Group> {
  const { data } = await apiClient.patch<Group>(
    `/groups/${encodeURIComponent(groupId)}`,
    patch,
  )
  return data
}

/** 删除用户组（级联移除组内成员绑定；不会删除用户账号）。 */
export async function deleteGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${encodeURIComponent(groupId)}`)
}

// ─── Group Members ────────────────────────────────────────────────────────────

/** 列出指定组的所有成员。 */
export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await apiClient.get<{ members: GroupMember[] }>(
    `/groups/${encodeURIComponent(groupId)}/members`,
  )
  return data.members
}

/** 将用户加入组，指定角色。 */
export async function addGroupMember(
  groupId: string,
  userId: number,
  role: Role,
): Promise<GroupMember> {
  const { data } = await apiClient.post<GroupMember>(
    `/groups/${encodeURIComponent(groupId)}/members`,
    { user_id: userId, role },
  )
  return data
}

/** 修改组内指定成员的角色（PATCH 语义）。 */
export async function changeGroupMemberRole(
  groupId: string,
  userId: number,
  role: Role,
): Promise<GroupMember> {
  const { data } = await apiClient.patch<GroupMember>(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(String(userId))}`,
    { role },
  )
  return data
}

/** 将用户从组中移除（不会删除用户账号）。 */
export async function removeGroupMember(
  groupId: string,
  userId: number,
): Promise<void> {
  await apiClient.delete(
    `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(String(userId))}`,
  )
}

// ─── Group Audit Logs ─────────────────────────────────────────────────────────

/**
 * 获取指定组的审计日志（分页）。
 *
 * @param groupId - 目标组 ID
 * @param params  - 可选查询参数（page / limit / action 筛选等）
 */
export async function listGroupAuditLogs(
  groupId: string,
  params?: { page?: number; limit?: number; action?: string },
): Promise<AuditLogResponse> {
  const { data } = await apiClient.get<AuditLogResponse>(
    `/groups/${encodeURIComponent(groupId)}/audit-logs`,
    { params },
  )
  return data
}
