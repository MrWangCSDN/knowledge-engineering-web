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
