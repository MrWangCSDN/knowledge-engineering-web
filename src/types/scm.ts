// src/types/scm.ts —— GitHub 连接相关 DTO（与后端 JSON 对齐）

/** SCM 连接（账号级）。/scm/connections 返回。 */
export interface ScmConnection {
  id: string
  provider: string
  account_login: string | null
  github_installation_id: number | null
  auth_type: string                // "github_app" | "pat"
  status: string
}

/** 可见仓。/scm/connections/{id}/visible-repos 返回。 */
export interface VisibleRepo {
  external_id: number
  full_name: string
  default_branch: string
  private: boolean
  scm_role: 'can_bind' | 'can_query'
  bound: boolean
  bound_project_id: string | null
}

export interface ScmBranch {
  name: string
  commit_sha: string
}

export interface CreateProjectBindRequest {
  project_id: string
  name: string
  repo_external_id: number
  repo_full_name: string
  ref: string
  ref_type?: string
  subpath?: string | null
}

export interface IndexStatus {
  job_id: string
  status: string
  progress: { phase: string; percent: number } | null
  error: string | null
}

export interface SyncHealth {
  project_id: string
  status: string
  last_synced_at: string | null
  last_synced_commit: string | null
  staleness_hours: number | null
  is_stuck: boolean
  latest_job: { job_id: string; status: string; progress: unknown } | null
  job_counts: { queued: number; running: number; failed: number }
  last_error: string | null
}
