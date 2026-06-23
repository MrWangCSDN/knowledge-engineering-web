/**
 * src/pages/connect/ConnectionListPage.test.tsx
 *
 * 单元测试：ConnectionListPage
 *   ① 列出已有连接（正常渲染）
 *   ② 点「连接 GitHub」→ 调 getInstallUrl（mock window.location）
 *   ③ getInstallUrl 抛 403 → 转调 startLinkGithub
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
// render：把组件渲染到测试 DOM
// screen：查询渲染结果里的元素
// waitFor：等待异步状态更新
// fireEvent：触发用户事件
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// MemoryRouter：测试专用路由（不依赖真实浏览器 URL）
import { MemoryRouter } from 'react-router-dom'

// ── mock @/api/scm ────────────────────────────────────────────────────
// vi.mock：拦截模块导入，替换为测试替身
// 必须在 import 被测组件之前声明（vitest 会把 vi.mock 提升到文件顶部 hoist）
vi.mock('@/api/scm', () => ({
  listConnections: vi.fn(),
  getInstallUrl: vi.fn(),
  startLinkGithub: vi.fn(),
}))

// 拦截 react-router-dom 的 useNavigate，便于断言跳转
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  // importOriginal：拿到真实模块，再覆盖 useNavigate
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// 延迟 import 被测组件（必须在 vi.mock 之后）
import { ConnectionListPage } from './ConnectionListPage'
// 导入 mock 版本以便在测试里设置返回值
import * as scmApi from '@/api/scm'
import type { ScmConnection } from '@/types/scm'

// ── 工具函数：渲染包裹 MemoryRouter ──────────────────────────────────
function renderPage() {
  return render(
    // MemoryRouter：提供 react-router context，不需要真实浏览器地址栏
    <MemoryRouter initialEntries={['/settings/connections']}>
      <ConnectionListPage />
    </MemoryRouter>,
  )
}

describe('ConnectionListPage', () => {
  beforeEach(() => {
    // 每个测试前重置所有 mock，避免上一个测试的状态污染下一个
    vi.clearAllMocks()
  })

  // ── 测试 ①：正常列出连接 ─────────────────────────────────────────
  it('①列出已有连接', async () => {
    // 准备 mock 数据：两条连接
    const mockConns: ScmConnection[] = [
      {
        id: 'conn-1',
        provider: 'github',
        account_login: 'octocat',
        github_installation_id: 42,
        auth_type: 'github_app',
        status: 'active',
      },
      {
        id: 'conn-2',
        provider: 'github',
        account_login: null,       // account_login 为 null 时退化显示 id 后缀
        github_installation_id: 99,
        auth_type: 'github_app',
        status: 'active',
      },
    ]

    // mockResolvedValue：让 listConnections 返回一个 resolved Promise
    vi.mocked(scmApi.listConnections).mockResolvedValue(mockConns)

    renderPage()

    // waitFor：等待 useEffect 里的异步操作完成后断言
    await waitFor(() => {
      // 第一条：account_login = 'octocat'
      expect(screen.getByText('octocat')).toBeInTheDocument()
    })

    // 第二条：account_login 为 null，退化显示「连接 #<id后6位>」
    expect(screen.getByText(/连接 #/)).toBeInTheDocument()

    // 两条都应该有「选择仓库」按钮
    const selectBtns = screen.getAllByText('选择仓库')
    expect(selectBtns).toHaveLength(2)
  })

  // ── 测试 ②：点「连接 GitHub」调 getInstallUrl ─────────────────────
  it('②点「连接 GitHub」→ 调 getInstallUrl', async () => {
    // 列表为空（先让页面加载出来）
    vi.mocked(scmApi.listConnections).mockResolvedValue([])

    // getInstallUrl 返回一个 install_url
    // jsdom 里 window.location.href 赋值不会真的跳转，Promise resolve 后组件调赋值即完成
    vi.mocked(scmApi.getInstallUrl).mockResolvedValue({
      install_url: 'https://github.com/apps/test/installations/new',
      state: 'abc',
    })

    renderPage()

    // 等待页面初始化完成（loading 结束后按钮出现）
    await waitFor(() => {
      expect(screen.getByText('连接 GitHub')).toBeInTheDocument()
    })

    // fireEvent.click：模拟用户点击
    fireEvent.click(screen.getByText('连接 GitHub'))

    // 断言 getInstallUrl 被调了一次
    await waitFor(() => {
      expect(scmApi.getInstallUrl).toHaveBeenCalledTimes(1)
    })
  })

  // ── 测试 ③：getInstallUrl 抛 403 → 转调 startLinkGithub ──────────
  it('③ getInstallUrl 抛 403 → 调 startLinkGithub', async () => {
    vi.mocked(scmApi.listConnections).mockResolvedValue([])

    // 构造一个 axios 风格的 403 错误对象
    // 真实 axios 错误有 .response.status 字段
    const err403 = Object.assign(new Error('Forbidden'), {
      response: { status: 403 },
    })
    vi.mocked(scmApi.getInstallUrl).mockRejectedValue(err403)

    // startLinkGithub 返回 authorize_url
    vi.mocked(scmApi.startLinkGithub).mockResolvedValue({
      authorize_url: 'https://github.com/login/oauth/authorize?client_id=xxx',
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('连接 GitHub')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('连接 GitHub'))

    // 断言：getInstallUrl 被调一次，然后因为 403 改调 startLinkGithub
    await waitFor(() => {
      expect(scmApi.getInstallUrl).toHaveBeenCalledTimes(1)
      expect(scmApi.startLinkGithub).toHaveBeenCalledTimes(1)
    })
  })
})
