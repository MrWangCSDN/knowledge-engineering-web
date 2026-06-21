/**
 * EmptyState 状态派生测试。
 *
 * 覆盖 T7 的两件事：
 *   1. 措辞修复 —— ready 工程不再无条件出现"正在分析"
 *   2. gating —— indexing 工程欢迎语变"暂未就绪" + 输入框禁用 + 占位文案
 *
 * 注：mock isProjectStatusEnabled 恒为 true，以验证 flag 开时的行为。
 *     infra store 默认 healthy=true（store 初值），ChatInput 不会覆盖 placeholder。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EmptyState } from './EmptyState'
import type { Project } from '@/types/project'

// flag 强制为开：验证 gating / partial 警示等"开"路径行为
vi.mock('@/config/features', () => ({ isProjectStatusEnabled: () => true }))

// 工厂：构造一个最小 Project，over 覆盖需要变化的字段
const mk = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'mall-swarm',
  status: 'ready',
  stats: { methods_count: 42, classes_count: 10, interpretation_progress: 100 },
  pipeline_at: null,
  ...over,
})

describe('EmptyState 状态派生', () => {
  it('ready：不再无条件出现"正在分析"', () => {
    render(<EmptyState project={mk({ status: 'ready' })} onSend={() => {}} />)
    expect(screen.queryByText(/正在分析/)).toBeNull()
    expect(screen.getByText('准备好了，随时问我')).not.toBeNull()
  })

  it('indexing：欢迎语变"暂未就绪" + 输入禁用占位', () => {
    render(<EmptyState project={mk({ status: 'indexing' })} onSend={() => {}} />)
    expect(screen.getByText(/暂未就绪/)).not.toBeNull()
    expect(screen.getByPlaceholderText(/正在索引/)).not.toBeNull()
  })

  it('partial：可提问（非 gated）+ 显示失真警示', () => {
    render(
      <EmptyState
        project={mk({
          status: 'partial',
          stats: { methods_count: 42, classes_count: 10, interpretation_progress: 60 },
        })}
        onSend={() => {}}
      />,
    )
    // partial 不 gated → 欢迎语仍为常态
    expect(screen.getByText('准备好了，随时问我')).not.toBeNull()
    // 失真警示出现，含进度百分比
    expect(screen.getByText(/解读 60%（进行中，回答可能不完整）/)).not.toBeNull()
  })
})
