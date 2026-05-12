/**
 * src/pages/settings/GroupDetailPage.test.tsx
 *
 * Smoke test: GroupDetailPage 在加载状态下渲染不崩。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock API — 返回 pending promise 让组件停在 loading 状态
vi.mock('@/api/groups', () => ({
  getGroup: vi.fn().mockReturnValue(new Promise(() => {})),
  listGroupMembers: vi.fn().mockReturnValue(new Promise(() => {})),
  updateGroup: vi.fn(),
  addGroupMember: vi.fn(),
  changeGroupMemberRole: vi.fn(),
  removeGroupMember: vi.fn(),
}))

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}))

import { GroupDetailPage } from './GroupDetailPage'

describe('GroupDetailPage', () => {
  it('renders loading state without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/settings/groups/test-group']}>
        <Routes>
          <Route path="/settings/groups/:gid" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('加载中…')).toBeInTheDocument()
  })
})
