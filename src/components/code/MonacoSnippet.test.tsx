import { readFileSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// 副作用 mock：monacoSetup 在测试环境中只是空操作。
// 若不 mock，import 会拉入真实 monaco-editor，触发 document.queryCommandSupported
// 等 jsdom 不支持的浏览器 API，导致整个测试文件崩溃。
vi.mock('@/lib/monacoSetup', () => ({}))

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
    render(<MonacoSnippet snippet={null} error="暂无源码" theme="light" />)
    expect(screen.getByText('暂无源码')).toBeInTheDocument()
  })
})

/**
 * 整文件视图的定位策略（2026-06-04，用户偏好）：方法首行滚到 viewport【顶部】而非居中。
 * editor 实例方法（reveal*）在测试里被 stub 的 @monaco-editor/react 隔离、不真正调用，
 * 故沿用本仓库源码不变量手法（见 chat.test.ts / ChatPage.contextbar.test.tsx）守定位策略不被改回居中。
 */
describe('MonacoSnippet 定位策略（方法置顶）', () => {
  const src = readFileSync('src/components/code/MonacoSnippet.tsx', 'utf-8')
  it('用 revealLineNearTop 把方法滚到顶部', () => {
    expect(src).toContain('revealLineNearTop(line)')
    expect(src).toContain('snippet.start_line')
  })
  it('不再用 revealLineInCenter（居中）', () => {
    expect(src).not.toContain('revealLineInCenter')
  })
})

/**
 * 首开滚动定位修复（2026-06-07）：useEffect([snippet]) 首次在 Monaco mount 前跑（ref=null 早返回），
 * onMount 只写 ref 不触发重渲染 → 首开永不 reveal。修复：ready 态纳入依赖 + onMount setReady(true) +
 * rAF 等布局就绪再 reveal。沿用源码不变量手法守住。
 */
describe('MonacoSnippet 首开 reveal 定位修复', () => {
  const src = readFileSync('src/components/code/MonacoSnippet.tsx', 'utf-8')
  it('onMount 置 ready 触发 effect 再跑（首开也装饰+reveal）', () => {
    expect(src).toContain('setReady(true)')
  })
  it('effect 依赖含 ready', () => {
    expect(src).toContain('[snippet, ready]')
  })
  it('reveal 用 requestAnimationFrame 等布局就绪', () => {
    expect(src).toContain('requestAnimationFrame(() => editor.revealLineNearTop(line))')
  })
})

/**
 * Task 5：Monaco HoverProvider（签名+解读悬浮 + 暂无源码占位）。
 * 设计 [[代码查看器-IDE化导航-设计]] §4.2。
 * 沿用源码不变量手法：vitest 不真渲染 Monaco，所以行为靠模式串守住。
 */
describe('MonacoSnippet IDE 化导航 — hover provider', () => {
  const src = readFileSync('src/components/code/MonacoSnippet.tsx', 'utf-8')
  it('注册 Monaco HoverProvider', () => {
    expect(src).toContain('registerHoverProvider')
  })
  it('hover 走 resolveSymbol API（want_doc=true）', () => {
    expect(src).toContain('resolveSymbol')
    expect(src).toContain('want_doc: true')
  })
  it('用 ref 持 hover provider，避免重复注册', () => {
    expect(src).toContain('hoverProviderRef')
  })
  it('有 LRU 缓存（key 含 file_path:line:col）', () => {
    expect(src).toMatch(/hoverCache|HOVER_CACHE/)
    expect(src).toContain('file_path')
  })
  it('has_source=false → 渲染"暂无源码"', () => {
    expect(src).toContain('暂无源码')
  })
})

/**
 * Task 6：cmd/ctrl+click 跳转任意符号 + 暂无源码 toast。
 * 设计 [[代码查看器-IDE化导航-设计]] §4.2/§4.3。源码不变量手法。
 */
describe('MonacoSnippet IDE 化导航 — cmd/ctrl+click 跳转', () => {
  const src = readFileSync('src/components/code/MonacoSnippet.tsx', 'utf-8')
  it('检测 cmd/ctrl 修饰键（metaKey || ctrlKey）', () => {
    expect(src).toMatch(/metaKey.*\|\|.*ctrlKey|ctrlKey.*\|\|.*metaKey/)
  })
  it('cmd+click 走 resolveSymbol（带 token + context_entity_id）', () => {
    expect(src).toContain('resolveSymbol')
    expect(src).toContain('context_entity_id')
  })
  it('has_source=true → openEntity 跳转', () => {
    expect(src).toContain('openEntity(result.entity_id)')
  })
  it('has_source=false → toast 提示"暂无源码"', () => {
    expect(src).toContain('setNoSourceToast(true)')
    expect(src).toContain('cs-no-source-toast')
  })
})
