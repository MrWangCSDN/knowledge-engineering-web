import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card'

describe('HoverCard 封装', () => {
  it('trigger 始终渲染，content 默认隐藏（open=false）', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>悬停我</HoverCardTrigger>
        <HoverCardContent>详情</HoverCardContent>
      </HoverCard>,
    )
    expect(screen.getByText('悬停我')).not.toBeNull()
    expect(screen.queryByText('详情')).toBeNull()
  })

  it('open 受控为 true 时渲染 content', () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>悬停我</HoverCardTrigger>
        <HoverCardContent>详情</HoverCardContent>
      </HoverCard>,
    )
    expect(screen.getByText('详情')).not.toBeNull()
  })
})
