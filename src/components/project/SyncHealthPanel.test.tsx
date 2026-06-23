/**
 * src/components/project/SyncHealthPanel.test.tsx
 *
 * SyncHealthPanel 单元测试。
 *
 * fake timers 陷阱：
 *   waitFor 内部用真实 setTimeout 轮询断言，在 vi.useFakeTimers() 下永远不触发。
 *   解决方案：不用 waitFor，改用 flushMicrotasks()（act + await Promise.resolve()）
 *   flush 微任务后直接同步断言（screen.getByText）。
 */

// render：将组件渲染到 JSDOM；screen：DOM 查询；fireEvent：模拟交互；act：包裹状态更新
import { render, screen, fireEvent, act } from '@testing-library/react'
// Vitest 测试 API
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock @/api/scm ──────────────────────────────────────────────────────────
// vi.mock 必须在 import 之前（vitest 会提升到文件顶部执行）
vi.mock('@/api/scm', () => ({
  getSyncHealth: vi.fn(),
  reindex: vi.fn(),
}))

// 导入 mock 后的函数（已被 vi.fn() 替换）
import { getSyncHealth, reindex } from '@/api/scm'
import type { SyncHealth } from '@/types/scm'
import { SyncHealthPanel } from './SyncHealthPanel'

// 类型断言：让 TS 知道这是 vi.Mock，从而有 mockResolvedValue 等方法
const mockGetSyncHealth = getSyncHealth as ReturnType<typeof vi.fn>
const mockReindex = reindex as ReturnType<typeof vi.fn>

// ── 辅助：flush 所有已 resolve 的 Promise 微任务 ───────────────────────────
// fake timers 下 waitFor 无法工作（内部用真实 setTimeout），改用此方式：
//   act 包裹让 React 知道有状态更新；await Promise.resolve() 让微任务队列清空
async function flushMicrotasks() {
  await act(async () => {
    // 将执行权交还微任务队列，让所有已 resolve 的 Promise 回调（含 mockResolvedValue）先执行
    await Promise.resolve()
  })
}

// ── 测试数据工厂 ─────────────────────────────────────────────────────────────
/**
 * 构造 SyncHealth 测试数据，提供默认值，Partial<SyncHealth> 允许覆盖任意字段。
 */
