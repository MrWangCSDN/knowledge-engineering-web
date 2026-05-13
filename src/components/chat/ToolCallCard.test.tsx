/**
 * src/components/chat/ToolCallCard.test.tsx
 *
 * 验证 ToolCallCard 的行为：
 *   - 展示工具名 + arguments（默认收起 result）
 *   - phase='starting' 时显示"运行中…"
 *   - phase='complete' 时显示绿色 ✓ + 可展开看 result_preview
 *   - 点击展开按钮后能看到 result_preview 内容
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

import { ToolCallCard } from './ToolCallCard'
import type { ToolCallPayload } from '@/types/chat'


// helper：造一个 starting 事件
function makeStarting(overrides: Partial<ToolCallPayload> = {}): ToolCallPayload {
  return {
    phase: 'starting',
    id: 'call_001',
    name: 'ke_callees',
    arguments: { entity_id: 'method//M1', max_nodes: 5 },
    ...overrides,
  }
}

// helper：造一个 complete 事件（带 result_preview）
function makeComplete(overrides: Partial<ToolCallPayload> = {}): ToolCallPayload {
  return {
    phase: 'complete',
    id: 'call_001',
    name: 'ke_callees',
    result_preview: '{"entity_id":"method//M1","callees":["B","C"]}',
    ...overrides,
  }
}


describe('ToolCallCard', () => {
  it('starting 时显示运行中态 + 工具名 + arguments', () => {
    render(<ToolCallCard starting={makeStarting()} />)

    // 工具名出现
    expect(screen.getByText(/ke_callees/)).toBeInTheDocument()
    // arguments 里的关键值出现（method//M1）
    expect(screen.getByText(/method\/\/M1/)).toBeInTheDocument()
    // 运行中标记
    expect(screen.getByTestId('tool-call-status')).toHaveTextContent(/运行中|…/)
  })

  it('complete 时显示成功态，result_preview 默认收起', () => {
    render(
      <ToolCallCard
        starting={makeStarting()}
        complete={makeComplete()}
      />,
    )
    // 成功标记
    expect(screen.getByTestId('tool-call-status')).toHaveTextContent(/✓|完成/)
    // result_preview 内容不在 DOM 里（折叠态）
    // 用 "B","C" 这种 result 独有的标记词避免和工具名"ke_callees"撞车
    expect(screen.queryByText(/"B","C"/)).not.toBeInTheDocument()
  })

  it('点击展开按钮后，result_preview 可见', async () => {
    const user = userEvent.setup()
    render(
      <ToolCallCard
        starting={makeStarting()}
        complete={makeComplete()}
      />,
    )

    // 展开按钮：用 role=button + aria-label
    const expandBtn = screen.getByRole('button', { name: /展开|查看结果/ })
    await user.click(expandBtn)

    // result_preview 出现（用 result 独有字符串）
    expect(screen.getByText(/"B","C"/)).toBeInTheDocument()
  })
})
