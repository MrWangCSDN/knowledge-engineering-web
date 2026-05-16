/**
 * src/api/sessions.ts
 *
 * 会话相关 HTTP API。
 *
 * 后端路由：knowledge-engineering-auth/src/service/qa_router.py
 *   GET    /api/projects/{pid}/qa/sessions                              listSessions
 *   GET    /api/projects/{pid}/qa/sessions/{sid}                        getSessionDetail
 *   DELETE /api/projects/{pid}/qa/sessions/{sid}                        deleteSession
 *   POST   /api/projects/{pid}/qa/sessions/{sid}/messages/{mid}/feedback voteMessage
 */
import { apiClient } from './client'
import type { Session, SessionDetail } from '@/types/session'

interface ListSessionsResponse {
  sessions: Session[]
}

/** 列出当前用户在指定工程下的会话（按 updated_at 倒序）。 */
export async function listSessions(projectId: string): Promise<Session[]> {
  const { data } = await apiClient.get<ListSessionsResponse>(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions`,
  )
  return data.sessions
}

/** 取会话详情 + 全部消息。 */
export async function getSessionDetail(
  projectId: string,
  sessionId: string,
): Promise<SessionDetail> {
  const { data } = await apiClient.get<SessionDetail>(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}`,
  )
  return data
}

/** 删除会话（级联删消息）。 */
export async function deleteSession(
  projectId: string,
  sessionId: string,
): Promise<void> {
  await apiClient.delete(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}`,
  )
}

/** 重命名会话。后端置 title_custom=true，异步总结将不再覆盖。 */
export async function renameSession(
  projectId: string,
  sessionId: string,
  title: string,
): Promise<{ id: string; title: string; title_custom: boolean }> {
  const { data } = await apiClient.patch(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}`,
    { title },
  )
  return data
}

/** 对 assistant 消息打 👍 / 👎（可选评论）。 */
export async function voteMessage(args: {
  projectId: string
  sessionId: string
  messageId: string
  vote: 'up' | 'down'
  comment?: string
}): Promise<void> {
  await apiClient.post(
    `/projects/${encodeURIComponent(args.projectId)}/qa/sessions/${encodeURIComponent(args.sessionId)}/messages/${encodeURIComponent(args.messageId)}/feedback`,
    { vote: args.vote, comment: args.comment },
  )
}


/**
 * v1.5：把 assistant 消息导出成 Word 文档（.docx）下载到本地。
 *
 * 实现细节：
 *   - apiClient 默认 `responseType: 'json'`；这里要 `'blob'` 让它当二进制
 *   - 浏览器没有"原生下载"API，常规做法是：URL.createObjectURL + 临时 <a> 触发 click
 *   - 文件名优先从 Content-Disposition 解析，失败则用 messageId 兜底
 */
export async function exportMessageAsDocx(args: {
  projectId: string
  sessionId: string
  messageId: string
}): Promise<void> {
  const url = `/projects/${encodeURIComponent(args.projectId)}/qa/sessions/${encodeURIComponent(
    args.sessionId,
  )}/messages/${encodeURIComponent(args.messageId)}/export`

  // axios responseType='blob' 返回 Blob，浏览器二进制下载基础
  const res = await apiClient.get<Blob>(url, {
    params: { format: 'docx' },
    responseType: 'blob',
  })

  // 从 Content-Disposition 抽 filename；headers 在 axios 里是小写 key
  const cd = (res.headers['content-disposition'] as string | undefined) || ''
  // RFC 6266 简易解析：filename="xxx.docx"
  const m = cd.match(/filename="([^"]+)"/)
  const filename = m ? m[1] : `qa-${args.messageId}.docx`

  // 触发浏览器另存为
  // URL.createObjectURL 创建一个临时 blob: 协议 URL；用完要 revoke 防内存泄漏
  const blobUrl = URL.createObjectURL(res.data)
  // 临时 anchor 元素；append → click → remove 是 SPA 触发下载的标准套路
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 让浏览器有机会先开始下载，再 revoke；setTimeout 0 就够了
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0)
}

// ─── v1.5: 归档相关 API ────────────────────────────────────────────────────

import type { ArchivedByProject } from '@/types/session'

/** 归档 session（软删，从 sidebar 主列表移走，仍存在 DB）。幂等。
 * 设计：[[会话归档-设计]] §5.1。 */
export async function archiveSession(projectId: string, sessionId: string): Promise<void> {
  await apiClient.post(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}/archive`,
  )
}

/** 恢复归档 session（archived_at 清空，回到 sidebar 主列表）。幂等。 */
export async function unarchiveSession(projectId: string, sessionId: string): Promise<void> {
  await apiClient.post(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}/unarchive`,
  )
}

/** 列出当前用户所有工程的归档 session（按工程分组）。 */
export async function listArchivedSessions(): Promise<ArchivedByProject[]> {
  interface ResponseShape {
    by_project: ArchivedByProject[]
  }
  const { data } = await apiClient.get<ResponseShape>('/user/archived-sessions')
  return data.by_project
}