function makeHealth(overrides: Partial<SyncHealth> = {}): SyncHealth {
  return {
    project_id: 'proj-1',
    status: 'ready',
    last_synced_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 分钟前
    last_synced_commit: 'abc1234def567890',
    staleness_hours: 1,
    is_stuck: false,
    latest_job: null,
    job_counts: { queued: 0, running: 0, failed: 0 },
    last_error: null,
    // 展开语法：overrides 中的字段覆盖默认值
    ...overrides,
  }
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────
describe('SyncHealthPanel', () => {
  // beforeEach：每个 case 开始前启用 fake timers
  // vi.useFakeTimers() 接管 Date / setTimeout / setInterval / clearInterval
  beforeEach(() => {
    vi.useFakeTimers()
  })

  // afterEach：每个 case 结束后恢复真实 timers 并清 mock 调用记录
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── Case ①: ready 形态渲染 ────────────────────────────────────────────────
  it('ready 形态：显示上次同步时间、短 sha、绿色状态文案、job_counts', async () => {
    // mockResolvedValue：让 getSyncHealth 的每次调用都返回已 resolve 的 Promise
    mockGetSyncHealth.mockResolvedValue(makeHealth())

    // act + render：包裹初始渲染（可能触发 useEffect 里的异步操作）
    await act(async () => {
      render(<SyncHealthPanel projectId="proj-1" />)
    })

    // flush：让 fetchHealth 的 Promise 回调（setHealth）执行完毕
    await flushMicrotasks()

    // 验证「上次同步」相对时间（12 分钟前）
    expect(screen.getByText('12 分钟前')).toBeInTheDocument()

    // 验证短 sha（前 7 位）
    expect(screen.getByText('abc1234')).toBeInTheDocument()

    // 验证状态文案
    expect(screen.getByText('就绪')).toBeInTheDocument()

    // 验证 job_counts 标签存在（排队/运行/失败）
    expect(screen.getByText(/排队/)).toBeInTheDocument()
    expect(screen.getByText(/运行/)).toBeInTheDocument()
    expect(screen.getByText(/失败/)).toBeInTheDocument()
  })

  // ── Case ②: is_stuck=true 显示卡死警告 ────────────────────────────────────
  it('is_stuck=true 时显示卡死警告徽标', async () => {
    mockGetSyncHealth.mockResolvedValue(
      makeHealth({ is_stuck: true, status: 'indexing' })
    )

    await act(async () => {
      render(<SyncHealthPanel projectId="proj-1" />)
    })

    // flush 让 setHealth 生效
    await flushMicrotasks()

    // 验证「作业卡死」警告文案至少出现一次（徽标 + 可能的诊断行）
    expect(screen.getAllByText('作业卡死，已自动重排').length).toBeGreaterThanOrEqual(1)
  })

  // ── Case ③: failed + last_error 显示红字 ──────────────────────────────────
  it('failed 状态 + last_error 时显示状态文案和错误信息', async () => {
    mockGetSyncHealth.mockResolvedValue(
      makeHealth({
        status: 'failed',
        last_error: '克隆代码超时：git clone 失败',
        job_counts: { queued: 0, running: 0, failed: 2 },
      })
    )

    await act(async () => {
      render(<SyncHealthPanel projectId="proj-1" />)
    })

    await flushMicrotasks()

    // 验证状态文案（使用 getAllByText 因为「失败」文字也出现在 job_counts 标签里）
    // getAllByText 返回所有匹配元素，至少有 1 个即可
    expect(screen.getAllByText('失败').length).toBeGreaterThanOrEqual(1)

    // 验证 last_error 内容显示（精确匹配，唯一文案）
    expect(screen.getByText('克隆代码超时：git clone 失败')).toBeInTheDocument()

    // 验证失败数 2 出现在页面
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // ── Case ④: 点「重新索引」调 reindex ──────────────────────────────────────
  it('点「重新索引」按钮调用 reindex(projectId)', async () => {
    mockGetSyncHealth.mockResolvedValue(makeHealth())
    // mockResolvedValue：reindex 成功返回 job_id
    mockReindex.mockResolvedValue({ job_id: 'job-xyz' })

    await act(async () => {
      render(<SyncHealthPanel projectId="proj-1" />)
    })

    await flushMicrotasks()

    // 验证按钮已渲染
    const btn = screen.getByText('重新索引')
    expect(btn).toBeInTheDocument()

    // 点击「重新索引」并 flush 异步回调
    await act(async () => {
      fireEvent.click(btn)
      // flush：让 handleReindex 里的 await reindex(...) 和 await fetchHealth() 完成
      await Promise.resolve()
      await Promise.resolve()
    })

    // 验证 reindex 被调用，参数正确
    expect(mockReindex).toHaveBeenCalledWith('proj-1')
    // 验证没有重复提交
    expect(mockReindex).toHaveBeenCalledTimes(1)
  })

  // ── Case ⑤: 卸载后推进时间，getSyncHealth 不再被调（clearInterval） ────────
  it('卸载后推进时间 getSyncHealth 不再被调', async () => {
    mockGetSyncHealth.mockResolvedValue(makeHealth())

    let unmount!: () => void

    await act(async () => {
      const result = render(<SyncHealthPanel projectId="proj-1" />)
      unmount = result.unmount
    })

    // flush：让初始 fetchHealth 完成
    await flushMicrotasks()

    // 此时 getSyncHealth 至少被调用 1 次（初始拉取）
    expect(mockGetSyncHealth).toHaveBeenCalledTimes(1)

    // 卸载组件（触发 useEffect cleanup → clearInterval）
    await act(async () => {
      unmount()
    })

    // 记录卸载时的调用次数
    const callsAfterUnmount = mockGetSyncHealth.mock.calls.length

    // 推进假时间 20s（覆盖 5s interval 的多个触发点）
    // advanceTimersByTimeAsync：fake timers 推进指定毫秒，flush 期间触发的所有 timer 回调
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })

    // clearInterval 已生效：推进时间后调用次数应保持不变
    expect(mockGetSyncHealth.mock.calls.length).toBe(callsAfterUnmount)
  })
})
