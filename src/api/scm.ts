import { apiClient } from '@/api/client'
import type {
  ScmConnection, VisibleRepo, ScmBranch, CreateProjectBindRequest,
  IndexStatus, SyncHealth,
} from '@/types/scm'

export async function listConnections(): Promise<ScmConnection[]> {
  const { data } = await apiClient.get<{ connections: ScmConnection[] }>('/scm/connections')
  return data.connections
}

export async function deleteConnection(connId: string): Promise<void> {
  await apiClient.delete(`/scm/connections/${encodeURIComponent(connId)}`)
}

export async function getInstallUrl(): Promise<{ install_url: string; state: string }> {
  const { data } = await apiClient.get<{ install_url: string; state: string }>('/scm/github/install-url')
  return data
}

export async function startLinkGithub(): Promise<{ authorize_url: string }> {
  const { data } = await apiClient.post<{ authorize_url: string }>('/account/link-scm/github/start')
  return data
}

export async function completeInstallCallback(params: { installation_id: string; state: string }): Promise<unknown> {
  const { data } = await apiClient.get('/scm/github/callback', { params })
  return data
}

export async function listVisibleRepos(connId: string): Promise<VisibleRepo[]> {
  const { data } = await apiClient.get<{ repos: VisibleRepo[] }>(`/scm/connections/${encodeURIComponent(connId)}/visible-repos`)
  return data.repos
}

export async function listBranches(connId: string, fullName: string): Promise<ScmBranch[]> {
  const { data } = await apiClient.get<{ branches: ScmBranch[] }>(`/scm/connections/${encodeURIComponent(connId)}/repos/${fullName}/branches`)
  return data.branches
}

export async function createProjectBind(connId: string, req: CreateProjectBindRequest): Promise<{ project_id: string; job_id: string }> {
  const { data } = await apiClient.post<{ project_id: string; job_id: string }>(`/scm/connections/${encodeURIComponent(connId)}/projects`, req)
  return data
}

export async function getIndexStatus(projectId: string): Promise<IndexStatus> {
  const { data } = await apiClient.get<IndexStatus>(`/projects/${encodeURIComponent(projectId)}/index-status`)
  return data
}

export async function getSyncHealth(projectId: string): Promise<SyncHealth> {
  const { data } = await apiClient.get<SyncHealth>(`/projects/${encodeURIComponent(projectId)}/sync-health`)
  return data
}

export async function reindex(projectId: string): Promise<{ job_id: string }> {
  const { data } = await apiClient.post<{ job_id: string }>(`/projects/${encodeURIComponent(projectId)}/reindex`)
  return data
}
