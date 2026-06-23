/**
 * src/pages/connect/BindRepoPage.test.tsx
 *
 * 单元测试：BindRepoPage（屏 3+4 绑定确认页）
 *
 * 测试覆盖：
 *   ① 加载后分支下拉默认选中 default_branch
 *   ② 填写表单提交 → createProjectBind 被调用且 body 正确 → navigate 到 /project/<id>?indexing=1
 *   ③ createProjectBind reject 409 → 显示「工程 ID 已存在」文案，不调 navigate
 *   ④ deriveSlug 纯函数：macrozheng/mall-swarm → 'mall-swarm'
 *   ⑤ deriveSlug：含大写/下划线 → 合规 slug
 *   ⑥ deriveSlug：首字符是数字 → 自动补前缀
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
// render/screen/waitFor/fireEvent：testing-library 核心 API
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// userEvent：比 fireEvent 更真实地模拟用户输入（处理 onChange 等）
import userEvent from '@testing-library/user-event'
// MemoryRouter/Routes/Route：在测试里模拟带 :connId 的路由
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ── mock @/api/scm ──────────────────────────────────────────────────────────
// vi.mock 被 vitest hoist 到模块顶部，所以必须在被测模块 import 之前声明
// 工厂函数里列出所有该模块用到的导出，确保 mock 完整
vi.mock('@/api/scm', () => ({
  listVisibleRepos: vi.fn(),
  listBranches: vi.fn(),
  createProjectBind: vi.fn(),
}))

// ── mock react-router-dom useNavigate ──────────────────────────────────────
// 拦截 navigate 函数，方便断言"跳转到了正确路径"
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  // importOriginal：拿真实模块，只覆盖 useNavigate，保留 MemoryRouter/Routes/Route 等
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,            // 展开运算符：保留原有所有导出
    useNavigate: () => mockNavigate,  // 仅覆盖 useNavigate
  }
})

// ── 延迟导入被测模块（必须在 vi.mock 之后）──────────────────────────────
import { BindRepoPage, deriveSlug } from './BindRepoPage'
// 导入 mock 版本的 API，以便用 vi.mocked 设置返回值
import * as scmApi from '@/api/scm'

// ── 测试数据 ──────────────────────────────────────────────────────────────

// 目标仓库（external_id=42，与 query string ?repo=42 对应）
const targetRepo = {
  external_id: 42,
  full_name: 'macrozheng/mall-swarm',
  default_branch: 'main',
  private: false,
  scm_role: 'can_bind' as const,
  bound: false,
  bound_project_id: null,
}

// 其他仓库（external_id 不同，不是目标）
const otherRepo = {
  external_id: 99,
  full_name: 'macrozheng/mall-admin',
  default_branch: 'master',
  private: false,
  scm_role: 'can_bind' as const,
  bound: false,
  bound_project_id: null,
}

// 分支列表
const branches = [
  { name: 'main', commit_sha: 'abc123' },
  { name: 'develop', commit_sha: 'def456' },
  { name: 'release/1.0', commit_sha: 'ghi789' },
]

// ── 工具函数：渲染 BindRepoPage（带路由上下文）──────────────────────────
// 路由：/settings/connections/c1/bind?repo=42
function renderPage(
  connId = 'c1',
  repoParam = '42',
) {
  // MemoryRouter initialEntries：模拟初始 URL
  return render(
    <MemoryRouter initialEntries={[`/settings/connections/${connId}/bind?repo=${repoParam}`]}>
      {/* Routes + Route：注入动态参数 :connId，让 useParams() 能取到值 */}
      <Routes>
        <Route
          path="/settings/connections/:connId/bind"
          element={<BindRepoPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

// ── 测试套件 ─────────────────────────────────────────────────────────────

describe('BindRepoPage', () => {
  // beforeEach：每个测试前重置所有 mock（清除上一个测试的调用记录）
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─────────────────────────────────────────────────────────────────────
  // 测试 ①：加载后分支下拉默认选中 default_branch
  // ─────────────────────────────────────────────────────────────────────
  it('①加载后分支下拉默认选中 default_branch', async () => {
    // mockResolvedValue：让函数返回 resolved Promise（成功情况）
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([targetRepo, otherRepo])
    vi.mocked(scmApi.listBranches).mockResolvedValue(branches)

    renderPage()

    // waitFor：等待异步加载完成（useEffect 里有 await 调用，是异步的）
    // 等到分支下拉出现
    const select = await waitFor(() =>
      screen.getByRole('combobox', { name: /分支/i }),
    )

    // 断言：select 的 value 应等于 default_branch（'main'）
    // toHaveValue：testing-library 提供的 matcher，检查表单元素当前值
    expect(select).toHaveValue('main')

    // 断言 listBranches 以正确参数被调用
    expect(scmApi.listBranches).toHaveBeenCalledWith('c1', 'macrozheng/mall-swarm')
  })

  // ─────────────────────────────────────────────────────────────────────
  // 测试 ②：填写表单提交 → API 被调且 body 正确 → navigate 到正确路径
  // ─────────────────────────────────────────────────────────────────────
  it('②提交表单 → createProjectBind body 正确 → navigate /project/<id>?indexing=1', async () => {
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([targetRepo])
    vi.mocked(scmApi.listBranches).mockResolvedValue(branches)
    // createProjectBind 返回成功响应（project_id + job_id）
    vi.mocked(scmApi.createProjectBind).mockResolvedValue({
      project_id: 'mall-swarm',
      job_id: 'job-001',
    })

    renderPage()

    // 等待表单渲染完成（以工程名输入框出现为标志）
    const nameInput = await waitFor(() =>
      screen.getByRole('textbox', { name: /工程名/i }),
    )

    // 使用 userEvent 模拟用户输入工程名
    // userEvent.setup()：创建 userEvent 实例，更真实地模拟浏览器事件序列
    const user = userEvent.setup()
    await user.clear(nameInput)
    await user.type(nameInput, 'mall-swarm 商城')

    // 提交表单（点击"确认绑定"按钮）
    const submitBtn = screen.getByRole('button', { name: /确认绑定/i })
    await user.click(submitBtn)

    // 等待 createProjectBind 被调用
    await waitFor(() => {
      expect(scmApi.createProjectBind).toHaveBeenCalledTimes(1)
    })

    // 断言调用参数：
    //   第一参数：connId = 'c1'
    //   第二参数（请求体）：repo_external_id=42、repo_full_name、ref、ref_type:'branch'
    expect(scmApi.createProjectBind).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        repo_external_id: 42,
        repo_full_name: 'macrozheng/mall-swarm',
        ref: 'main',                // default_branch
        ref_type: 'branch',
        name: 'mall-swarm 商城',
      }),
    )

    // 断言 navigate 被调用，跳转到 /project/<id>?indexing=1
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/project/mall-swarm?indexing=1')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // 测试 ③：createProjectBind reject 409 → 显示错误文案，不 navigate
  // ─────────────────────────────────────────────────────────────────────
  it('③提交 409 → 显示「工程 ID 已存在」文案，不 navigate', async () => {
    vi.mocked(scmApi.listVisibleRepos).mockResolvedValue([targetRepo])
    vi.mocked(scmApi.listBranches).mockResolvedValue(branches)

    // 模拟 axios 风格的 409 错误（带 response.status 字段）
    const err409 = Object.assign(new Error('Conflict'), {
      response: { status: 409 },
    })
    vi.mocked(scmApi.createProjectBind).mockRejectedValue(err409)

    renderPage()

    // 等待表单渲染
    const nameInput = await waitFor(() =>
      screen.getByRole('textbox', { name: /工程名/i }),
    )

    const user = userEvent.setup()
    await user.clear(nameInput)
    await user.type(nameInput, '测试工程')

    // 提交
    const submitBtn = screen.getByRole('button', { name: /确认绑定/i })
    await user.click(submitBtn)

    // 等待错误文案出现
    await waitFor(() => {
      // getByText：按文本内容查找元素（精确子串匹配用 substring）
      expect(screen.getByText('工程 ID 已存在，换一个')).toBeInTheDocument()
    })

    // 断言 navigate 未被调用（失败不跳转）
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deriveSlug 纯函数单测
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveSlug', () => {
  // 测试 ④：标准 GitHub full_name → 取仓库名部分
  it("④ 'macrozheng/mall-swarm' → 'mall-swarm'", () => {
    // 期望：取 '/' 后的 'mall-swarm'，已是合法 slug
    expect(deriveSlug('macrozheng/mall-swarm')).toBe('mall-swarm')
  })

  // 测试 ⑤：含大写和下划线 → 转换成合规 slug
  it('⑤ 含大写 + 下划线 → 合规 slug', () => {
    // 'MyOrg/My_Service_V2' → 取 'My_Service_V2' → 小写 → 'my_service_v2' → 下划线→'-' → 'my-service-v2'
    const result = deriveSlug('MyOrg/My_Service_V2')
    // 合规 slug 正则：首字母 + 字母/数字/连字符 + 末尾字母/数字
    expect(result).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/)
    // 确认无大写和下划线
    expect(result).not.toMatch(/[A-Z_]/)
    // 具体值
    expect(result).toBe('my-service-v2')
  })

  // 测试 ⑥：首字符是数字 → 自动补前缀保证首字母开头
  it('⑥ 首字符是数字 → 补 r- 前缀', () => {
    // '2024-backend' → 首字符 '2' 是数字 → 加 'r-' → 'r-2024-backend'
    const result = deriveSlug('org/2024-backend')
    // 期望以字母开头
    expect(result).toMatch(/^[a-z]/)
    expect(result).toBe('r-2024-backend')
  })

  // 额外测试：空 org 前缀（无 '/'）→ 整个字符串作为仓库名
  it('无 "/" 时直接处理整个字符串', () => {
    // 没有 '/'，split('/').pop() 返回原字符串
    const result = deriveSlug('my-project')
    expect(result).toBe('my-project')
  })
})
