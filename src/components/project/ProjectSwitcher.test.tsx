import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'

import { ProjectSwitcher } from './ProjectSwitcher'
import { useProjectStore } from '@/store/projects'
import type { Project } from '@/types/project'

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'P1', status: 'ready',
  stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  pipeline_at: null,
  ...over,
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/project/:projectId" element={<ProjectSwitcher />} />
        <Route path="*" element={<ProjectSwitcher />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProjectSwitcher', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
  })

  it('工程列表为空时显示"选择工程"占位', () => {
    renderAt('/')
    expect(screen.getByText(/选择工程/)).toBeInTheDocument()
  })

  it('URL 里有 projectId 时显示对应工程名', () => {
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p1', name: '存款系统' }),
        mkProject({ id: 'p2', name: '贷款系统' }),
      ],
    })
    renderAt('/project/p2')
    expect(screen.getByText('贷款系统')).toBeInTheDocument()
  })

  it('URL 没 projectId 时回退到第一个工程', () => {
    useProjectStore.setState({
      projects: [mkProject({ id: 'p1', name: '存款系统' })],
    })
    renderAt('/')
    expect(screen.getByText('存款系统')).toBeInTheDocument()
  })
})
