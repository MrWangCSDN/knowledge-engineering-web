import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock auth store with admin user
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: { is_admin: boolean } }) => unknown) =>
    selector({ user: { is_admin: true } }),
}))

import { SettingsLayout } from './SettingsLayout'

describe('SettingsLayout 集成「已归档对话」入口', () => {
  it('左侧菜单含「已归档对话」link', () => {
    render(
      <MemoryRouter initialEntries={['/settings/projects']}>
        <SettingsLayout />
      </MemoryRouter>,
    )
    expect(screen.getByText('已归档对话')).toBeInTheDocument()
  })
})
