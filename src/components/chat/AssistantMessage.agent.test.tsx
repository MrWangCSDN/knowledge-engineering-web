import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssistantMessage } from './AssistantMessage'
import type { Message } from '@/types/chat'

const base: Omit<Message, 'sections' | 'metadata'> = {
  id: 'm1', session_id: 's1', role: 'assistant', content: '', created_at: '2026-05-26T00:00:00Z',
}

describe('AssistantMessage agent 整合', () => {
  it('单段自由格式：不显示段头（回答 h3），正文 markdown 渲染', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '## 概述\n这是自由格式答案' }],
      metadata: { entry_points: [], cited_entities: [], interpretation_freshness: '', token_usage: 0, latency_ms: 0 },
    }
    render(<AssistantMessage message={msg} />)
    expect(screen.queryByRole('heading', { name: /回答/ })).not.toBeInTheDocument()
    expect(screen.getByText('概述')).toBeInTheDocument()
  })

  it('正文内联 [entity_id|文本] 渲染成 EntityRef（带 引用实体 aria-label，验证 urlTransform 生效）', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '见 [method://com.bank.foo|Foo.bar()]' }],
    }
    render(<AssistantMessage message={msg} />)
    // EntityRef 是带 aria-label="引用实体 ..." 的 button；若 urlTransform 没生效会退化成普通文本/链接，这条会失败
    const ref = screen.getByRole('button', { name: /引用实体 method:\/\/com\.bank\.foo/ })
    expect(ref).toBeInTheDocument()
    expect(ref).toHaveTextContent('Foo.bar()')
  })

  it('底部渲染 cited_entities chips', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '答案' }],
      metadata: { entry_points: [], cited_entities: ['method://com.bank.openAccount'], interpretation_freshness: '', token_usage: 0, latency_ms: 0 },
    }
    render(<AssistantMessage message={msg} />)
    expect(screen.getByText('openAccount')).toBeInTheDocument()  // EntityChip shortLabel
  })

  it('多段结构化答案仍显示段头（回归）', () => {
    const msg: Message = { ...base, sections: [
      { type: 'overview', title: '业务概述', content: 'a' },
      { type: 'entry_point', title: '入口方法', content: 'b' },
    ] }
    render(<AssistantMessage message={msg} />)
    expect(screen.getByRole('heading', { name: /业务概述/ })).toBeInTheDocument()
  })
})
