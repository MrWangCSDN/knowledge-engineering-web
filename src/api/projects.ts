/**
 * src/api/projects.ts
 *
 * 工程相关 HTTP API 的薄封装。
 *
 * 后端路由：见 knowledge-engineering-auth/src/service/project_router.py
 *   GET    /api/projects              listProjects()
 *   GET    /api/projects/{id}         getProject(id)
 *   POST   /api/projects               createProject(req)  ← admin only
 */

import { apiClient } from '@/api/client'
import type { Project } from '@/types/project'

interface ProjectListResponse {
  projects: Project[]
}

interface ProjectCreateRequest {
  id: string                       // 形如 'deposit-system'
  name: string                     // 显示名
  repo_url?: string
  language?: string                // 默认 'java'
}

/**
 * 列出当前用户可访问的工程。
 *
 * 后端 v1 全部用户可见所有工程；v2 走 RBAC 过滤。
 */
export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<ProjectListResponse>('/projects')
  return data.projects
}

/**
 * 获取指定工程详情。404 时 axios 会抛错（由 client.ts 统一处理）。
 */
export async function getProject(projectId: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(
    `/projects/${encodeURIComponent(projectId)}`
  )
  return data
}

/**
 * 创建工程（admin only）。
 *
 * 401 / 403 / 409 / 422 都会抛错，由调用方处理。
 */
export async function createProject(req: ProjectCreateRequest): Promise<Project> {
  const { data } = await apiClient.post<Project>('/projects', req)
  return data
}
