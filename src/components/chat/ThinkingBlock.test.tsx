import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThinkingBlock } from './ThinkingBlock'

describe('ThinkingBlock', () => {
  it('流式中展开显示推理文本', () => {
    render(<ThinkingBlock thinking="先看调用方" streaming />)
    expect(screen.getByText('先看调用方')).toBeInTheDocument()
  })

  it('done 后默认折叠，点击展开', () => {
    render(<ThinkingBlock thinking="推理内容" streaming={false} />)
    expect(screen.queryByText('推理内容')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /思考过程/ }))
    expect(screen.getByText('推理内容')).toBeInTheDocument()
  })

  it('thinking 为空时不渲染', () => {
    const { container } = render(<ThinkingBlock thinking="" streaming={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('streaming 结束后保持展开，可再折叠', () => {
    const { rerender } = render(<ThinkingBlock thinking="推理内容" streaming />)
    // 流结束 → streaming 变 false：useState 初值为 true，仍展开（不该被收起）
    rerender(<ThinkingBlock thinking="推理内容" streaming={false} />)
    expect(screen.getByText('推理内容')).toBeInTheDocument()
    // 用户可手动折叠
    fireEvent.click(screen.getByRole('button', { name: /思考过程/ }))
    expect(screen.queryByText('推理内容')).not.toBeInTheDocument()
  })
})
