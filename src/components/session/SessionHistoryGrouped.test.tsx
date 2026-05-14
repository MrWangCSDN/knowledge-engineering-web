import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionHistoryGrouped } from './SessionHistoryGrouped'
import { useSidebarStore } from '@/store/sidebar'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

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
  title: '会话',
  created_at: '2026-05-13T00:00:00Z',
  updated_at: '2026-05-13T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('SessionHistoryGrouped', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
    })
    // 把 fetchSessions 替换为 spy，避免触发真实 API
    vi.spyOn(useSessionStore.getState(), 'fetchSessions').mockResolvedValue()
  })

  it('渲染「最近」标题', () => {
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('所有工程都没 session 时显示占位文案', () => {
    useProjectStore.setState({
      projects: [mkProject({ id: 'p1' })],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: { p1: [] },
      fetchedProjects: new Set(['p1']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText(/还没有对话历史/)).toBeInTheDocument()
  })

  it('只渲染有 session 的工程（决策 8）', () => {
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p1', name: '有会话工程' }),
        mkProject({ id: 'p2', name: '空工程' }),
      ],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1' })],
        p2: [],
      },
      fetchedProjects: new Set(['p1', 'p2']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText('有会话工程')).toBeInTheDocument()
    expect(screen.queryByText('空工程')).not.toBeInTheDocument()
  })

  it('工程按 max(session.updated_at) 倒序', () => {
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p_old', name: '老工程' }),
        mkProject({ id: 'p_new', name: '新工程' }),
      ],
      currentProjectId: 'p_new',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {
        p_old: [mkSession({ id: 's_o', project_id: 'p_old', updated_at: '2026-01-01T00:00:00Z' })],
        p_new: [mkSession({ id: 's_n', project_id: 'p_new', updated_at: '2026-05-13T00:00:00Z' })],
      },
      fetchedProjects: new Set(['p_old', 'p_new']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    // DOM 顺序：新工程在前
    const projectNames = screen
      .getAllByRole('button')
      .map(btn => btn.textContent ?? '')
      .filter(t => t.includes('工程'))
    expect(projectNames[0]).toContain('新工程')
    expect(projectNames[1]).toContain('老工程')
  })

  it('「最近」折叠时不渲染任何工程', () => {
    useProjectStore.setState({
      projects: [mkProject({ id: 'p1', name: '工程A' })],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: { p1: [mkSession()] },
      fetchedProjects: new Set(['p1']),
      isLoading: false,
      error: null,
    })
    useSidebarStore.setState({ recentExpanded: false, projectExpanded: {} })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.queryByText('工程A')).not.toBeInTheDocument()
  })

  it('mount 时对未拉过的工程触发 fetchSessions', () => {
    const fetchSpy = vi.fn().mockResolvedValue(undefined)
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
      fetchSessions: fetchSpy,
    } as Partial<ReturnType<typeof useSessionStore.getState>> as never)
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p1' }),
        mkProject({ id: 'p2' }),
      ],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(fetchSpy).toHaveBeenCalledWith('p1')
    expect(fetchSpy).toHaveBeenCalledWith('p2')
  })
})
