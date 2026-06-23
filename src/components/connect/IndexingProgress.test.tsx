/**
 * src/components/connect/IndexingProgress.test.tsx
 *
 * 单元测试：IndexingProgress 组件
 *
 * 测试场景：
 *   ① 渲染当前 phase 标签（cloning 时显示「克隆代码」）
 *   ② 进度条 percent（数值反映在 style.width）
 *   ③ done 后停止轮询（getIndexStatus 不再被调用）
 *   ④ failed 显示 error 信息
 *   ⑤ 点「重新索引」调 reindex
 *
 * fake timers 陷阱：
 *   waitFor 内部用真实 setTimeout 轮询断言，在 useFakeTimers 下永远不触发。
 *   解决方案：不用 waitFor，改用 act(async () => { await Promise.resolve() }) flush
 *   微任务后直接同步断言（screen.getByText）。
 */

// describe/it/expect/vi/beforeEach/afterEach：vitest 的测试 DSL
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// render：将组件渲染到 JSDOM 虚拟 DOM
// screen：查询渲染结果（getByText / queryByText 等）
// fireEvent：触发用户交互（点击）
// act：包裹状态更新，确保 React 完成 re-render
import { render, screen, fireEvent, act } from '@testing-library/react'
// IndexingProgress：被测组件
import { IndexingProgress } from './IndexingProgress'
// 导入类型，用于 mock 的返回值声明
import type { IndexStatus } from '@/types/scm'

// ── Mock API 模块 ───────────────────────────────────────────────────────────
// vi.mock：在测试模块加载前替换整个 '@/api/scm' 模块
// 第二个参数工厂函数返回模块的 mock 实现
vi.mock('@/api/scm', () => ({
  // vi.fn()：创建一个 spy 函数，可以追踪调用次数/参数，并配置返回值
  getIndexStatus: vi.fn(),
  reindex: vi.fn(),
}))

// 从 mock 后的模块里取出 spy，方便后续 mockResolvedValue / toHaveBeenCalled
import { getIndexStatus, reindex } from '@/api/scm'

// 类型断言：让 TypeScript 知道这是一个 vi.Mock，从而有 mockResolvedValue 等方法
const mockGetIndexStatus = getIndexStatus as ReturnType<typeof vi.fn>
const mockReindex = reindex as ReturnType<typeof vi.fn>

// ── 辅助：flush 所有已 resolve 的 Promise 微任务 ───────────────────────────
// React 的状态更新在 Promise 回调里，需要先让微任务队列清空，再检查 DOM。
// act(async () => { await Promise.resolve() }) 是标准写法：
//   - act 包裹：告知 React Testing Library "下面有状态更新，等它完成"
//   - await Promise.resolve()：将控制权交给微任务队列，让所有已 resolve 的 Promise 回调执行
async function flushMicrotasks() {
  await act(async () => {
    // Promise.resolve() 立即 resolve，await 让当前执行流「挂起」，
    // 让其他已排队的微任务（如 mockResolvedValue 的回调、React setState）先跑完
    await Promise.resolve()
  })
}

// ── 辅助工厂函数：创建 IndexStatus 对象 ───────────────────────────────────
// Partial<IndexStatus>：所有字段可选，用于覆写默认值
function makeStatus(overrides: Partial<IndexStatus> = {}): IndexStatus {
  return {
    job_id: 'job-1',
    status: 'cloning',
    progress: { phase: 'cloning', percent: 5 },
    error: null,
    // 展开覆写：overrides 中的字段会覆盖上面的默认值
    ...overrides,
  }
}

