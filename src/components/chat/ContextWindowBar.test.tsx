/**
 * src/components/chat/ContextWindowBar.test.tsx
 *
 * 验证 ContextWindowBar：
 *   - contextUsage=null → 不渲染
 *   - 三态阈值：pct≤80 ok蓝 / 80<pct≤95 warn黄 / pct>95 danger红
 *   - 文案：ok 显 {pct}%；warn/danger 显"剩余 X% 直到自动压缩"
 *   - history_trimmed → 追加"已自动压缩较早历史"
 *   - role=progressbar + aria-valuenow；title 含 used/window
 * 设计：[[上下文窗口前端展示-设计]] §5.4
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'

import { ContextWindowBar } from './ContextWindowBar'
import { useChatStore } from '@/store/chat'
import type { ContextUsage } from '@/types/chat'

function setCU(cu: ContextUsage | null) {
  useChatStore.setState({ contextUsage: cu })
}
const base: ContextUsage = {
  used_tokens: 1200, window_tokens: 1000000, pct: 50, history_trimmed: false,
}

describe('ContextWindowBar', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it('contextUsage=null → 不渲染任何东西', () => {
    setCU(null)
    const { container } = render(<ContextWindowBar />)
    expect(container.firstChild).toBeNull()
  })

  it('pct=50 → ok 蓝，文案显 50%，progressbar aria 正确', () => {
    setCU({ ...base, pct: 50 })
    render(<ContextWindowBar />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', '上下文窗口使用量')
    const fill = bar.querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-ok')
    expect(fill).toHaveStyle({ width: '50%' })
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('pct=85 → warn 黄，文案"剩余 15% 直到自动压缩"', () => {
    setCU({ ...base, pct: 85 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-warn')
    expect(screen.getByText(/剩余 15% 直到自动压缩/)).toBeInTheDocument()
  })

  it('pct=97 → danger 红', () => {
    setCU({ ...base, pct: 97 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-danger')
    expect(screen.getByText(/剩余 3% 直到自动压缩/)).toBeInTheDocument()
  })

  it('边界 pct=80 → ok；pct=80.1 → warn；pct=95 → warn；pct=95.1 → danger', () => {
    setCU({ ...base, pct: 80 })
    const r1 = render(<ContextWindowBar />)
    expect(r1.container.querySelector('[data-fill]')?.className).toContain('bg-context-ok')
    r1.unmount()
    setCU({ ...base, pct: 80.1 })
    const r2 = render(<ContextWindowBar />)
    expect(r2.container.querySelector('[data-fill]')?.className).toContain('bg-context-warn')
    r2.unmount()
    setCU({ ...base, pct: 95 })
    const r3 = render(<ContextWindowBar />)
    expect(r3.container.querySelector('[data-fill]')?.className).toContain('bg-context-warn')
    r3.unmount()
    setCU({ ...base, pct: 95.1 })
    const r4 = render(<ContextWindowBar />)
    expect(r4.container.querySelector('[data-fill]')?.className).toContain('bg-context-danger')
  })

  it('history_trimmed=true → 追加"已自动压缩较早历史"提示', () => {
    setCU({ ...base, pct: 60, history_trimmed: true })
    render(<ContextWindowBar />)
    expect(screen.getByText(/已自动压缩较早历史以继续对话/)).toBeInTheDocument()
  })

  it('title 含 used/window 原始数（极简版唯一原始数字处）', () => {
    setCU({ ...base, pct: 50, used_tokens: 1234, window_tokens: 1000000 })
    render(<ContextWindowBar />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'title', '已用 ~1234 / 1000000 tokens',
    )
  })

  it('pct 越界（>100）→ clamp 到 100 宽度', () => {
    setCU({ ...base, pct: 150 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill).toHaveStyle({ width: '100%' })
  })
})
