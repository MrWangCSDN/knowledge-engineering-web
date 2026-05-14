import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectGroup } from './ProjectGroup'
import { useSidebarStore } from '@/store/sidebar'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

// SessionItem 用 react-router 的 hook，要包 MemoryRouter
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: '示例工程',
  status: 'ready',
  description: '',
  ...over,
} as Project)

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  project_id: 'p1',
  title: '会话标题',
  created_at: '2026-05-13T00:00:00Z',
  updated_at: '2026-05-13T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('ProjectGroup', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('渲染工程名', () => {
    const project = mkProject({ id: 'p1', name: '订单系统' })
    renderWithRouter(<ProjectGroup project={project} sessions={[mkSession()]} />)
    expect(screen.getByText('订单系统')).toBeInTheDocument()
  })

  it('展开状态下渲染 session 列表', () => {
    const project = mkProject({ id: 'p1' })
    const sessions = [
      mkSession({ id: 's1', title: '第一条会话' }),
      mkSession({ id: 's2', title: '第二条会话' }),
    ]
    renderWithRouter(<ProjectGroup project={project} sessions={sessions} />)
    expect(screen.getByText('第一条会话')).toBeInTheDocument()
    expect(screen.getByText('第二条会话')).toBeInTheDocument()
  })

  it('折叠状态下不渲染 session 列表', () => {
    const project = mkProject({ id: 'p1' })
    useSidebarStore.setState({
      recentExpanded: true,
      projectExpanded: { p1: false },
    })
    renderWithRouter(
      <ProjectGroup
        project={project}
        sessions={[mkSession({ id: 's1', title: '隐藏会话' })]}
      />
    )
    expect(screen.queryByText('隐藏会话')).not.toBeInTheDocument()
  })

  it('点击工程名切换该工程的折叠状态', () => {
    const project = mkProject({ id: 'p1' })
    renderWithRouter(<ProjectGroup project={project} sessions={[mkSession()]} />)
    // 默认展开
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(true)
    // 点工程名行
    fireEvent.click(screen.getByRole('button', { name: /示例工程/ }))
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
  })

  it('展开状态下 chevron 朝下，折叠时朝右', () => {
    const project = mkProject({ id: 'p1' })
    const { rerender } = renderWithRouter(
      <ProjectGroup project={project} sessions={[mkSession()]} />
    )
    expect(screen.getByTestId('project-p1-chevron-down')).toBeInTheDocument()

    // 折叠后重新渲染
    useSidebarStore.setState({ projectExpanded: { p1: false }, recentExpanded: true })
    rerender(<MemoryRouter><ProjectGroup project={project} sessions={[mkSession()]} /></MemoryRouter>)
    expect(screen.getByTestId('project-p1-chevron-right')).toBeInTheDocument()
  })
})
