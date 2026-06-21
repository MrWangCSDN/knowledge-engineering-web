import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CurrentProjectStatus } from './CurrentProjectStatus'
import type { Project } from '@/types/project'

const mk = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'mall-swarm', status: 'indexing',
  stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  pipeline_at: null, ...over,
})

describe('CurrentProjectStatus', () => {
  it('flag 关 → 渲染 null（无徽章）', () => {
    const { container } = render(<CurrentProjectStatus project={mk()} enabled={false} />)
    expect(container.textContent).toBe('')
  })

  it('flag 开 + ready → 渲染 null（无噪声）', () => {
    const { container } = render(<CurrentProjectStatus project={mk({ status: 'ready' })} enabled />)
    expect(container.textContent).toBe('')
  })

  it('flag 开 + indexing → 出徽章"索引中"', () => {
    render(<CurrentProjectStatus project={mk({ status: 'indexing' })} enabled />)
    expect(screen.getByText('索引中')).not.toBeNull()
  })

  it('project 为 undefined → null', () => {
    const { container } = render(<CurrentProjectStatus project={undefined} enabled />)
    expect(container.textContent).toBe('')
  })

  it('flag 开 + partial → 出徽章"解读 0%"', () => {
    render(<CurrentProjectStatus project={mk({ status: 'partial' })} enabled />)
    expect(screen.getByText('解读 0%')).not.toBeNull()
  })

  it('flag 开 + failed → 出徽章"失败"', () => {
    render(<CurrentProjectStatus project={mk({ status: 'failed' })} enabled />)
    expect(screen.getByText('失败')).not.toBeNull()
  })
})
