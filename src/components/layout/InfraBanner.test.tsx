/**
 * InfraBanner 渲染测试。
 * 设计：[[基础设施健康检查与产品不可用-设计]] §4.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useInfraStore } from '@/store/infra'
import { InfraBanner } from './InfraBanner'

describe('<InfraBanner>', () => {
  beforeEach(() => {
    useInfraStore.setState({
      healthy: true,
      deps: undefined,
      lastCheck: null,
      fetching: false,
    })
  })

  it('healthy=true → 不渲染（return null）', () => {
    const { container } = render(<InfraBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('healthy=false → 显示横幅 + 文案', () => {
    useInfraStore.setState({ healthy: false, lastCheck: Date.now() })
    render(<InfraBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/系统暂时不可用/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重试连接/ })).toBeInTheDocument()
  })

  it('点击重试按钮 → 调 fetchHealth', () => {
    const fetchHealthSpy = vi.fn(() => Promise.resolve())
    useInfraStore.setState({
      healthy: false,
      lastCheck: Date.now(),
      fetching: false,
      fetchHealth: fetchHealthSpy,
    })
    render(<InfraBanner />)
    fireEvent.click(screen.getByRole('button', { name: /重试连接/ }))
    expect(fetchHealthSpy).toHaveBeenCalledOnce()
  })

  it('fetching=true → 按钮 disabled + 文字"检查中…"', () => {
    useInfraStore.setState({ healthy: false, lastCheck: Date.now(), fetching: true })
    render(<InfraBanner />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/检查中/)
  })
})
