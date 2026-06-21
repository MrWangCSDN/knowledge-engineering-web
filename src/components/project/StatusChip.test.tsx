import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('ready 显示"就绪" + 绿色 token', () => {
    render(<StatusChip status="ready" />)
    const el = screen.getByText('就绪')
    expect(el.className).toContain('text-green-700')
    expect(el.className).toContain('dark:text-green-400')
  })

  it('indexing 显示"索引中"（不显示 0%）', () => {
    render(<StatusChip status="indexing" progress={0} />)
    expect(screen.getByText('索引中')).not.toBeNull()
  })

  it('partial 带 progress 显示"解读 70%"', () => {
    render(<StatusChip status="partial" progress={70} />)
    expect(screen.getByText('解读 70%')).not.toBeNull()
  })

  it('failed 显示"失败" + 红色 token', () => {
    render(<StatusChip status="failed" />)
    const el = screen.getByText('失败')
    expect(el.className).toContain('text-red-700')
  })

  it('partial 无 progress 显示默认"部分"', () => {
    render(<StatusChip status="partial" />)
    expect(screen.getByText('部分')).not.toBeNull()
  })
})
