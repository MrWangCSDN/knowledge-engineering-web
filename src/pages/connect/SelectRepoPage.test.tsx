/**
 * src/pages/connect/SelectRepoPage.test.tsx
 *
 * 单元测试：SelectRepoPage（屏 2 选仓页）
 *   ① 加载后渲染仓库列表（mock listVisibleRepos）
 *   ② 点可绑仓库 → navigate 到 .../c1/bind?repo=<external_id>
 *   ③ loading 态：显示「加载中…」
 *   ④ 错误态：显示错误文字
 *   ⑤ empty 态：显示「未找到可用仓库」
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
// render / screen / waitFor / fireEvent：testing-library 核心 API
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// MemoryRouter + Routes + Route：在测试里模拟带 :connId 的路由
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ── mock @/api/scm ──────────────────────────────────────────────────────
// vi.mock 必须在 import 被测模块之前声明（vitest 会把它提升到顶部 hoist）
vi.mock('@/api/scm', () => ({
  listVisibleRepos: vi.fn(),
  // 列出所有被用到的导出，避免其他 mock 互相干扰
  listConnections: vi.fn(),
  getInstallUrl: vi.fn(),
  startLinkGithub: vi.fn(),
}))

// ── mock react-router-dom 的 useNavigate ─────────────────────────────
// 拦截 navigate 函数，之后可以断言"是否被调用了正确的路径"
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  // importOriginal：拿真实模块，只覆盖 useNavigate，保留其他（MemoryRouter 等）
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// 延迟 import 被测组件（必须在 vi.mock 之后）
import { SelectRepoPage } from './SelectRepoPage'
// 导入 mock 版本以便设置返回值
import * as scmApi from '@/api/scm'
import type { VisibleRepo } from '@/types/scm'

// ── 测试数据 ────────────────────────────────────────────────────────────

// 可绑仓库
const repoCanBind: VisibleRepo = {
  external_id: 101,
  full_name: 'alice/my-service',
  default_branch: 'main',
  private: false,
  scm_role: 'can_bind',
  bound: false,
  bound_project_id: null,
}

// 已绑定仓库
const repoBound: VisibleRepo = {
  external_id: 202,
  full_name: 'alice/already-bound',
  default_branch: 'main',
  private: false,
  scm_role: 'can_bind',
  bound: true,
  bound_project_id: 'proj-xyz',
}

// ── 工具函数：用带 :connId 的路由渲染 SelectRepoPage ─────────────────
// 说明：必须用 MemoryRouter + Routes + Route 注入动态参数，
//       否则 useParams() 取不到 connId（返回 {}）
function renderPage(connId = 'c1') {
  return render(
    // MemoryRouter initialEntries：模拟初始 URL，触发路由匹配
    <MemoryRouter initialEntries={[`/settings/connections/${connId}/select`]}>
      {/* Routes + Route：告诉 react-router "此路径对应 SelectRepoPage，:connId 是参数" */}
      <Routes>
        <Route
          path="/settings/connections/:connId/select"
          element={<SelectRepoPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SelectRepoPage', () => {
  // 每个测试前重置所有 mock
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 测试 ①：正常渲染仓库列表 ─────────────────────────────────────
  it('①加载后渲染可见仓库列表', async () => {
    // mockResolvedValue：让 listVisibleRepos 返回 resolved Promise
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([repoCanBind, repoBound])

    renderPage('c1')

    // 等待异步加载完成后断言（useEffect 里的 await 是异步的）
    await waitFor(() => {
      expect(screen.getByText('alice/my-service')).toBeInTheDocument()
    })

    // 两行都渲染了
    expect(screen.getByText('alice/already-bound')).toBeInTheDocument()

    // 断言 listVisibleRepos 被用正确的 connId 调用
    // toHaveBeenCalledWith：检查调用参数
    expect(scmApi.listVisibleRepos).toHaveBeenCalledWith('c1')
  })

  // ── 测试 ②：点可绑仓库 → navigate 到绑定页 ───────────────────────
  it('②点可绑仓库 → navigate 到 .../c1/bind?repo=<external_id>', async () => {
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([repoCanBind, repoBound])

    renderPage('c1')

    // 等待仓库列表渲染完毕
    await waitFor(() => {
      expect(screen.getByText('alice/my-service')).toBeInTheDocument()
    })

    // 点击可绑仓库行（fireEvent.click 会冒泡到 li 的 onClick）
    fireEvent.click(screen.getByText('alice/my-service'))

    // 断言 navigate 被调用，参数包含 connId 和 external_id
    // toHaveBeenCalledWith：精确匹配参数
    expect(mockNavigate).toHaveBeenCalledWith(
      '/settings/connections/c1/bind?repo=101',
    )
  })

  // ── 测试 ③：loading 态 ────────────────────────────────────────────
  it('③初始 loading 态显示「加载中…」', () => {
    // 用 never-resolving Promise 模拟持续 loading
    // new Promise(() => {}) 永远不 resolve，组件会一直停在 loading 态
    vi.mocked(scmApi.listVisibleRepos).mockReturnValue(new Promise(() => {}))

    renderPage('c1')

    // 立即断言（无需 waitFor，因为 Promise 不会 resolve）
    expect(screen.getByText('加载中…')).toBeInTheDocument()
  })

  // ── 测试 ④：错误态 ────────────────────────────────────────────────
  it('④拉取失败显示错误文字', async () => {
    // mockRejectedValue：让 Promise reject 并抛出错误
    vi.mocked(scmApi.listVisibleRepos).mockRejectedValue(
      new Error('网络请求失败'),
    )

    renderPage('c1')

    // waitFor：等待异步 reject 处理完成，error state 更新后断言
    await waitFor(() => {
      expect(screen.getByText('网络请求失败')).toBeInTheDocument()
    })
  })

  // ── 测试 ⑤：empty 态 ─────────────────────────────────────────────
  it('⑤返回空列表时显示「未找到可用仓库」', async () => {
    // 返回空数组：无仓库
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([])

    renderPage('c1')

    // 等待加载完成后断言空状态文字
    await waitFor(() => {
      expect(screen.getByText('未找到可用仓库')).toBeInTheDocument()
    })
  })

  // ── 测试 ⑥：底部外链存在 ──────────────────────────────────────────
  it('⑥底部有「去 GitHub 调整授权范围」链接', async () => {
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([repoCanBind])

    renderPage('c1')

    // waitFor：等待渲染完成
    await waitFor(() => {
      expect(screen.getByText('alice/my-service')).toBeInTheDocument()
    })

    // 断言底部链接存在
    const link = screen.getByText('去 GitHub 调整授权范围')
    expect(link).toBeInTheDocument()

    // 断言链接地址正确（closest 向上找最近的 <a> 祖先）
    // getAttribute：获取 DOM 元素的属性值
    const anchor = link.closest('a')
    expect(anchor).toHaveAttribute('href', 'https://github.com/settings/installations')
    // target="_blank"：新标签打开
    expect(anchor).toHaveAttribute('target', '_blank')
  })
})
