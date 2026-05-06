import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectStatusBadge } from './ProjectStatusBadge'

describe('ProjectStatusBadge', () => {
  it('ready: 显示就绪 + 💚', () => {
    render(<ProjectStatusBadge status="ready" />)
    expect(screen.getByText(/💚.*就绪/)).toBeInTheDocument()
  })

  it('indexing 不带 progress: 不显示百分比', () => {
    render(<ProjectStatusBadge status="indexing" />)
    expect(screen.getByText(/🟡 索引中$/)).toBeInTheDocument()
  })

  it('indexing 带 progress=45: 显示 "进度 45%"', () => {
    render(<ProjectStatusBadge status="indexing" progress={45} />)
    expect(screen.getByText(/进度 45%/)).toBeInTheDocument()
  })

  it('partial: 🟠 部分就绪', () => {
    render(<ProjectStatusBadge status="partial" />)
    expect(screen.getByText(/🟠.*部分就绪/)).toBeInTheDocument()
  })

  it('failed: 🔴 索引失败', () => {
    render(<ProjectStatusBadge status="failed" />)
    expect(screen.getByText(/🔴.*索引失败/)).toBeInTheDocument()
  })
})
