import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '@/store/auth'
import { SettingsLayout } from './SettingsLayout'

// Mock auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}))

describe('SettingsLayout 集成「已归档对话」入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('普通用户（is_admin=false）也能看到「已归档对话」', () => {
    // 模拟普通用户登录（非 admin）
    ;(useAuthStore as any).mockImplementation(
      (selector: (s: { user: { id: number; email: string; username: string; is_admin: boolean } }) => unknown) =>
        selector({
          user: {
            id: 1,
            email: 'a@x.com',
            username: 'alice',
            is_admin: false,
          },
        }),
    )

    render(
      <MemoryRouter initialEntries={['/settings/projects']}>
        <SettingsLayout />
      </MemoryRouter>,
    )
    expect(screen.getByText('已归档对话')).toBeInTheDocument()
  })

  it('admin 用户也能看到「已归档对话」', () => {
    // 模拟 admin 用户登录
    ;(useAuthStore as any).mockImplementation(
      (selector: (s: { user: { id: number; email: string; username: string; is_admin: boolean } }) => unknown) =>
        selector({
          user: {
            id: 2,
            email: 'admin@x.com',
            username: 'admin',
            is_admin: true,
          },
        }),
    )

    render(
      <MemoryRouter initialEntries={['/settings/projects']}>
        <SettingsLayout />
      </MemoryRouter>,
    )
    expect(screen.getByText('已归档对话')).toBeInTheDocument()
  })
})
