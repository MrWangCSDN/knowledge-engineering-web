import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentHeader } from './RecentHeader'
import { useSidebarStore } from '@/store/sidebar'

describe('RecentHeader', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('渲染「最近」文案', () => {
    render(<RecentHeader />)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('展开状态下显示 ChevronDown', () => {
    render(<RecentHeader />)
    expect(screen.getByTestId('recent-chevron-down')).toBeInTheDocument()
  })

  it('折叠状态下显示 ChevronRight', () => {
    useSidebarStore.setState({ recentExpanded: false, projectExpanded: {} })
    render(<RecentHeader />)
    expect(screen.getByTestId('recent-chevron-right')).toBeInTheDocument()
  })

  it('点击切换 recentExpanded', () => {
    render(<RecentHeader />)
    const btn = screen.getByRole('button', { name: /最近/ })
    // 初始 aria-expanded=true（默认展开）
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(btn)
    expect(useSidebarStore.getState().recentExpanded).toBe(false)
    // 点击后 aria-expanded=false
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })
})
