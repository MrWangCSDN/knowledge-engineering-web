/**
 * src/components/session/SessionItem.test.tsx
 *
 * SessionItem 单元测试 — 验证 SessionMenu 集成（归档 / 删除）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('SessionItem inline rename', () => {
  let renameSession: ReturnType<typeof vi.fn>

  beforeEach(() => {
    renameSession = vi.fn().mockResolvedValue(undefined)
    // 通过 setState 注入可观测的 renameSession（SessionItem 用
    // useSessionStore(s => s.renameSession) 取它）
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
      renameSession,
    })
  })

  // 打开 SessionMenu → 点「重命名」进入 inline 编辑态
  const openRename = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    await user.click(await screen.findByText('重命名'))
  }

  it('点重命名 → 出现 input，Enter 保存调 renameSession', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionItem
          session={mkSession({ id: 's1', title: '旧' })}
          project={mkProject({ id: 'p1' })}
        />
      </MemoryRouter>,
    )
    await openRename(user)
    const input = await screen.findByDisplayValue('旧')
    await user.clear(input)
    await user.type(input, '新标题{Enter}')
    expect(renameSession).toHaveBeenCalledWith('p1', 's1', '新标题')
  })

  it('Esc 取消编辑，不调 renameSession', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionItem
          session={mkSession({ id: 's1', title: '旧' })}
          project={mkProject({ id: 'p1' })}
        />
      </MemoryRouter>,
    )
    await openRename(user)
    const input = await screen.findByDisplayValue('旧')
    await user.type(input, 'abc{Escape}')
    expect(screen.queryByDisplayValue(/abc/)).toBeNull()
    expect(renameSession).not.toHaveBeenCalled()
  })

  it('空标题不调 renameSession，恢复原标题', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionItem
          session={mkSession({ id: 's1', title: '旧' })}
          project={mkProject({ id: 'p1' })}
        />
      </MemoryRouter>,
    )
    await openRename(user)
    const input = await screen.findByDisplayValue('旧')
    await user.clear(input)
    await user.type(input, '   {Enter}')
    expect(renameSession).not.toHaveBeenCalled()
    expect(screen.getByText('旧')).toBeInTheDocument()
  })

  it('标题没变（trim 后相同）不调 renameSession', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SessionItem
          session={mkSession({ id: 's1', title: '旧' })}
          project={mkProject({ id: 'p1' })}
        />
      </MemoryRouter>,
    )
    await openRename(user)
    const input = await screen.findByDisplayValue('旧')
    await user.type(input, '{Enter}')
    expect(renameSession).not.toHaveBeenCalled()
  })
})
