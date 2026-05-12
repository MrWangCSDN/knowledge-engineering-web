/**
 * src/pages/settings/AuditLogPage.test.tsx
 *
 * Smoke test: AuditLogPage 渲染不崩 + 关键文案出现。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/auditLogs', () => ({
  listAdminAuditLogs: vi.fn().mockResolvedValue({
    entries: [],
    total: 0,
    page: 1,
    limit: 20,
  }),
}))

import { AuditLogPage } from './AuditLogPage'

describe('AuditLogPage', () => {
  it('renders without crashing and shows title', () => {
    render(<AuditLogPage />)
    expect(screen.getByText('审计日志')).toBeInTheDocument()
  })
})
