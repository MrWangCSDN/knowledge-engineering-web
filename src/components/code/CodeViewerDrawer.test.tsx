import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useCodeViewerStore } from '@/store/codeViewer'

// 副作用 mock：阻止 monacoSetup 在测试环境导入真实 monaco-editor（jsdom 不支持 document.queryCommandSupported）
vi.mock('@/lib/monacoSetup', () => ({}))
vi.mock('@monaco-editor/react', () => ({ default: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>, loader: { config: vi.fn() } }))
vi.mock('@/store/theme', () => ({ useThemeStore: (sel: (s: { theme: string }) => unknown) => sel({ theme: 'light' }) }))

import { CodeViewerDrawer } from './CodeViewerDrawer'

const tab = (id: string, code = 'body') => ({
  entityId: id, loading: false, error: null,
  snippet: { entity_id: id, qualified_name: id.split('#')[0], kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1, code, callees: [], callers: [{ entity_id: 'C::x#()', name: 'x' }] },
})

describe('CodeViewerDrawer', () => {
  beforeEach(() => useCodeViewerStore.setState({ projectId: 'p', open: false, tabs: [], activeEntityId: null }))

  it('open=false → 不渲染', () => {
    const { container } = render(<CodeViewerDrawer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('open=true → 渲染激活 tab 的片段 + callers', () => {
    useCodeViewerStore.setState({ open: true, tabs: [tab('A::m#()')], activeEntityId: 'A::m#()' })
    render(<CodeViewerDrawer />)
    expect(screen.getByTestId('monaco')).toHaveTextContent('body')
    expect(screen.getByText(/x/)).toBeInTheDocument()
  })
})
