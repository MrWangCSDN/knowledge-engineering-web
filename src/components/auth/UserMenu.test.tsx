/**
 * src/components/auth/UserMenu.test.tsx
 *
 * UserMenu 组件测试：
 *   1. 渲染：头像首字母 + 用户名 + 邮箱可见
 *   2. 打开菜单后：设置 / 帮助 / 主题 / 退出登录 菜单项可见
 *   3. 点设置 → useNavigate spy 收到 '/settings'
 *   4. 点主题 → toggleTheme 被调用
 *   5. 点退出 → logout 被调用 + window.location.replace('/login')
 *   6. user=null → 渲染 null（不挂载任何节点）
 *
 * 关键测试知识：
 *   - vi.mock：vitest 的模块替换函数；在测试文件顶层调用，在所有 import 执行前生效
 *   - MemoryRouter：react-router-dom 提供的内存路由器，不依赖真实 URL，适合单测
 *   - userEvent.setup()：@testing-library/user-event v14 的新 API，
 *       内部模拟真实用户事件序列（pointerdown → mousedown → focus → pointerup → mouseup → click）
 *   - screen.getByText / findByText：前者同步查找、找不到立刻报错；后者返回 Promise，
 *       会等待 DOM 更新（适合 radix portal 异步插入的场景）
 */

// describe/it/expect：vitest 内置全局（globals:true 模式），不需要单独 import
import { describe, it, expect, vi, beforeEach } from 'vitest'

// render：把组件挂到 jsdom；screen：查询渲染后的 DOM
import { render, screen } from '@testing-library/react'

// userEvent：模拟真实用户交互（click、type 等）；setup() 返回带状态的实例
import userEvent from '@testing-library/user-event'

// MemoryRouter：不依赖 window.location 的路由容器，单测必用
import { MemoryRouter } from 'react-router-dom'

import { UserMenu } from './UserMenu'

// ─────────────────────────────────────────────────────────────────────────────
// Mock 声明（必须在 import 语句同层，vitest 会自动提升到文件顶部）
// ─────────────────────────────────────────────────────────────────────────────

// mock useNavigate：让 navigate() 调用变成可追踪的 spy
// vi.fn()：vitest 的 mock 函数，调用后可以用 .toHaveBeenCalledWith() 断言
const mockNavigate = vi.fn()

// vi.mock 的第二个参数是工厂函数，返回模块的替代实现
vi.mock('react-router-dom', async () => {
  // importActual：拿到原始模块的真实实现，避免把整个路由系统 stub 掉
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    // 展开所有真实导出（MemoryRouter / Route / Link 等保持原样）
    ...actual,
    // 只替换 useNavigate，返回我们的 mock 函数
    useNavigate: () => mockNavigate,
  }
})

// mock auth store：让 user 字段可控
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}))

// mock theme store：让 theme 和 toggleTheme 可控
const mockToggleTheme = vi.fn()
vi.mock('@/store/theme', () => ({
  useThemeStore: vi.fn(),
}))

// mock auth API：让 logout() 变成异步 spy（返回 resolved Promise）
const mockApiLogout = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/auth', () => ({
  logout: () => mockApiLogout(),
}))

// ─────────────────────────────────────────────────────────────────────────────
// 导入 mock 后的模块引用（用于在 beforeEach 中设置 mockReturnValue）
// ─────────────────────────────────────────────────────────────────────────────

// 注意：必须在 vi.mock 之后 import，否则拿到的是原始模块
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'

// ─────────────────────────────────────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 渲染 UserMenu，包一层 MemoryRouter（因为内部用了 useNavigate）。
 * MemoryRouter 不读写真实 URL，单测友好。
 */
function renderUserMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────────────────────

