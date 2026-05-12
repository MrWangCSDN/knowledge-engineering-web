/**
 * src/api/credentials.ts
 *
 * 凭证管理 HTTP API 的薄封装（v2 新增 user-scoped 接口）。
 *
 * 包含两部分：
 *   1. User-scoped（普通用户管理自己的凭证）：
 *      GET    /credentials             listMyCredentials
 *      POST   /credentials             createMyCredential
 *      DELETE /credentials/{cid}       deleteMyCredential
 *
 *   2. Admin（管理所有用户凭证）：
 *      GET    /admin/credentials        listAllCredentials
 *      DELETE /admin/credentials/{cid}  deleteAnyCredential
 *
 * 注意：admin.ts 中原有的 createCredential / listCredentials / deleteCredential
 * 已拆分到本文件；admin.ts 仅保留 project / testConnection 相关逻辑。
 */
import { apiClient } from './client'
import type { MyCredential, CredentialCreateRequest } from '@/types/credential'

// ─── User-scoped Credentials ──────────────────────────────────────────────────

/**
 * 列出当前登录用户自己的凭证（GET /credentials）。
 *
 * 响应中不包含明文 token，只有 token_hint（末几位掩码）。
 */
export async function listMyCredentials(): Promise<MyCredential[]> {
  const { data } = await apiClient.get<{ credentials: MyCredential[] }>('/credentials')
  return data.credentials
}

/**
 * 创建当前用户的凭证（POST /credentials）。
 *
 * 重要：token 字段只在这次请求中传输，后端加密后不再返回明文。
 * 调用方应在提交成功后立即清空表单中的 token 值。
 *
 * @param req - 包含 name、token（必填）和可选的 type（默认 "pat"）
 */
export async function createMyCredential(req: CredentialCreateRequest): Promise<MyCredential> {
  const { data } = await apiClient.post<MyCredential>('/credentials', req)
  return data
}

/**
 * 删除当前用户指定凭证（DELETE /credentials/{cid}）。
 *
 * 只能删除自己的凭证，删除他人凭证需使用 deleteAnyCredential（admin only）。
 *
 * @param credentialId - 凭证唯一 ID
 */
export async function deleteMyCredential(credentialId: string): Promise<void> {
  await apiClient.delete(`/credentials/${encodeURIComponent(credentialId)}`)
}

// ─── Admin Credentials ────────────────────────────────────────────────────────

/**
 * 列出所有用户的凭证（GET /admin/credentials，admin only）。
 *
 * Admin 审计视角，可看到系统内所有凭证（但同样不含明文 token）。
 */
export async function listAllCredentials(): Promise<MyCredential[]> {
  const { data } = await apiClient.get<{ credentials: MyCredential[] }>('/admin/credentials')
  return data.credentials
}

/**
 * Admin 强制删除任意凭证（DELETE /admin/credentials/{cid}，admin only）。
 *
 * 用于安全应急：当某用户凭证疑似泄露，管理员可强制撤销。
 *
 * @param credentialId - 要删除的凭证 ID
 */
export async function deleteAnyCredential(credentialId: string): Promise<void> {
  await apiClient.delete(`/admin/credentials/${encodeURIComponent(credentialId)}`)
}
