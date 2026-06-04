import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useCodeViewerStore } from '@/store/codeViewer'

// 副作用 mock：阻止 monacoSetup 在测试环境导入真实 monaco-editor（jsdom 不支持 document.queryCommandSupported）
vi.mock('@/lib/monacoSetup', () => ({}))
vi.mock('@monaco-editor/react', () => ({ default: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>, loader: { config: vi.fn() } }))
vi.mock('@/store/theme', () => ({ useThemeStore: (sel: (s: { theme: string }) => unknown) => sel({ theme: 'light' }) }))

import { CodeViewerDrawer } from './CodeViewerDrawer'

// file_path 带目录前缀：让 tab 标签（取末段 'A.java'）与 Status bar（显示完整 'svc/A.java'）文本可区分
const tab = (id: string, code = 'body') => ({
  entityId: id, loading: false, error: null,
  snippet: { entity_id: id, qualified_name: id.split('#')[0], kind: 'method', file_path: 'svc/A.java', language: 'java', start_line: 1, end_line: 1, code, callees: [], callers: [{ entity_id: 'C::x#()', name: 'x' }] },
})

describe('CodeViewerDrawer', () => {
  beforeEach(() => useCodeViewerStore.setState({ projectId: 'p', open: false, tabs: [], activeEntityId: null }))

  it('open=false → 不渲染', () => {
    const { container } = render(<CodeViewerDrawer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('open=true → 渲染激活片段 + 文件名 tab，去掉 callers 栏', () => {
    useCodeViewerStore.setState({ open: true, tabs: [tab('com.x.A::m#()')], activeEntityId: 'com.x.A::m#()' })
    render(<CodeViewerDrawer />)
    expect(screen.getByTestId('monaco')).toHaveTextContent('body')
    expect(screen.getByText('A.java')).toBeInTheDocument()          // tab 标签 = 文件名（IDEA 式），非方法名
    expect(screen.queryByText(/被调用方/)).not.toBeInTheDocument()   // callers 侧栏已移除
    expect(screen.queryByText('x')).not.toBeInTheDocument()          // caller 链接不再渲染
    expect(screen.getByRole('separator')).toBeInTheDocument()       // 分屏分隔条仍在
  })

  it('加载中（snippet 未到）→ tab 用简单类名兜底', () => {
    useCodeViewerStore.setState({
      open: true,
      activeEntityId: 'com.x.AlipayServiceImpl::pay#()',
      tabs: [{ entityId: 'com.x.AlipayServiceImpl::pay#()', snippet: null, loading: true, error: null }],
    })
    render(<CodeViewerDrawer />)
    expect(screen.getByText('AlipayServiceImpl')).toBeInTheDocument() // file_path 未到 → 类名兜底
  })
})
