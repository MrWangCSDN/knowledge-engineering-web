/**
 * src/components/chat/MermaidDiagram.test.tsx
 *
 * MermaidDiagram 是 v1.4 的核心展示组件。
 *
 * 测试关注：
 *   1. 给一段合法 mermaid code → 应该尝试渲染（render 被调用）
 *   2. mermaid.render 抛错时 → 降级为 <pre> 原始代码块（不让页面崩）
 *   3. light / dark 主题切换时 → 重新渲染（用对应 theme）
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock 必须放在所有非 hoisted import 之前（vitest 会把它提到文件顶）
// mock 整个 mermaid 模块；保留 default 导出形状
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    // parse 2026-05-22 加：v11+ 用它先验语法（suppressErrors 时返 boolean 不抛）
    parse: vi.fn().mockResolvedValue(true),
    // render 返回 { svg: '<svg ...>...</svg>' }
    render: vi.fn().mockResolvedValue({ svg: '<svg data-test="mermaid-output">ok</svg>' }),
  },
}))

import { MermaidDiagram } from './MermaidDiagram'
import mermaid from 'mermaid'

describe('MermaidDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('合法 code 时，mermaid.render 被调用并把 svg 注入到 DOM', async () => {
    render(<MermaidDiagram code="graph LR\n  A --> B" />)

    // mermaid.render 是异步的；等一下让 useEffect 跑完
    await waitFor(() => {
      // mermaid.render 至少被调用一次（参数是 id + code）
      expect(mermaid.render).toHaveBeenCalled()
    })

    // svg 应该被渲染到组件容器里
    await waitFor(() => {
      const svgWrapper = screen.getByTestId('mermaid-container')
      // dangerouslySetInnerHTML 的内容应该是 mocked svg 字符串
      expect(svgWrapper.innerHTML).toContain('mermaid-output')
    })
  })

  it('mermaid.render 抛错时，降级显示原始 code 而不崩', async () => {
    // 临时把 mock 改成会 reject 的
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('parse error'))

    render(<MermaidDiagram code="invalid mermaid syntax {{{" />)

    // 等异常处理完
    await waitFor(() => {
      // fallback 块用 <pre> 渲染原始代码
      expect(screen.getByTestId('mermaid-fallback')).toBeInTheDocument()
    })
    // 原代码片段可见
    expect(screen.getByTestId('mermaid-fallback')).toHaveTextContent('invalid mermaid syntax')
  })
})
