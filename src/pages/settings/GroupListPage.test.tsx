/**
 * src/pages/settings/GroupListPage.test.tsx
 *
 * Smoke test: GroupListPage 渲染不崩 + 关键文案出现。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock API
vi.mock('@/api/groups', () => ({
  listVisibleGroups: vi.fn().mockResolvedValue([]),
  createGroup: vi.fn(),
}))

// Mock auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}))

import { GroupListPage } from './GroupListPage'

describe('GroupListPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders without crashing and shows title', async () => {
    render(
      <MemoryRouter>
        <GroupListPage />
      </MemoryRouter>
    )
    expect(screen.getByText('用户组管理')).toBeInTheDocument()
  })
})
