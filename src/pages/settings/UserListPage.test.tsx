/**
 * src/pages/settings/UserListPage.test.tsx
 *
 * Smoke test: UserListPage 渲染不崩 + 关键文案出现。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/users', () => ({
  listAdminUsers: vi.fn().mockResolvedValue([]),
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
}))

import { UserListPage } from './UserListPage'

describe('UserListPage', () => {
  it('renders without crashing and shows title', () => {
    render(<UserListPage />)
    expect(screen.getByText('用户管理')).toBeInTheDocument()
  })
})
