import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionMenu } from './SessionMenu'

describe('SessionMenu', () => {
  let onArchive: ReturnType<typeof vi.fn>
  let onDelete: ReturnType<typeof vi.fn>
  let onRename: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onArchive = vi.fn()
    onDelete = vi.fn()
    onRename = vi.fn()
  })

  it('渲染「⋯」trigger 按钮', () => {
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} onRename={onRename} />)
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument()
  })

  it('点击 trigger 打开 menu 显示「重命名」+「归档」+「删除」', async () => {
    const user = userEvent.setup()
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} onRename={onRename} />)
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    expect(screen.getByText('重命名')).toBeInTheDocument()
    expect(screen.getByText('归档')).toBeInTheDocument()
    expect(screen.getByText('删除')).toBeInTheDocument()
  })

  it('点「归档」调 onArchive', async () => {
    const user = userEvent.setup()
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} onRename={onRename} />)
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    await user.click(screen.getByText('归档'))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('点「删除」调 onDelete', async () => {
    const user = userEvent.setup()
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} onRename={onRename} />)
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    await user.click(screen.getByText('删除'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('渲染「重命名」项，点击触发 onRename', async () => {
    const user = userEvent.setup()
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} onRename={onRename} />)
    await user.click(screen.getByRole('button', { name: /更多操作/ }))
    await user.click(screen.getByText('重命名'))
    expect(onRename).toHaveBeenCalledTimes(1)
  })
})
