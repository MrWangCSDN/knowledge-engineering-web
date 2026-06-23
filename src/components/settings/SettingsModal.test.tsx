/**
 * src/components/settings/SettingsModal.test.tsx
 *
 * SettingsModal + background-location 路由模式集成测试
 *
 * 覆盖场景：
 *   1. UserMenu 点「设置」→ navigate 被调，第二参含 state.background
 *   2. background 存在 → SettingsModal 渲染（含 SettingsLayout 的 tab 文案「工程」）
 *   3. 关闭 X 按钮 → navigate 回 background.pathname
 *   4. 直接访问 /settings/projects（无 background）→ 全页 SettingsLayout 渲染、无模态遮罩
 *
 * 测试策略：
 *   - 用 MemoryRouter + initialEntries 控制初始路由和 state，避免依赖真实 URL
 *   - App 的依赖（auth store / infra hooks 等）全部 mock 掉，只测路由模态逻辑
 *   - SettingsLayout 的子页面（RepositoryListPage 等）也 mock 掉，避免 API 请求
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// MemoryRouter：不依赖真实 URL，适合单测
// Routes / Route / Navigate：react-router-dom 路由声明组件
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Mock 声明（vi.mock 必须在文件顶层，vitest 会提升到所有 import 之前执行）
// ─────────────────────────────────────────────────────────────────────────────

// mock useNavigate：让 navigate 变成 spy，可以断言被调用的参数
const mockNavigate = vi.fn()

// vi.mock('react-router-dom', ...)：替换整个模块，但保留真实实现（importActual）
vi.mock('react-router-dom', async () => {
  // importActual：拿到原模块的真实导出，MemoryRouter/Routes/Route 等保持正常工作
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    // 展开所有真实导出
    ...actual,
    // 只替换 useNavigate，返回我们的 spy
    useNavigate: () => mockNavigate,
  }
})

// mock auth store：SettingsLayout / UserMenu 都需要它
vi.mock('@/store/auth', () => ({
  // useAuthStore：模拟 Zustand selector 调用模式
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ user: { id: 1, username: 'alice', email: 'a@x.com', is_admin: false } })
  ),
}))

// mock theme store：UserMenu 需要
vi.mock('@/store/theme', () => ({
  useThemeStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ theme: 'light', toggleTheme: vi.fn() })
  ),
}))

// mock auth API：UserMenu logout 需要
vi.mock('@/api/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}))

// mock infra health bootstrap：App 里用到
vi.mock('@/hooks/useInfraHealthBootstrap', () => ({
  useInfraHealthBootstrap: vi.fn(),
}))

// mock InfraBanner：避免渲染真实 banner（依赖 infra store）
vi.mock('@/components/layout/InfraBanner', () => ({
  InfraBanner: () => null,
}))

// mock RequireAuth：跳过登录检查，直接渲染子内容
vi.mock('@/components/auth/RequireAuth', () => ({
  // children：RequireAuth 的子内容，mock 直接渲染出来
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// mock AppLayout：只渲染 Outlet，避免引入侧边栏等复杂组件
vi.mock('@/components/layout/AppLayout', () => ({
  // Outlet：AppLayout 内部的插槽，mock 直接用 react-router-dom 的真实 Outlet
  AppLayout: () => {
    // 动态引入 Outlet（不能在模块顶层用，因为 vi.mock 提升后顺序问题）
    const { Outlet } = require('react-router-dom')
    return <Outlet />
  },
}))

// mock settings 子页面：只渲染占位文本，避免 API 请求
vi.mock('@/pages/settings/RepositoryListPage', () => ({
  RepositoryListPage: () => <div data-testid="repo-list-page">工程列表页</div>,
}))
vi.mock('@/pages/settings/ProjectDetailPage', () => ({
  ProjectDetailPage: () => <div>工程详情页</div>,
}))
vi.mock('@/pages/settings/GroupListPage', () => ({
  GroupListPage: () => <div>组列表页</div>,
}))
vi.mock('@/pages/settings/GroupDetailPage', () => ({
  GroupDetailPage: () => <div>组详情页</div>,
}))
vi.mock('@/pages/settings/CredentialListPage', () => ({
  CredentialListPage: () => <div>凭证列表页</div>,
}))
vi.mock('@/pages/settings/UserListPage', () => ({
  UserListPage: () => <div>用户列表页</div>,
}))
vi.mock('@/pages/settings/AuditLogPage', () => ({
  AuditLogPage: () => <div>审计日志页</div>,
}))
vi.mock('@/pages/settings/ArchivedSessionsPage', () => ({
  ArchivedSessionsPage: () => <div>已归档对话页</div>,
}))
vi.mock('@/pages/connect/ConnectionListPage', () => ({
  ConnectionListPage: () => <div>连接列表页</div>,
}))
vi.mock('@/pages/connect/ConnectCallbackPage', () => ({
  ConnectCallbackPage: () => <div>回调页</div>,
}))
vi.mock('@/pages/connect/SelectRepoPage', () => ({
  SelectRepoPage: () => <div>选仓页</div>,
}))
vi.mock('@/pages/connect/BindRepoPage', () => ({
  BindRepoPage: () => <div>绑定确认页</div>,
}))
vi.mock('@/pages/LoginPage', () => ({
  LoginPage: () => <div>登录页</div>,
}))
vi.mock('@/pages/RootRedirect', () => ({
  RootRedirect: () => <div>根重定向</div>,
}))
vi.mock('@/pages/ChatPage', () => ({
  ChatPage: () => <div>Chat 页</div>,
}))
vi.mock('@/pages/HomePage', () => ({
  HomePage: () => <div>首页</div>,
}))
vi.mock('@/pages/SearchPage', () => ({
  SearchPage: () => <div>搜索页</div>,
}))
vi.mock('@/pages/MethodDetailPage', () => ({
  MethodDetailPage: () => <div>方法详情页</div>,
}))
vi.mock('@/pages/ImpactAnalysisPage', () => ({
  ImpactAnalysisPage: () => <div>影响分析页</div>,
}))
vi.mock('@/pages/MethodTablePage', () => ({
  MethodTablePage: () => <div>方法表页</div>,
}))
vi.mock('@/pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>404 页</div>,
}))
vi.mock('@/pages/DevMarkdownPreview', () => ({
  DevMarkdownPreview: () => <div>Markdown 预览页</div>,
}))

// ─────────────────────────────────────────────────────────────────────────────
// 导入被测组件（在所有 mock 声明之后）
// ─────────────────────────────────────────────────────────────────────────────

// App：带 background-location 逻辑的根组件
import App from '@/App'
// UserMenu：「设置」入口组件
import { UserMenu } from '@/components/auth/UserMenu'
// SettingsModal：被测模态组件
import { SettingsModal } from './SettingsModal'
// SettingsLayout：模态内复用的布局组件
import { SettingsLayout } from '@/pages/settings/SettingsLayout'

// ─────────────────────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────────────────────

describe('background-location 设置模态', () => {
  // beforeEach：每个测试前清除 mock 调用记录，防止测试间互相污染
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 测试 1：UserMenu 点「设置」→ navigate 含 state.background ──
  it('UserMenu 点「设置」→ navigate 被调且第二参含 state.background', async () => {
    // userEvent.setup()：创建带完整指针事件序列的用户实例（v14 新 API）
    const user = userEvent.setup()

    // MemoryRouter 提供路由上下文
    // initialEntries：初始 history 栈，这里模拟当前在某个项目页
    render(
      <MemoryRouter initialEntries={['/project/42']}>
        <UserMenu />
      </MemoryRouter>
    )

    // 点击触发按钮（aria-label="用户菜单"）打开下拉菜单
    await user.click(screen.getByRole('button', { name: '用户菜单' }))

    // findByText：等待 radix Portal 异步渲染到 document.body
    await user.click(await screen.findByText('设置'))

    // navigate 应被调用一次
    expect(mockNavigate).toHaveBeenCalledTimes(1)

    // 第一个参数应是 /settings/projects
    const [path, options] = mockNavigate.mock.calls[0]
    expect(path).toBe('/settings/projects')

    // 第二个参数应含 state.background，且 background.pathname 是当前页面路径
    expect(options).toMatchObject({
      state: {
        background: expect.objectContaining({ pathname: '/project/42' }),
      },
    })
  })

  // ── 测试 2：background 存在 → SettingsModal 渲染（含 tab 文案「工程」）──
  it('background 存在时 SettingsModal 渲染，含 SettingsLayout tab「工程」', () => {
    // 用最小路由壳测试：直接渲染 SettingsModal，给它 SettingsLayout + RepositoryListPage 子路由
    render(
      <MemoryRouter
        initialEntries={[
          {
            // 当前 pathname = /settings/projects（模态模式下的真实 URL）
            pathname: '/settings/projects',
            // state.background 存在，模拟从 /project/x 打开
            state: { background: { pathname: '/project/x', search: '', hash: '', key: 'default', state: null } },
          },
        ]}
      >
        <Routes>
          {/* 渲染 SettingsModal 并给它子路由（RepositoryListPage） */}
          <Route path="/settings" element={<SettingsModal />}>
            <Route index element={<Navigate to="/settings/projects" replace />} />
            <Route path="projects" element={<div data-testid="repo-list-page">工程列表页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // 模态应渲染（role="dialog"）
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // SettingsLayout 内应有 tab「工程」（NavLink 文案）
    expect(screen.getByText('工程')).toBeInTheDocument()

    // 子页面内容应在模态内渲染
    expect(screen.getByTestId('repo-list-page')).toBeInTheDocument()
  })

  // ── 测试 3：关闭 X → navigate 回 background.pathname ──
  it('点关闭 X → navigate 回 background', async () => {
    const user = userEvent.setup()

    // background 指向 /project/x
    const background = { pathname: '/project/x', search: '', hash: '', key: 'bg', state: null }

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/settings/projects', state: { background } },
        ]}
      >
        <Routes>
          <Route path="/settings" element={<SettingsModal />}>
            <Route path="projects" element={<div>工程列表页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // 找到关闭按钮（aria-label="关闭设置"）并点击
    await user.click(screen.getByRole('button', { name: '关闭设置' }))

    // navigate 应被调用，参数是 background location 对象
    expect(mockNavigate).toHaveBeenCalledWith(background)
  })

  // ── 测试 4：直接 /settings/projects（无 background）→ 全页、无模态遮罩 ──
  it('直接访问 /settings/projects（无 background）→ 全页 SettingsLayout，无 dialog', () => {
    render(
      <MemoryRouter initialEntries={['/settings/projects']}>
        <Routes>
          {/* 全页路由：element 是 SettingsLayout（非 SettingsModal） */}
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="projects" element={<div data-testid="repo-list-page">工程列表页</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // 不应有模态（role="dialog"），应是全页渲染
    expect(screen.queryByRole('dialog')).toBeNull()

    // SettingsLayout 的 tab 应可见
    expect(screen.getByText('工程')).toBeInTheDocument()

    // 全页模式应有"返回主页" Link
    expect(screen.getByText('返回主页')).toBeInTheDocument()

    // 子页面内容正常渲染
    expect(screen.getByTestId('repo-list-page')).toBeInTheDocument()
  })
})
