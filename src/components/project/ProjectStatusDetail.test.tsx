import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectStatusDetail } from './ProjectStatusDetail'
import type { Project } from '@/types/project'

const mk = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'mall-swarm', status: 'indexing',
  stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
  pipeline_at: null, ...over,
})

describe('ProjectStatusDetail', () => {
  it('indexing：说明索引中 + 暂不可提问', () => {
    render(<ProjectStatusDetail project={mk({ status: 'indexing' })} />)
    expect(screen.getByText(/暂不可提问/)).not.toBeNull()
  })

  it('indexing 带 eta：显示约 X 分钟', () => {
    render(<ProjectStatusDetail project={mk({
      status: 'indexing',
      indexing_progress: { phase: 'embedding', percent: 45, eta_seconds: 360 },
    })} />)
    expect(screen.getByText(/约 6 分钟/)).not.toBeNull()
  })

  it('indexing eta=0：不显示分钟', () => {
    render(<ProjectStatusDetail project={mk({
      status: 'indexing',
      indexing_progress: { phase: 'parsing', percent: 0, eta_seconds: 0 },
    })} />)
    expect(screen.queryByText(/分钟/)).toBeNull()
  })

  it('indexing eta 负数：不显示分钟', () => {
    render(<ProjectStatusDetail project={mk({
      status: 'indexing',
      indexing_progress: { phase: 'parsing', percent: 0, eta_seconds: -60 },
    })} />)
    expect(screen.queryByText(/分钟/)).toBeNull()
  })

  it('indexing：显示索引进度 percent（非 interpretation_progress）', () => {
    render(<ProjectStatusDetail project={mk({
      status: 'indexing',
      stats: { methods_count: 0, classes_count: 0, interpretation_progress: 70 },
      indexing_progress: { phase: 'embedding', percent: 10, eta_seconds: 0 },
    })} />)
    expect(screen.getByText(/进度 10%/)).not.toBeNull()
    expect(screen.queryByText(/70%/)).toBeNull()
  })

  it('partial：可回答但可能不完整', () => {
    render(<ProjectStatusDetail project={mk({
      status: 'partial',
      stats: { methods_count: 100, classes_count: 20, interpretation_progress: 70 },
    })} />)
    expect(screen.getByText(/可能不完整/)).not.toBeNull()
    expect(screen.getByText(/70%/)).not.toBeNull()
  })

  it('failed：联系管理员', () => {
    render(<ProjectStatusDetail project={mk({ status: 'failed' })} />)
    expect(screen.getByText(/联系管理员/)).not.toBeNull()
  })
})
