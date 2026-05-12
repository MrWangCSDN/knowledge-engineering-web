/**
 * src/api/admin.ts
 *
 * 仓库管理 admin API 的薄封装。
 *
 * 后端路由：knowledge-engineering-auth/src/service/admin_router.py
 *   POST   /admin/projects/test-connection     testConnection
 *   POST   /admin/projects                     createAdminProject
 *   GET    /admin/projects                     listAdminProjects
 *   PATCH  /admin/projects/{id}                updateAdminProject
 *   DELETE /admin/projects/{id}                deleteAdminProject
 *
 * 注意：credentials 相关接口（createCredential / listCredentials / deleteCredential）
 * 已迁移至 src/api/credentials.ts（v2 user-scoped + admin 双视角封装）。
 */
import { apiClient } from './client'
import type {
  AdminProject,
  AdminProjectCreateRequest,
  AdminProjectUpdateRequest,
  TestConnectionRequest,
  TestConnectionResponse,
} from '@/types/admin'

// ─── git 测试连接 ─────────────────────────────────────────────────

export async function testConnection(req: TestConnectionRequest): Promise<TestConnectionResponse> {
  const { data } = await apiClient.post<TestConnectionResponse>(
    '/admin/projects/test-connection',
    req,
  )
  return data
}

// ─── admin 工程 CRUD ─────────────────────────────────────────────

export async function listAdminProjects(): Promise<AdminProject[]> {
  const { data } = await apiClient.get<{ projects: AdminProject[] }>('/admin/projects')
  return data.projects
}

export async function createAdminProject(req: AdminProjectCreateRequest): Promise<AdminProject> {
  const { data } = await apiClient.post<AdminProject>('/admin/projects', req)
  return data
}

export async function updateAdminProject(
  id: string,
  req: AdminProjectUpdateRequest,
): Promise<AdminProject> {
  const { data } = await apiClient.patch<AdminProject>(
    `/admin/projects/${encodeURIComponent(id)}`,
    req,
  )
  return data
}

export async function deleteAdminProject(id: string): Promise<void> {
  await apiClient.delete(`/admin/projects/${encodeURIComponent(id)}`)
}
