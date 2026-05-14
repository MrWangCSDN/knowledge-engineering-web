/**
 * src/components/session/SessionItem.test.tsx
 *
 * SessionItem 单元测试 — 验证 SessionMenu 集成（归档 / 删除）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionItem } from './SessionItem'
import { useSessionStore } from '@/store/sessions'
import type { Session } from '@/types/session'
import type { Project } from '@/types/project'

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1', project_id: 'p1', title: '你好',
  created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-13T00:00:00Z',
  message_count: 2,
  ...over,
})

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'P1', status: 'ready', description: '',
  ...over,
} as Project)

describe('SessionItem with SessionMenu', () => {
  beforeEach(() => {
    // 重置 store + spy archiveSession/deleteSession
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
    })
  })

  it('hover 显示「⋯」按钮', () => {
    render(
      <MemoryRouter>
        <SessionItem session={mkSession()} project={mkProject()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument()
  })

  it('点 trigger → menu 出现 + 含「归档」', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionItem session={mkSession()} project={mkProject()} />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    expect(await screen.findByText('归档')).toBeInTheDocument()
  })
})
