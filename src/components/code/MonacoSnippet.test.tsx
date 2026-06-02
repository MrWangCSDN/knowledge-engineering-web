import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>,
  loader: { config: vi.fn() },
}))

import { MonacoSnippet } from './MonacoSnippet'
import type { CodeSnippet } from '@/types/codeSnippet'

const snip = (over: Partial<CodeSnippet> = {}): CodeSnippet => ({
  entity_id: 'A::m#()', qualified_name: 'A::m', kind: 'method', file_path: 'A.java',
  language: 'java', start_line: 1, end_line: 2, code: 'line1\nline2', callees: [], callers: [], ...over,
})

describe('MonacoSnippet', () => {
  it('渲染 code 到 Monaco', () => {
    render(<MonacoSnippet snippet={snip()} theme="light" />)
    expect(screen.getByTestId('monaco')).toHaveTextContent('line1')
  })
  it('snippet=null + loading → 加载态', () => {
    render(<MonacoSnippet snippet={null} loading theme="dark" />)
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })
  it('error → 错误文案', () => {
    render(<MonacoSnippet snippet={null} error="未找到该实体的源码" theme="light" />)
    expect(screen.getByText('未找到该实体的源码')).toBeInTheDocument()
  })
})
