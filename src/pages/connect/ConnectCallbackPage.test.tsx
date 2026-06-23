/**
 * src/pages/connect/ConnectCallbackPage.test.tsx
 *
 * 单元测试：ConnectCallbackPage（回调中转）
 *   ① 成功路径：completeInstallCallback + listConnections → navigate 到 /select
 *   ② 找不到匹配连接 → navigate 到 /settings/connections
 *   ③ 缺少参数 → 显示错误
 *   ④ completeInstallCallback 失败 → 显示错误
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
// MemoryRouter initialEntries：模拟带 query string 的初始 URL
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ── mock @/api/scm ────────────────────────────────────────────────────
vi.mock('@/api/scm', () => ({
  completeInstallCallback: vi.fn(),
  listConnections: vi.fn(),
}))

// mock useNavigate（拦截跳转断言，不真实跳转）
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// 延迟 import 被测组件
import { ConnectCallbackPage } from './ConnectCallbackPage'
import * as scmApi from '@/api/scm'
import type { ScmConnection } from '@/types/scm'

// ── 工具函数：用 MemoryRouter + 带参数的 URL 渲染 ──────────────────
function renderCallback(search = '?installation_id=12&state=s') {
  return render(
    <MemoryRouter initialEntries={[`/connect/callback${search}`]}>
      {/* Routes+Route 让 useSearchParams 能读到 search 部分 */}
      <Routes>
        <Route path="/connect/callback" element={<ConnectCallbackPage />} />
        {/* fallback：其它路由不需要渲染内容 */}
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ConnectCallbackPage', () => {
  beforeEach(() => {
    // 每个测试前重置所有 mock
    vi.clearAllMocks()
  })

  // ── 测试 ①：成功路径 → navigate 到 /settings/connections/<id>/select ──
  it('① 成功 → navigate 到 /settings/connections/<id>/select', async () => {
    // completeInstallCallback 成功（返回任意值）
    vi.mocked(scmApi.completeInstallCallback).mockResolvedValue({})

    // listConnections 返回一条连接，github_installation_id = 12（匹配 URL 里的 12）
    const mockConn: ScmConnection = {
      id: 'conn-abc',
      provider: 'github',
      account_login: 'octocat',
      github_installation_id: 12,   // Number('12') === 12 → 匹配
      auth_type: 'github_app',
      status: 'active',
    }
    vi.mocked(scmApi.listConnections).mockResolvedValue([mockConn])

    renderCallback('?installation_id=12&state=s')

    // 等待 useEffect 异步完成，断言 navigate 被调用且路径正确
    await waitFor(() => {
      expect(scmApi.completeInstallCallback).toHaveBeenCalledWith({
        installation_id: '12',
        state: 's',
      })
      expect(scmApi.listConnections).toHaveBeenCalledTimes(1)
      // navigate 应该带 replace:true 防止返回键重复触发回调
      expect(mockNavigate).toHaveBeenCalledWith(
        '/settings/connections/conn-abc/select',
        { replace: true },
      )
    })
  })

  // ── 测试 ②：找不到匹配连接 → navigate 到 /settings/connections ──────
  it('② 找不到匹配连接 → navigate 到 /settings/connections', async () => {
    vi.mocked(scmApi.completeInstallCallback).mockResolvedValue({})

    // 返回的连接 github_installation_id 不匹配（999 ≠ 12）
    const mockConn: ScmConnection = {
      id: 'conn-xyz',
      provider: 'github',
      account_login: 'octocat',
      github_installation_id: 999,
      auth_type: 'github_app',
      status: 'active',
    }
    vi.mocked(scmApi.listConnections).mockResolvedValue([mockConn])

    renderCallback('?installation_id=12&state=s')

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/settings/connections',
        { replace: true },
      )
    })
  })

  // ── 测试 ③：缺少参数 → 显示错误态 ──────────────────────────────────
  it('③ 缺少 installation_id → 显示错误', async () => {
    // 只传 state，缺 installation_id
    renderCallback('?state=s')

    // 错误态下应显示「连接失败」标题
    await waitFor(() => {
      expect(screen.getByText('连接失败')).toBeInTheDocument()
    })

    // 应该提示缺少参数
    expect(screen.getByText(/缺少必要参数/)).toBeInTheDocument()

    // 错误态下不应调任何 API
    expect(scmApi.completeInstallCallback).not.toHaveBeenCalled()
  })

  // ── 测试 ④：completeInstallCallback 失败 → 显示错误 ─────────────────
  it('④ completeInstallCallback 抛错 → 显示错误态', async () => {
    vi.mocked(scmApi.completeInstallCallback).mockRejectedValue(
      new Error('state mismatch'),
    )

    renderCallback('?installation_id=12&state=s')

    await waitFor(() => {
      expect(screen.getByText('连接失败')).toBeInTheDocument()
      expect(screen.getByText('state mismatch')).toBeInTheDocument()
    })

    // 「返回连接页」链接应存在
    expect(screen.getByText('← 返回连接页')).toBeInTheDocument()
  })
})
