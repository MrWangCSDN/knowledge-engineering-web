/**
 * src/types/admin.ts
 *
 * Admin（仓库管理）相关 TypeScript 类型，对应后端 admin_models.py。
 *
 * 设计文档：[[仓库管理-设计]] §3-§4
 */

// ─── Git 凭证 ─────────────────────────────────────────────────────────

/** 凭证类型；v1.0 只支持 PAT，v2 加 SSH key */
export type CredentialType = 'pat'

/** 凭证响应（永远不返回明文 / 加密 token，只有 hint 用于 UI 展示） */
export interface Credential {
  id: string
  name: string
  type: CredentialType
  /** 末 4 位前缀 ****，如 '****abc' */
  token_hint: string | null
  created_by: string | null
  created_at: string
  last_used_at: string | null
}

/** 创建凭证请求 */
export interface CredentialCreateRequest {
  name: string
  type?: CredentialType  // 默认 'pat'
  token: string  // 明文；提交后端会加密
}

// ─── 测试连接 ─────────────────────────────────────────────────────────

export interface TestConnectionRequest {
  git_url: string
  credential_id?: string | null
  branch?: string | null
}

export interface TestConnectionResponse {
  ok: boolean
  default_branch?: string | null
  last_commit?: string | null
  error?: string | null
}

// ─── admin 视角的工程 ───────────────────────────────────────────────

/** admin 视角的工程（含 git 配置；普通用户的 Project 类型不含这些字段） */
export interface AdminProject {
  id: string
  name: string
  domain: string | null
  /** configured（v1.0 默认）/ indexing / ready / partial / failed */
  status: string
  git_url: string | null
  git_branch: string
  credential_id: string | null
  last_synced_at: string | null
  last_synced_commit: string | null
  sync_schedule: string
  created_at: string
  created_by: string | null
}

export interface AdminProjectCreateRequest {
  id: string
  name: string
  domain?: string | null
  git_url: string
  git_branch?: string  // 默认 'main'
  credential_id?: string | null
  language?: string  // 默认 'java'
}

export interface AdminProjectUpdateRequest {
  name?: string
  domain?: string | null
  git_url?: string
  git_branch?: string
  credential_id?: string | null
}
