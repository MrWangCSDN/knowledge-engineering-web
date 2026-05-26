import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoList } from './TodoList'
import type { TodoItem } from '@/types/chat'

const items: TodoItem[] = [
  { content: '分析订单域入口', status: 'completed' },
  { content: '画调用链', status: 'in_progress' },
  { content: '总结', status: 'pending' },
]

describe('TodoList', () => {
  it('渲染所有 todo 项的文本', () => {
    render(<TodoList todos={items} />)
    expect(screen.getByText('分析订单域入口')).toBeInTheDocument()
    expect(screen.getByText('画调用链')).toBeInTheDocument()
    expect(screen.getByText('总结')).toBeInTheDocument()
  })

  it('空数组不渲染', () => {
    const { container } = render(<TodoList todos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('undefined 不渲染', () => {
    const { container } = render(<TodoList todos={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
