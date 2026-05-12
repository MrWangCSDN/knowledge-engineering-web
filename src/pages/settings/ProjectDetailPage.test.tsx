/**
 * src/pages/settings/ProjectDetailPage.test.tsx
 *
 * Smoke test: ProjectDetailPage 在加载状态下渲染不崩。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('@/api/projects', () => ({
  getProject: vi.fn().mockReturnValue(new Promise(() => {})),
}))
vi.mock('@/api/projectMembers', () => ({
  listProjectMembers: vi.fn().mockReturnValue(new Promise(() => {})),
  addProjectMember: vi.fn(),
  removeProjectMember: vi.fn(),
  changeProjectMemberRole: vi.fn(),
}))
vi.mock('@/api/admin', () => ({
  updateAdminProject: vi.fn(),
  deleteAdminProject: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  apiClient: { post: vi.fn() },
}))
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}))

import { ProjectDetailPage } from './ProjectDetailPage'

describe('ProjectDetailPage', () => {
  it('renders loading state without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/settings/projects/test-project']}>
        <Routes>
          <Route path="/settings/projects/:pid" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('加载中…')).toBeInTheDocument()
  })
})
