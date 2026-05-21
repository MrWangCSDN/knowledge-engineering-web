/**
 * src/components/chat/ContextWindowBar.test.tsx
 *
 * 验证 ContextWindowBar（Claude Code 风格 — 2026-05-21 改造）：
 *   - contextUsage=null → 不渲染
 *   - 三态阈值：pct≤80 ok蓝 / 80<pct≤95 warn黄 / pct>95 danger红
 *   - 标题行格式："Context window" + "{usedFmt} / {windowFmt} ({pct}%)"
 *   - formatTokens：n<1k 原数 / <1M 1.x k / ≥1M 1.x M
 *   - history_trimmed → 追加"已自动压缩较早历史"
 *   - role=progressbar + aria-valuenow；title 含 used/window 缩写
 * 设计：[[上下文窗口前端展示-设计]] §5.4（Claude Code 视觉对齐版本）
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
  used_tokens: 500_000, window_tokens: 1_000_000, pct: 50, history_trimmed: false,
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

  it('pct=50 → ok 蓝，标题行 "Context window" + "500.0k / 1.0M (50%)"', () => {
    setCU({ ...base, pct: 50, used_tokens: 500_000, window_tokens: 1_000_000 })
    render(<ContextWindowBar />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', '上下文窗口使用量')
    const fill = bar.querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-ok')
    expect(fill).toHaveStyle({ width: '50%' })
    // 新文案：Claude Code 风
    expect(screen.getByText('Context window')).toBeInTheDocument()
    expect(screen.getByText('500.0k / 1.0M (50%)')).toBeInTheDocument()
  })

  it('pct=85 → warn 黄（颜色变，文案统一不变）', () => {
    setCU({ ...base, pct: 85 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-warn')
  })

  it('pct=97 → danger 红', () => {
    setCU({ ...base, pct: 97 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-danger')
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

  it('title 含 used/window tokens 缩写（hover 显示）', () => {
    setCU({ ...base, pct: 32, used_tokens: 320_300, window_tokens: 1_000_000 })
    render(<ContextWindowBar />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'title', '320.3k / 1.0M tokens (32%)',
    )
  })

  it('pct 越界（>100）→ clamp 到 100 宽度', () => {
    setCU({ ...base, pct: 150 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill).toHaveStyle({ width: '100%' })
  })

  it('pct 负值 → clamp 到 0；标题显 (0%) 不外泄负数', () => {
    setCU({ ...base, pct: -5, used_tokens: 0 })
    render(<ContextWindowBar />)
    const bar = screen.getByRole('progressbar')
    const fill = bar.querySelector('[data-fill]')
    expect(fill).toHaveStyle({ width: '0%' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    // 标题数字以括号 (0%) 形式出现
    expect(screen.getByText(/\(0%\)/)).toBeInTheDocument()
  })

  it('pct 小数 95.1 → 标题整数化 (95%) 不带浮点垃圾', () => {
    setCU({ ...base, pct: 95.1 })
    render(<ContextWindowBar />)
    expect(screen.getByText(/\(95%\)/)).toBeInTheDocument()
  })

  it('formatTokens：< 1000 显原数 / < 1M 显 k / ≥ 1M 显 M', () => {
    // n < 1000：显示整数
    setCU({ ...base, pct: 0.01, used_tokens: 195, window_tokens: 1_000_000 })
    const r1 = render(<ContextWindowBar />)
    expect(screen.getByText('195 / 1.0M (0%)')).toBeInTheDocument()
    r1.unmount()
    // n < 1M：1 位小数 + k
    setCU({ ...base, pct: 32, used_tokens: 320_345, window_tokens: 1_000_000 })
    const r2 = render(<ContextWindowBar />)
    expect(screen.getByText('320.3k / 1.0M (32%)')).toBeInTheDocument()
    r2.unmount()
    // n ≥ 1M：1 位小数 + M
    setCU({ ...base, pct: 95, used_tokens: 1_500_000, window_tokens: 2_000_000 })
    const r3 = render(<ContextWindowBar />)
    expect(screen.getByText('1.5M / 2.0M (95%)')).toBeInTheDocument()
  })
})