describe('UserMenu', () => {
  // beforeEach：每个 it 执行前重置 mock，防止测试间互相污染
  beforeEach(() => {
    // 清除所有 mock 的调用记录（但保留实现）
    vi.clearAllMocks()

    // 为 useAuthStore 设置默认返回值：已登录用户
    // vi.mocked：把 mock 函数转成带类型的 MockedFunction，方便调用 mockImplementation
    vi.mocked(useAuthStore).mockImplementation((selector: (s: unknown) => unknown) => {
      // Zustand selector 用法：调用方传入 s => s.user 这样的函数，mock 需要模拟这个行为
      const state = { user: { username: 'alice', email: 'a@x.com' } }
      return selector(state)
    })

    // 为 useThemeStore 设置默认返回值：亮色主题
    vi.mocked(useThemeStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = { theme: 'light', toggleTheme: mockToggleTheme }
      return selector(state)
    })
  })

  // ── 测试 1：渲染 ──
  it('显示首字母头像 + 用户名 + 邮箱', () => {
    renderUserMenu()

    // 头像首字母：'alice'[0].toUpperCase() = 'A'
    expect(screen.getByText('A')).toBeInTheDocument()
    // 用户名
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0)
    // 邮箱
    expect(screen.getAllByText('a@x.com').length).toBeGreaterThan(0)
  })

  // ── 测试 2：打开菜单后包含所有菜单项 ──
  it('点击 trigger 后菜单包含 设置/帮助/主题/退出登录', async () => {
    // userEvent.setup()：创建一个有完整指针事件序列的 user 实例
    const user = userEvent.setup()
    renderUserMenu()

    // 点击 trigger 按钮（aria-label="用户菜单"）打开菜单
    await user.click(screen.getByRole('button', { name: '用户菜单' }))

    // radix DropdownMenuContent 通过 Portal 挂在 document.body，findByText 等待 DOM 更新
    // 设置
    expect(await screen.findByText('设置')).toBeInTheDocument()
    // 帮助
    expect(await screen.findByText('帮助')).toBeInTheDocument()
    // 主题（亮色主题下文案是"暗色模式"）
    expect(await screen.findByText('暗色模式')).toBeInTheDocument()
    // 退出登录
    expect(await screen.findByText('退出登录')).toBeInTheDocument()
  })

  // ── 测试 3：点设置 → navigate('/settings') ──
  it('点设置 → navigate 收到 /settings', async () => {
    const user = userEvent.setup()
    renderUserMenu()

    // 打开菜单
    await user.click(screen.getByRole('button', { name: '用户菜单' }))
    // 等待菜单出现后点击"设置"
    await user.click(await screen.findByText('设置'))

    // mockNavigate 应被以 '/settings' 调用
    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  // ── 测试 4：点主题 → toggleTheme 被调用 ──
  it('点主题切换 → toggleTheme 被调', async () => {
    const user = userEvent.setup()
    renderUserMenu()

    await user.click(screen.getByRole('button', { name: '用户菜单' }))
    // 亮色主题下文案是"暗色模式"
    await user.click(await screen.findByText('暗色模式'))

    expect(mockToggleTheme).toHaveBeenCalledTimes(1)
  })

  // ── 测试 5：点退出 → logout 被调 + window.location.replace('/login') ──
  it('点退出 → logout 被调 + window.location.replace(/login)', async () => {
    const user = userEvent.setup()

    // mock window.location.replace：jsdom 下 window.location 是只读的，需要用 vi.spyOn + defineProperty
    // Object.defineProperty 允许覆盖不可写属性（如 window.location）
    const replaceSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      // writable: true 让后续可以恢复；configurable: true 允许再次 defineProperty
      configurable: true,
      value: { ...window.location, replace: replaceSpy },
    })

    renderUserMenu()
    await user.click(screen.getByRole('button', { name: '用户菜单' }))
    await user.click(await screen.findByText('退出登录'))

    // 给异步 onLogout 一个 microtask 周期完成（await apiLogout() + replace）
    // findByText 已隐式等待，但 window.location.replace 在 await apiLogout() 之后，
    // 再 await 一次 Promise.resolve() 确保链式异步全完成
    await new Promise((r) => setTimeout(r, 0))

    // apiLogout 应被调用
    expect(mockApiLogout).toHaveBeenCalledTimes(1)
    // window.location.replace 应跳转到 /login
    expect(replaceSpy).toHaveBeenCalledWith('/login')
  })

  // ── 测试 6：user=null → 渲染 null ──
  it('user=null → 渲染 null（容器为空）', () => {
    // 覆盖默认 mock：user 为 null
    vi.mocked(useAuthStore).mockImplementation((selector: (s: unknown) => unknown) => {
      return selector({ user: null })
    })

    const { container } = renderUserMenu()

    // container 是 @testing-library/react 挂载用的 div；若组件返回 null，它内部为空
    expect(container.firstChild).toBeNull()
  })
})
