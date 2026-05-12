/**
 * src/pages/settings/CredentialListPage.test.tsx
 *
 * Smoke test: CredentialListPage (v2) 渲染不崩 + 关键文案出现。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/credentials', () => ({
  listMyCredentials: vi.fn().mockResolvedValue([]),
  deleteMyCredential: vi.fn(),
  listAllCredentials: vi.fn().mockResolvedValue([]),
  deleteAnyCredential: vi.fn(),
}))

vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (s: { user: null }) => unknown) =>
    selector({ user: null }),
}))

import { CredentialListPage } from './CredentialListPage'

describe('CredentialListPage', () => {
  it('renders without crashing and shows title', () => {
    render(<CredentialListPage />)
    expect(screen.getByText('我的凭证')).toBeInTheDocument()
  })
})
