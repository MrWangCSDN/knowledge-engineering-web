import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// 模拟 store 状态
const mockStoreState = {
  byProject: [],
  isLoading: false,
  error: null,
  fetchAll: vi.fn(),
  restore: vi.fn(),
  permanentDelete: vi.fn(),
}

vi.mock('@/store/archivedSessions', () => ({
  useArchivedSessionStore: (selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
}))

import { ArchivedSessionsPage } from './ArchivedSessionsPage'

describe('ArchivedSessionsPage', () => {
  beforeEach(() => {
    // 重置 mock state
    mockStoreState.byProject = []
    mockStoreState.isLoading = false
    mockStoreState.error = null
    mockStoreState.fetchAll = vi.fn()
    mockStoreState.restore = vi.fn()
    mockStoreState.permanentDelete = vi.fn()
  })

  it('挂载时调 fetchAll', () => {
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(mockStoreState.fetchAll).toHaveBeenCalled()
  })

  it('byProject 为空显示「没有已归档对话」', () => {
    mockStoreState.byProject = []
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(screen.getByText(/没有已归档对话/)).toBeInTheDocument()
  })

  it('渲染工程分组 + session 项 + 「恢复」+「彻底删除」按钮', () => {
    mockStoreState.byProject = [{
      project_id: 'p1',
      project_name: 'PetClinic 测试',
      sessions: [{
        id: 's1', title: 'OrderService 调用链',
        archived_at: '2026-05-13T10:00:00Z',
        created_at: '...', updated_at: '...', message_count: 5,
      }],
    }]
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(screen.getByText(/PetClinic 测试/)).toBeInTheDocument()
    expect(screen.getByText('OrderService 调用链')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '彻底删除' })).toBeInTheDocument()
  })

  it('点「恢复」调 restore(projectId, sessionId)', async () => {
    mockStoreState.byProject = [{
      project_id: 'p1', project_name: 'P1',
      sessions: [{
        id: 's1', title: 'x', archived_at: '2026-05-13T10:00:00Z',
        created_at: '...', updated_at: '...', message_count: 1,
      }],
    }]
    mockStoreState.restore = vi.fn()
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '恢复' }))
    await waitFor(() => expect(mockStoreState.restore).toHaveBeenCalledWith('p1', 's1'))
  })

  it('点「彻底删除」弹 ConfirmDialog 二次确认，点确定按钮才调 permanentDelete', async () => {
    mockStoreState.byProject = [{
      project_id: 'p1', project_name: 'P1',
      sessions: [{
        id: 's1', title: 'x', archived_at: '...',
        created_at: '...', updated_at: '...', message_count: 1,
      }],
    }]
    mockStoreState.permanentDelete = vi.fn()
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)

    // 列表里的「彻底删除」按钮
    const listDeleteBtns = screen.getAllByRole('button', { name: '彻底删除' })
    fireEvent.click(listDeleteBtns[0])

    // ConfirmDialog 弹出 — 此时不应调 permanentDelete
    expect(mockStoreState.permanentDelete).not.toHaveBeenCalled()

    // 等 dialog 弹出（多一个「彻底删除」按钮，是 dialog 的确定按钮）
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: '彻底删除' })
      expect(btns.length).toBe(2)  // 列表按钮 + dialog 按钮
    })
    // dialog 的确定按钮（后渲染）
    const allDeleteBtns = screen.getAllByRole('button', { name: '彻底删除' })
    fireEvent.click(allDeleteBtns[allDeleteBtns.length - 1])

    await waitFor(() => expect(mockStoreState.permanentDelete).toHaveBeenCalledWith('p1', 's1'))
  })
})
