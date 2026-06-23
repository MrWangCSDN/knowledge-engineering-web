import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { useSidebarStore } from '@/store/sidebar'

// UserMenu 用 useAuthStore / useThemeStore / useNavigate，需要 mock 防止真实 store 副作用
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ user: { username: 'alice', email: 'a@x.com' } })
  ),
}))
vi.mock('@/store/theme', () => ({
  useThemeStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ theme: 'light', toggleTheme: vi.fn() })
  ),
}))

describe('Sidebar 集成 SessionHistoryGrouped', () => {
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
  })

  it('渲染时包含「最近」分组头', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('保留顶部「+ 新对话」按钮', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /新对话/ })).toBeInTheDocument()
  })

  it('底部渲染用户菜单 trigger（UserMenu 替代旧「设置」入口）', () => {
    // 「设置」已移入 UserMenu 弹窗，trigger 按钮通过 aria-label="用户菜单" 可找到
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '用户菜单' })).toBeInTheDocument()
  })
})
