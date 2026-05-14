/**
 * src/api/sessions.test.ts
 *
 * 验证 archiveSession / unarchiveSession / listArchivedSessions 的 URL + 响应解构逻辑。
 * mock 掉 apiClient（axios 实例）让测试不发真请求。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { archiveSession, unarchiveSession, listArchivedSessions } from './sessions'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('sessions API: archive endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('archiveSession 调 POST /projects/{pid}/qa/sessions/{sid}/archive', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 'sess_a', archived_at: '2026-05-13T10:00:00Z' },
    })
    await archiveSession('p1', 'sess_a')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/p1/qa/sessions/sess_a/archive',
    )
  })

  it('unarchiveSession 调 POST /projects/{pid}/qa/sessions/{sid}/unarchive', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 'sess_a', archived_at: null },
    })
    await unarchiveSession('p1', 'sess_a')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/p1/qa/sessions/sess_a/unarchive',
    )
  })

  it('listArchivedSessions 调 GET /user/archived-sessions 返回 by_project 数组', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        by_project: [
          {
            project_id: 'p1',
            project_name: 'P1',
            sessions: [
              {
                id: 'sess_a',
                title: 'x',
                archived_at: '2026-05-13T10:00:00Z',
                created_at: '2026-05-01T00:00:00Z',
                updated_at: '2026-05-10T00:00:00Z',
                message_count: 2,
              },
            ],
          },
        ],
      },
    })
    const result = await listArchivedSessions()
    expect(apiClient.get).toHaveBeenCalledWith('/user/archived-sessions')
    expect(result).toHaveLength(1)
    expect(result[0].project_id).toBe('p1')
    expect(result[0].sessions).toHaveLength(1)
  })
})