// ── 测试套件 ────────────────────────────────────────────────────────────────
describe('IndexingProgress', () => {
  // beforeEach：每个测试前执行的钩子
  beforeEach(() => {
    // useFakeTimers：接管全局计时器（setTimeout/setInterval/clearInterval）
    // 这样测试可以用 advanceTimersByTimeAsync 精确控制时间，不用真实等待
    vi.useFakeTimers()
    // 清空 mock 调用记录，保证各测试独立
    mockGetIndexStatus.mockReset()
    mockReindex.mockReset()
  })

  // afterEach：每个测试后恢复真实计时器
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 测试①：渲染当前 phase 标签 ──────────────────────────────────────────
  it('渲染当前 phase 标签（cloning → 克隆代码）', async () => {
    // mockResolvedValue：让 getIndexStatus 永远返回一个 resolve 的 Promise
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 5 } })
    )

    // render：把组件渲染到 JSDOM
    render(<IndexingProgress projectId="proj-1" />)

    // flush 微任务：等待 fetchStatus() 里的 await getIndexStatus() 完成
    // 以及 React 处理 setStatus 引发的重渲染
    await flushMicrotasks()

    // getAllByText：返回所有匹配元素的数组（「克隆代码」在阶段列表+状态文案区共出现 2 次）
    // toBeInTheDocument：断言至少 1 个在文档中
    const matches = screen.getAllByText('克隆代码')
    // 阶段列表行 + 状态文案区各一个，共 2 处
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0]).toBeInTheDocument()
  })

  // ── 测试②：进度条 percent ───────────────────────────────────────────────
  it('进度条宽度反映 percent', async () => {
    // 返回 building_graph 阶段，percent=30
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'building_graph', progress: { phase: 'building_graph', percent: 30 } })
    )

    render(<IndexingProgress projectId="proj-1" />)

    // flush 微任务等待状态更新
    await flushMicrotasks()

    // getAllByText：building_graph 阶段标签也可能在多处（列表行+文案区）
    const labels = screen.getAllByText('构建调用图')
    expect(labels.length).toBeGreaterThanOrEqual(1)

    // 进度条是 <div style="width: 30%;"> —— JSDOM 会在值后加分号（CSS 序列化规则）
    // 所以用 *="30%" 做子串匹配，兼容 "width: 30%;" 和 "width: 30%"
    const progressBar = document.querySelector('[style*="30%"]')
    // toBeTruthy：断言值为真（存在）
    expect(progressBar).toBeTruthy()
  })

  // ── 测试③：done 后停止轮询 ─────────────────────────────────────────────
  it('done 后停止轮询（getIndexStatus 不再被调）', async () => {
    // 第一次返回 cloning，第二次（轮询时）返回 done
    // mockResolvedValueOnce：只对下一次调用生效，之后恢复默认（undefined）
    mockGetIndexStatus
      .mockResolvedValueOnce(makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 5 } }))
      .mockResolvedValueOnce(makeStatus({ status: 'done', progress: null }))

    render(<IndexingProgress projectId="proj-1" />)

    // flush 第一次 fetchStatus（立即触发的那次）
    await flushMicrotasks()

    // 断言第一次加载后显示「克隆代码」（阶段列表+状态文案区各一处，用 getAllByText）
    expect(screen.getAllByText('克隆代码').length).toBeGreaterThanOrEqual(1)

    // advanceTimersByTimeAsync：推进假时间 3000ms（触发第一个 interval）+ flush 微任务
    // 这会触发 interval 回调 → fetchStatus() → getIndexStatus() 返回 done
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    // 此时应显示「索引完成」
    expect(screen.getByText('索引完成')).toBeInTheDocument()

    // 记录 done 后的调用次数（应为 2：初始1次 + interval触发1次）
    const callsAfterDone = mockGetIndexStatus.mock.calls.length

    // 再推进 9000ms（3 个 interval 周期），验证不再轮询
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000)
    })

    // 调用次数不应该增加（interval 在检测到 done 后被 clearInterval）
    expect(mockGetIndexStatus.mock.calls.length).toBe(callsAfterDone)
  })

  // ── 测试④：failed 显示 error ────────────────────────────────────────────
  it('failed 时显示 error 信息', async () => {
    // 模拟 failed 状态，带错误信息
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'failed', progress: null, error: 'git clone 超时' })
    )

    render(<IndexingProgress projectId="proj-1" />)

    // flush 微任务等待状态更新
    await flushMicrotasks()

    // 失败文案包含「索引失败」前缀
    expect(screen.getByText(/索引失败/)).toBeInTheDocument()
    // 具体错误信息也应显示
    expect(screen.getByText(/git clone 超时/)).toBeInTheDocument()
  })

  // ── 测试⑤：点「重新索引」调 reindex ────────────────────────────────────
  it('点「重新索引」调用 reindex(projectId)', async () => {
    // 初始状态：cloning
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 5 } })
    )
    // reindex 返回 resolve（成功），模拟 POST 成功
    mockReindex.mockResolvedValue({ job_id: 'new-job' })

    render(<IndexingProgress projectId="proj-abc" />)

    // flush 初始加载
    await flushMicrotasks()

    // getByRole：按语义角色查找（button = 按钮），name = 按钮文字
    const btn = screen.getByRole('button', { name: '重新索引' })
    // 点击按钮（fireEvent.click 是同步的，React 会处理 onClick）
    fireEvent.click(btn)

    // flush 微任务：等待 handleReindex 里 await reindex() 完成
    await flushMicrotasks()

    // 断言 reindex 被以正确的 projectId 调用
    expect(mockReindex).toHaveBeenCalledWith('proj-abc')
  })

  // ── 测试⑥：重新索引后轮询恢复（C1 修复验证）───────────────────────────────
  // 验证：先把轮询跑到终态（failed）→ 点「重新索引」→ 再推进时间 → 轮询应恢复
  it('⑥重新索引后轮询恢复（C1 fix）', async () => {
    // 阶段一：cloning → failed（两次 getIndexStatus 调用）
    mockGetIndexStatus
      .mockResolvedValueOnce(makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 5 } }))
      .mockResolvedValueOnce(makeStatus({ status: 'failed', progress: null, error: '超时' }))
    // reindex 返回成功
    mockReindex.mockResolvedValue({ job_id: 'new-job' })

    render(<IndexingProgress projectId="proj-reindex" />)

    // flush 初始 fetchStatus（cloning）
    await flushMicrotasks()
    expect(screen.getAllByText('克隆代码').length).toBeGreaterThanOrEqual(1)

    // 推进 3s → 第二次轮询 → failed
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(screen.getByText(/索引失败/)).toBeInTheDocument()

    // 记录此时调用次数（应为 2）
    const callsAtFailed = mockGetIndexStatus.mock.calls.length

    // 推进 9s，确认 failed 后轮询已停（不再调用）
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(mockGetIndexStatus.mock.calls.length).toBe(callsAtFailed)

    // 阶段二：reindex 成功后，配置新的 mock 序列（cloning → building_graph）
    // mockResolvedValueOnce 此时作为下一批调用的返回值
    mockGetIndexStatus
      .mockResolvedValueOnce(makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 1 } }))
      .mockResolvedValueOnce(makeStatus({ status: 'building_graph', progress: { phase: 'building_graph', percent: 20 } }))

    // 点「重新索引」
    const btn = screen.getByRole('button', { name: '重新索引' })
    fireEvent.click(btn)

    // flush 微任务：handleReindex 里 await reindex() + await fetchStatus() + setPollKey 完成
    // 需要多次 flush 确保 React 批量更新和 pollKey effect 都稳定
    await flushMicrotasks()
    await flushMicrotasks()

    // getIndexStatus 应该已经多于 callsAtFailed（重置后立即拉一次）
    expect(mockGetIndexStatus.mock.calls.length).toBeGreaterThan(callsAtFailed)

    // 推进 3s，触发新 interval 的第一次轮询（building_graph）
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })

    // 新轮询应当生效，getIndexStatus 被再次调用
    expect(mockGetIndexStatus.mock.calls.length).toBeGreaterThan(callsAtFailed + 1)
  })

  // ── 测试⑦：卸载清 interval（避免内存泄漏）─────────────────────────────────
  // 验证：unmount 后推进时间，getIndexStatus 不应再被调用
  it('⑦卸载后不再轮询（cleanup 清 interval）', async () => {
    // 持续返回 cloning（非终态），使 interval 不会因终态而 clearInterval
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'cloning', progress: { phase: 'cloning', percent: 5 } })
    )

    // render 并拿到 unmount 函数（render 的返回值里有 unmount）
    const { unmount } = render(<IndexingProgress projectId="proj-unmount" />)

    // flush 初始加载
    await flushMicrotasks()

    // 记录 unmount 前的调用次数
    const callsBeforeUnmount = mockGetIndexStatus.mock.calls.length
    // 调用次数至少 1（初始 fetchStatus）
    expect(callsBeforeUnmount).toBeGreaterThanOrEqual(1)

    // 卸载组件：触发 useEffect cleanup → clearInterval
    unmount()

    // 推进 9s（3 个 interval 周期），若 cleanup 正确，getIndexStatus 不应再被调
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })

    // 断言：卸载后调用次数不增加
    expect(mockGetIndexStatus.mock.calls.length).toBe(callsBeforeUnmount)
  })

  // ── 测试⑥（原）：queued 时显示「排队中」 ─────────────────────────────────
  it('queued 时显示「排队中」', async () => {
    mockGetIndexStatus.mockResolvedValue(
      makeStatus({ status: 'queued', progress: null })
    )

    render(<IndexingProgress projectId="proj-1" />)

    // flush 微任务
    await flushMicrotasks()

    // queued 不在 PHASE_ORDER 里，currentPhaseIndex = -1，没有 isCurrent/isDone
    // PHASE_LABELS['queued'] = '排队中' 显示在状态文案区
    expect(screen.getByText('排队中')).toBeInTheDocument()
  })
})
