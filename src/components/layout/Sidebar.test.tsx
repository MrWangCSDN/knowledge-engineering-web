import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { useSidebarStore } from '@/store/sidebar'

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

  it('保留底部「设置」入口', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('设置')).toBeInTheDocument()
  })
})
