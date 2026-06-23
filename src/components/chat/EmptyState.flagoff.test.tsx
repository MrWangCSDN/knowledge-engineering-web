/**
 * EmptyState flag-off 零影响测试。
 *
 * 守护"flag 关 = 零影响现状"安全契约：
 *   isProjectStatusEnabled 恒 false 时，所有 gating/partial 警示逻辑全部跳过，
 *   组件行为等于 flag 未引入前的现状（只保留措辞修复）。
 *
 * 注：isProjectStatusEnabled 是静态 import，无法在同文件双值 mock，
 *     故独立建文件、vi.mock 在本文件中恒为 false。
 *     EmptyState 现用 <Link>（连接更多仓库），渲染需 MemoryRouter 包裹。
 *     flag 关时 IndexingProgress 不渲染（flagOn=false），无需 stub。
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from './EmptyState'
import type { Project } from '@/types/project'

// flag 强制为关：验证 gating 等"开"路径行为全部消失
vi.mock('@/config/features', () => ({ isProjectStatusEnabled: () => false }))

// 工厂：构造一个最小 Project，over 覆盖需要变化的字段
const mk = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'mall-swarm',
  status: 'ready',
  stats: { methods_count: 42, classes_count: 10, interpretation_progress: 0 },
  pipeline_at: null,
  ...over,
})

// EmptyState 现用 <Link>，需要 Router 上下文；统一用 MemoryRouter 包裹渲染
const renderES = (project: Project) =>
  render(
    <MemoryRouter>
      <EmptyState project={project} onSend={() => {}} />
    </MemoryRouter>,
  )

describe('EmptyState flag 关 = 零影响现状', () => {
  it('indexing 工程：欢迎语仍"准备好了"、无"暂未就绪"、输入不被 status 禁用', () => {
    renderES(mk({ status: 'indexing' }))
    // flag 关 → gated 永远 false → 欢迎语走常态分支
    expect(screen.getByText('准备好了，随时问我')).not.toBeNull()
    // 不出现 gated 提示
    expect(screen.queryByText(/暂未就绪/)).toBeNull()
    // 输入框不走 gatedPlaceholder（正在索引）
    expect(screen.queryByPlaceholderText(/正在索引/)).toBeNull()
  })

  it('partial 工程：不显示失真警示（flagOn=false 跳过 partial 分支）', () => {
    renderES(
      mk({
        status: 'partial',
        stats: { methods_count: 42, classes_count: 10, interpretation_progress: 60 },
      }),
    )
    // flag 关 → flagOn=false → partial 警示块不渲染
    expect(screen.queryByText(/解读.*%/)).toBeNull()
    // 欢迎语仍为常态
    expect(screen.getByText('准备好了，随时问我')).not.toBeNull()
  })

  it('ready 工程：措辞修复仍生效（无"正在分析"）', () => {
    renderES(mk({ status: 'ready' }))
    // 措辞修复与 flag 无关，flag 关时依然生效
    expect(screen.queryByText(/正在分析/)).toBeNull()
    expect(screen.getByText('准备好了，随时问我')).not.toBeNull()
  })
})
