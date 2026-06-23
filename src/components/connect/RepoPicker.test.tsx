/**
 * src/components/connect/RepoPicker.test.tsx
 *
 * 单元测试：RepoPicker 组件
 *   ① 给混合 repos（can_bind / can_query / bound）→ 断言三类均渲染
 *   ② 搜索框过滤：输入关键词后只剩匹配行
 *   ③ 点 can_bind 行 → 触发 onSelect；点 can_query / bound 行 → 不触发
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
// render：渲染组件到 JSDOM
// screen：查询渲染结果里的 DOM 元素
// fireEvent：模拟用户输入/点击等交互
import { render, screen, fireEvent } from '@testing-library/react'
// MemoryRouter：react-router-dom 测试专用路由上下文
// RepoPicker 内部用了 <Link>，需要路由 context
import { MemoryRouter } from 'react-router-dom'
import { RepoPicker } from './RepoPicker'
import type { VisibleRepo } from '@/types/scm'

// ── 测试数据：混合三种状态的仓库列表 ──────────────────────────────────

// can_bind：用户有管理员权限，未绑定，可以点选
const repoCanBind: VisibleRepo = {
  external_id: 1,
  full_name: 'owner/can-bind-repo',
  default_branch: 'main',
  private: false,
  scm_role: 'can_bind',
  bound: false,
  bound_project_id: null,
}

// can_query：只有查询权限，不可绑定，应置灰
const repoCanQuery: VisibleRepo = {
  external_id: 2,
  full_name: 'owner/query-only-repo',
  default_branch: 'main',
  private: true,      // 同时测试「私有」徽标
  scm_role: 'can_query',
  bound: false,
  bound_project_id: null,
}

// bound：已绑定到某项目，不可再点选
const repoBound: VisibleRepo = {
  external_id: 3,
  full_name: 'owner/bound-repo',
  default_branch: 'main',
  private: false,
  scm_role: 'can_bind',
  bound: true,
  bound_project_id: 'proj-abc',
}

// ── 工具函数：包裹 MemoryRouter 渲染 ────────────────────────────────────
// RepoPicker 内部使用了 react-router-dom 的 <Link>，必须套 MemoryRouter
function renderPicker(repos: VisibleRepo[], onSelect = vi.fn()) {
  return {
    onSelect,
    ...render(
      // MemoryRouter：不依赖真实浏览器地址栏的路由 provider
      <MemoryRouter>
        <RepoPicker repos={repos} onSelect={onSelect} />
      </MemoryRouter>,
    ),
  }
}

describe('RepoPicker', () => {
  // beforeEach：每个 it 测试前执行，vi.clearAllMocks 清除上一个测试的 mock 状态
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 测试 ①：三类仓库均渲染 ────────────────────────────────────────
  it('①渲染三类仓库（can_bind / can_query / bound）', () => {
    renderPicker([repoCanBind, repoCanQuery, repoBound])

    // 三行仓库名都应该出现在页面中
    // getByText：找到包含该文字的元素，找不到则报错
    expect(screen.getByText('owner/can-bind-repo')).toBeInTheDocument()
    expect(screen.getByText('owner/query-only-repo')).toBeInTheDocument()
    expect(screen.getByText('owner/bound-repo')).toBeInTheDocument()

    // can_query 行：应有「仅查询」徽标（查询所有匹配文字）
    // getAllByText：返回所有匹配的元素数组
    expect(screen.getAllByText('仅查询').length).toBeGreaterThan(0)

    // bound 行：应有「已绑定」徽标
    expect(screen.getAllByText('已绑定').length).toBeGreaterThan(0)

    // can_query 的 private 仓库：应有「私有」徽标
    expect(screen.getByText('私有')).toBeInTheDocument()

    // bound 行有 bound_project_id → 应有「查看项目」链接
    expect(screen.getByText('查看项目')).toBeInTheDocument()
  })

  // ── 测试 ②：搜索框过滤 ────────────────────────────────────────────
  it('②搜索框按 full_name 子串过滤（大小写不敏感）', () => {
    renderPicker([repoCanBind, repoCanQuery, repoBound])

    // 找到搜索框：通过 placeholder 定位（getByPlaceholderText 是 testing-library 内置查询）
    const input = screen.getByPlaceholderText('搜索仓库名…')

    // fireEvent.change：模拟用户在 input 里输入内容
    // target.value 设置输入框的值
    fireEvent.change(input, { target: { value: 'can-bind' } })

    // 过滤后只剩 can-bind-repo
    expect(screen.getByText('owner/can-bind-repo')).toBeInTheDocument()
    // 其他两行应消失
    // queryByText：找不到时返回 null（不报错），配合 not.toBeInTheDocument()
    expect(screen.queryByText('owner/query-only-repo')).not.toBeInTheDocument()
    expect(screen.queryByText('owner/bound-repo')).not.toBeInTheDocument()
  })

  it('②搜索框无匹配时显示「无匹配仓库」', () => {
    renderPicker([repoCanBind, repoCanQuery, repoBound])

    const input = screen.getByPlaceholderText('搜索仓库名…')
    // 输入一个不存在的名字
    fireEvent.change(input, { target: { value: 'nonexistent-xyz-9999' } })

    // 应该显示空状态提示
    expect(screen.getByText('无匹配仓库')).toBeInTheDocument()
  })

  it('②大小写不敏感：输入大写 QUERY 也能匹配 query-only-repo', () => {
    renderPicker([repoCanBind, repoCanQuery, repoBound])

    const input = screen.getByPlaceholderText('搜索仓库名…')
    // 大写搜索
    fireEvent.change(input, { target: { value: 'QUERY' } })

    // query-only-repo 包含 "query"，应被匹配
    expect(screen.getByText('owner/query-only-repo')).toBeInTheDocument()
    // can-bind-repo 不含 "query"，不应出现
    expect(screen.queryByText('owner/can-bind-repo')).not.toBeInTheDocument()
  })

  // ── 测试 ③：点击行的交互逻辑 ─────────────────────────────────────
  it('③点 can_bind 行 → 触发 onSelect', () => {
    // vi.fn()：创建一个 spy 函数，可以记录调用次数和参数
    const onSelect = vi.fn()
    renderPicker([repoCanBind, repoCanQuery, repoBound], onSelect)

    // 找到 can_bind 行的仓库名元素，触发点击
    // 点击行内的文字也会触发 li 的 onClick（事件冒泡）
    fireEvent.click(screen.getByText('owner/can-bind-repo'))

    // 断言：onSelect 被调用了一次，且参数是 repoCanBind
    // toHaveBeenCalledWith：vi 的断言方法，检查 spy 的调用参数
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(repoCanBind)
  })

  it('③点 can_query（置灰）行 → 不触发 onSelect', () => {
    const onSelect = vi.fn()
    renderPicker([repoCanBind, repoCanQuery, repoBound], onSelect)

    // 点击 can_query 行
    fireEvent.click(screen.getByText('owner/query-only-repo'))

    // 断言：onSelect 没有被调用
    // not.toHaveBeenCalled：期望函数从未被调用
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('③点 bound（已绑定）行 → 不触发 onSelect', () => {
    const onSelect = vi.fn()
    renderPicker([repoCanBind, repoCanQuery, repoBound], onSelect)

    // 点击 bound 行的仓库名
    fireEvent.click(screen.getByText('owner/bound-repo'))

    // 断言：onSelect 没有被调用
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('③点 bound 行的「查看项目」链接 → 不触发 onSelect（stopPropagation）', () => {
    const onSelect = vi.fn()
    renderPicker([repoCanBind, repoCanQuery, repoBound], onSelect)

    // 点「查看项目」链接（Link 组件）
    fireEvent.click(screen.getByText('查看项目'))

    // stopPropagation 阻止冒泡，onSelect 不应被触发
    expect(onSelect).not.toHaveBeenCalled()
  })
})
