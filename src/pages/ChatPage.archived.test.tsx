import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChatPage } from './ChatPage'
import * as sessionsApi from '@/api/sessions'

vi.mock('@/api/sessions')

// 模拟 useChatStore：返回空消息列表，不触发真实 SSE
// 2026-05-22 chat store 大重构后：messages/streamingMessage 被按 sessionId 索引
// 的 byId map 取代（messagesBySession / streamingBySession / abortBySession）。
// ChatPage 内部 selector 通过 URL sessionId 派生当前 view，所以 mock 也照这个形态来。
const mockChatStore = {
  messagesBySession: {} as Record<string, unknown[]>,
  streamingBySession: {} as Record<string, unknown>,
  abortBySession: {} as Record<string, unknown>,
  status: 'idle',
  error: null,
  contextUsage: null,
  sendMessage: vi.fn(),
  loadSession: vi.fn(),
  startNew: vi.fn(),
  abort: vi.fn(),
  currentSessionId: 'sess_arch',
  currentProjectId: 'p1',
}

// Mock useChatStore — 兼容 selector 调用 + .getState() 静态方法
// 必须 inline 在 factory 里，否则 vi.mock hoist 会让顶层变量 reference 出错
vi.mock('@/store/chat', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = (selector: (s: typeof mockChatStore) => unknown) =>
    selector(mockChatStore)
  // v1.5.2 ChatPage fix 用 useChatStore.getState() 直接读 store 最新值
  stub.getState = () => mockChatStore
  return { useChatStore: stub }
})

// 模拟 useProjectStore：返回一个工程让 project 找得到（含 stats 字段供 EmptyState 渲染）
// setCurrentProject 必填 — ChatPage useEffect 会调用，缺则 TypeError "is not a function"
const mockProjectStore = {
  projects: [{
    id: 'p1',
    name: 'Test Project',
    status: 'ready',
    stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  }],
  isLoading: false,
  setCurrentProject: vi.fn(),
  setLastSession: vi.fn(),
  currentProjectId: 'p1',
}

vi.mock('@/store/projects', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = (selector: (s: typeof mockProjectStore) => unknown) =>
    selector(mockProjectStore)
  // ChatPage v1.5.2 fallback 用 useProjectStore.getState() 静态方法
  stub.getState = () => mockProjectStore
  return { useProjectStore: stub }
})

describe('ChatPage: archived session 只读模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 store 状态 — 走新 byId map 形态
    mockChatStore.messagesBySession = {}
    mockChatStore.streamingBySession = {}
    mockChatStore.abortBySession = {}
    mockChatStore.status = 'idle'
    mockChatStore.error = null
    mockChatStore.currentSessionId = 'sess_arch'
    mockChatStore.currentProjectId = 'p1'
  })

  it('归档 session 顶部显示 banner「该对话已归档」', async () => {
    vi.mocked(sessionsApi.getSessionDetail).mockResolvedValue({
      session: {
        id: 'sess_arch', project_id: 'p1', title: '老对话',
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z',
        message_count: 3,
        archived_at: '2026-05-13T10:00:00Z',
      },
      messages: [],
    })
    render(
      <MemoryRouter initialEntries={['/project/p1/chat/sess_arch']}>
        <Routes>
          <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/该对话已归档/)).toBeInTheDocument()
    })
  })

  it('归档 session 输入框 disabled', async () => {
    vi.mocked(sessionsApi.getSessionDetail).mockResolvedValue({
      session: {
        id: 'sess_arch', project_id: 'p1', title: '老对话',
        created_at: '...', updated_at: '...',
        message_count: 3,
        archived_at: '2026-05-13T10:00:00Z',
      },
      messages: [],
    })
    render(
      <MemoryRouter initialEntries={['/project/p1/chat/sess_arch']}>
        <Routes>
          <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })
  })
})
