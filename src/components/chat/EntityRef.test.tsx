/**
 * src/components/chat/EntityRef.test.tsx
 *
 * 验证 EntityRef / EntityChip 点击时调用 openEntity（代码片段查看器）。
 * 使用 vi.mock 整体模拟 codeViewer store 模块，以稳定断言 openEntity 是否被调用。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// HighlightCtx：EntityRef/EntityChip 内部用 useContext 读取高亮状态
import { HighlightCtx } from './HighlightCtx'
// 要测试的组件
import { EntityRef, EntityChip } from './EntityRef'
// 导入 store（实际会被 vi.mock 替换为 fake）
import { useCodeViewerStore } from '@/store/codeViewer'

// ── mock 整个 codeViewer store 模块 ──────────────────────────────────────────
// vi.mock 会把整个 '@/store/codeViewer' 替换成工厂函数返回的对象。
// 这里模拟出一个最小 state 对象 + actions；
// useCodeViewerStore(selector) 调用时，selector 会传入 state，返回对应字段/函数。
const state = {
  // 当前工程 id（openEntity 内部需要用，但被 mock 后不真执行）
  projectId: 'p',
  // 抽屉是否打开（初始关闭）
  open: false,
  // 已打开的 tab 列表
  tabs: [] as unknown[],
  // 当前激活实体 id
  activeEntityId: null as string | null,
  // openEntity：被断言是否被调用；vi.fn() 返回一个带记录功能的 spy 函数
  openEntity: vi.fn(),
}

// vi.mock 工厂函数：返回一个与真实 useCodeViewerStore 接口相同的 fake selector 函数。
// useCodeViewerStore(selector) → selector(state)，让组件内 s => s.openEntity 拿到 state.openEntity。
// getState() / setState() 供测试代码直接读写 state 对象。
vi.mock('@/store/codeViewer', () => ({
  useCodeViewerStore: Object.assign(
    (sel: (s: typeof state) => unknown) => sel(state),
    {
      // getState：返回当前 state 快照（供测试代码读）
      getState: () => state,
      // setState：合并更新 state（供 beforeEach 重置）
      setState: (patch: Partial<typeof state>) => Object.assign(state, patch),
    }
  ),
}))

/**
 * 用 HighlightCtx.Provider 包裹 ui，注入空 context（满足组件内 useContext 调用）。
 * active=null setActive 为空函数，测试中不需要真实高亮逻辑。
 */
const wrap = (ui: React.ReactNode) => (
  <HighlightCtx.Provider value={{ active: null, setActive: () => {} }}>
    {ui}
  </HighlightCtx.Provider>
)

describe('EntityRef/EntityChip 点击打开代码片段查看器', () => {
  // 每个用例前重置 state，避免用例间互相污染
  beforeEach(() => {
    // useCodeViewerStore 已被 mock，这里直接调用 setState 重置 state 字段
    useCodeViewerStore.setState({ projectId: 'p', open: false, tabs: [], activeEntityId: null })
    // 清除 openEntity 上次调用记录
    state.openEntity.mockClear()
  })

  it('EntityRef onClick → openEntity', () => {
    // 渲染一个 EntityRef，entityId 为 'A::m#()'，children 文字为 'm'
    render(wrap(<EntityRef entityId="A::m#()">m</EntityRef>))
    // 触发点击（fireEvent.click 直接派发合成事件，不需要 userEvent）
    fireEvent.click(screen.getByText('m'))
    // 断言 openEntity 被以正确的 entityId 调用了一次
    expect(state.openEntity).toHaveBeenCalledWith('A::m#()')
  })

  it('EntityChip onClick → openEntity', () => {
    // EntityChip 渲染一个 <button>，可以用 getByRole('button') 选取
    render(wrap(<EntityChip entityId="A::m#(Long)" />))
    // 触发点击
    fireEvent.click(screen.getByRole('button'))
    // 断言 openEntity 被以正确的 entityId 调用了一次
    expect(state.openEntity).toHaveBeenCalledWith('A::m#(Long)')
  })
})
