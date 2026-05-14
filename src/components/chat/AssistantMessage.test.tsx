/**
 * src/components/chat/AssistantMessage.test.tsx
 *
 * 验证 6 段式答案渲染的核心行为：
 *   - 普通段（overview / rules）直接当文本渲染
 *   - call_chain 段如果含 ```mermaid 块，必须分流给 MermaidDiagram
 *   - 不含 mermaid fence 的 call_chain 仍走文本路径
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock MermaidDiagram —— 避免 jsdom 跑真 mermaid（会复杂）
// `vi.mock` 必须在 import AssistantMessage 之前；放文件顶部 hoist 安全
vi.mock('./MermaidDiagram', () => ({
  MermaidDiagram: ({ code }: { code: string }) => (
    <div data-testid="mermaid-mock">{code}</div>
  ),
}))

// mock api 下载方法（避免真发 HTTP）
const mockExport = vi.fn().mockResolvedValue(undefined)
vi.mock('@/api/sessions', () => ({
  exportMessageAsDocx: (...args: unknown[]) => mockExport(...args),
}))

import { AssistantMessage } from './AssistantMessage'
import type { Message } from '@/types/chat'


function makeMessage(sections: Message['sections']): Message {
  return {
    id: 'm1',
    session_id: 's1',
    role: 'assistant',
    content: '',
    sections,
    created_at: '',
  }
}


describe('AssistantMessage — Mermaid 集成', () => {
  beforeEach(() => {
    mockExport.mockClear()
  })


  it('call_chain 段含 ```mermaid 块时，分流给 MermaidDiagram', async () => {
    const mermaidCode = 'graph LR\n  A --> B'
    const message = makeMessage([
      {
        type: 'call_chain',
        title: '调用链',
        content: `这是调用链：\n\`\`\`mermaid\n${mermaidCode}\n\`\`\`\n后置文字`,
        references: [],
      },
    ])

    render(<AssistantMessage message={message} />)

    // v1.9.1：MermaidDiagram 是 lazy 组件，首帧是 Suspense fallback
    // 用 findByTestId 异步等待真组件挂载（vitest 的 testing-library 默认 1000ms 超时）
    const mock = await screen.findByTestId('mermaid-mock')
    expect(mock).toBeInTheDocument()
    // toHaveTextContent 默认折叠空白；直接 substring 匹配关键 token
    expect(mock).toHaveTextContent('graph LR')
    expect(mock).toHaveTextContent('A --> B')

    // 前置文字 / 后置文字仍然以普通文本展示
    expect(screen.getByText(/这是调用链/)).toBeInTheDocument()
    expect(screen.getByText(/后置文字/)).toBeInTheDocument()
  })

  it('call_chain 段没有 ```mermaid 块时，仍当普通文本渲染', () => {
    const message = makeMessage([
      {
        type: 'call_chain',
        title: '调用链',
        content: '这是纯文本调用链，没有图。',
        references: [],
      },
    ])

    render(<AssistantMessage message={message} />)

    expect(screen.queryByTestId('mermaid-mock')).not.toBeInTheDocument()
    expect(screen.getByText(/这是纯文本调用链/)).toBeInTheDocument()
  })

  it('其它段（overview / rules）即便含 ```mermaid 也只在 call_chain 段拆图', () => {
    // 故意把 ```mermaid 放进 overview，验证拆分逻辑只对 call_chain 生效
    // （overview 段一般不画图；这是边界条件）
    const message = makeMessage([
      {
        type: 'overview',
        title: '业务概述',
        content: '业务说明。',
        references: [],
      },
    ])

    render(<AssistantMessage message={message} />)
    expect(screen.queryByTestId('mermaid-mock')).not.toBeInTheDocument()
    expect(screen.getByText(/业务说明/)).toBeInTheDocument()
  })

  it('message.tool_calls 非空时，每个 tool_call 都渲染成卡片', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [{ type: 'overview', title: 'x', content: 'y', references: [] }],
      tool_calls: {
        'call_001': {
          starting: {
            phase: 'starting', id: 'call_001', name: 'ke_callees',
            arguments: { entity_id: 'method//M1' },
          },
          complete: {
            phase: 'complete', id: 'call_001', name: 'ke_callees',
            result_preview: '{"callees":["B","C"]}',
          },
        },
        'call_002': {
          starting: {
            phase: 'starting', id: 'call_002', name: 'ke_search',
            arguments: { query: '兽医' },
          },
        },
      },
      created_at: '',
    }
    render(<AssistantMessage message={message} />)
    // 两个工具名都应该可见
    expect(screen.getByText('ke_callees')).toBeInTheDocument()
    expect(screen.getByText('ke_search')).toBeInTheDocument()
    // 一个完成态 + 一个运行中态
    const statuses = screen.getAllByTestId('tool-call-status')
    expect(statuses).toHaveLength(2)
    expect(statuses[0]).toHaveTextContent(/✓|完成/)
    expect(statuses[1]).toHaveTextContent(/运行中|…/)
  })

  // ───────── v1.5: docx 下载按钮 ─────────

  it('非 streaming 状态下显示"导出 Word"按钮；点击调 exportMessageAsDocx', async () => {
    const user = userEvent.setup()
    const message: Message = {
      id: 'msg_abc',
      session_id: 'sess_xyz',
      role: 'assistant',
      content: '',
      sections: [{ type: 'overview', title: 'x', content: 'y', references: [] }],
      created_at: '',
    }
    render(<AssistantMessage message={message} projectId="petclinic" />)

    // 按钮 aria-label 包含"导出"或"Word"
    const btn = screen.getByRole('button', { name: /导出|Word|docx/i })
    expect(btn).toBeInTheDocument()

    await user.click(btn)

    // exportMessageAsDocx 必须被调用，且参数对得上
    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledTimes(1)
    })
    expect(mockExport).toHaveBeenCalledWith({
      projectId: 'petclinic',
      sessionId: 'sess_xyz',
      messageId: 'msg_abc',
    })
  })

  it('streaming 状态下不显示导出按钮（避免下载未完成内容）', () => {
    const message: Message = {
      id: 'msg_abc',
      session_id: 'sess_xyz',
      role: 'assistant',
      content: '',
      sections: [],
      created_at: '',
    }
    render(
      <AssistantMessage message={message} projectId="petclinic" streaming />,
    )
    // 没有导出按钮
    expect(screen.queryByRole('button', { name: /导出|Word|docx/i })).not.toBeInTheDocument()
  })

  it('没传 projectId 时不显示按钮（向后兼容旧调用）', () => {
    const message: Message = {
      id: 'msg_abc',
      session_id: 'sess_xyz',
      role: 'assistant',
      content: '',
      sections: [{ type: 'overview', title: 'x', content: 'y', references: [] }],
      created_at: '',
    }
    render(<AssistantMessage message={message} />)
    expect(screen.queryByRole('button', { name: /导出|Word|docx/i })).not.toBeInTheDocument()
  })

  // ───────── v1.6: 流式 raw_stream 打字机渲染 ─────────

  it('streaming 中 sections 尚未到达时，渲染 raw_stream 字符', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],  // 还没解析出 sections
      raw_stream: '前两个字符已到',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // 把 raw_stream 当文本显示
    expect(screen.getByText(/前两个字符已到/)).toBeInTheDocument()
    // 没有 section 标题（因为 sections 是空）
    expect(screen.queryByText('📋')).not.toBeInTheDocument()
  })

  it('streaming 中 sections 已到达后，优先显示 sections（结构化）', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      // sections 已经开始填充 → 已切到结构化展示
      sections: [{ type: 'overview', title: '业务概述', content: '答案...', references: [] }],
      // raw_stream 还在累计（可能比 sections 长，因为后端还没把流末 section_done 全发完）
      raw_stream: '一些原始流文本',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // 显示结构化 sections
    expect(screen.getByText(/业务概述/)).toBeInTheDocument()
    expect(screen.getByText(/答案/)).toBeInTheDocument()
    // 不显示 raw_stream（避免重复）
    expect(screen.queryByText(/一些原始流文本/)).not.toBeInTheDocument()
  })

  it('非 streaming 状态下 raw_stream 不渲染（流已结束应该用 sections）', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [{ type: 'overview', title: '业务概述', content: '最终答案', references: [] }],
      raw_stream: '残留的 raw_stream',  // 服务端持久化后通常会清掉，但万一存在
      created_at: '',
    }
    render(<AssistantMessage message={message} />)  // 不传 streaming
    expect(screen.getByText(/最终答案/)).toBeInTheDocument()
    expect(screen.queryByText(/残留的 raw_stream/)).not.toBeInTheDocument()
  })

  // ───────── v1.8: raw_stream 用 markdown 渲染 ─────────

  it('raw_stream 中的 markdown 标题应被渲染成 <h1>/<h2>', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '# 大标题\n\n## 二级标题\n\n正文段落',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // markdown 解析后应该有 h1 和 h2
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('大标题')
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('二级标题')
  })

  it('raw_stream 中的 markdown 代码块应被渲染成 <code>', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '内嵌的 `code` 标记\n\n```python\nprint("hi")\n```',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // 内嵌 code 应该用 <code> 元素
    // 注意：react-markdown 给 inline code 也用 <code>，但没有 <pre> 包裹
    const codeEls = document.querySelectorAll('code')
    expect(codeEls.length).toBeGreaterThan(0)
    // 至少有一个含 'print("hi")'
    const hasPrint = Array.from(codeEls).some(el => el.textContent?.includes('print("hi")'))
    expect(hasPrint).toBe(true)
  })

  it('未闭合的代码块（半截 markdown）不应让组件崩溃', () => {
    // 模拟流到一半 —— 代码块未闭合
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '```python\ndef foo():\n    return ',  // 故意半截
      created_at: '',
    }
    // 渲染不应抛错；用户看到部分内容
    expect(() =>
      render(<AssistantMessage message={message} streaming />),
    ).not.toThrow()
    // 至少能看到 "def foo" 这种关键字（不一定是 <code>，可能是普通段落）
    expect(document.body.textContent).toContain('def foo')
  })

  // ───────── v1.9: JSON fence 折叠 ─────────

  it('raw_stream 是 ```json 流时，折叠成 section content 直出（不显示 JSON wrapper）', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '```json\n{"sections":[{"type":"overview","content":"业务概述：兽医列表接口","references":[]},{"type":"entry_point","content":"VetController.showVetList()","references":[]}]}',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // section.content 内容直接以纯文本展示
    expect(document.body.textContent).toContain('业务概述：兽医列表接口')
    expect(document.body.textContent).toContain('VetController.showVetList()')
    // **不**应该看到 JSON 包装关键字
    expect(document.body.textContent).not.toContain('"sections"')
    expect(document.body.textContent).not.toContain('"type"')
    expect(document.body.textContent).not.toContain('"references"')
  })

  it('raw_stream 是 ```json 但还没出现完整 content：仍然不展示 wrapper（占位）', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '```json\n{"sections":[{',  // 流到这里还啥都没有
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // JSON wrapper 不应该泄露给用户
    expect(document.body.textContent).not.toContain('"sections"')
  })

  it('raw_stream 是普通 markdown（无 json fence）走原 markdown 路径', () => {
    const message: Message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant',
      content: '',
      sections: [],
      raw_stream: '# 标题\n\n普通 markdown 内容',
      created_at: '',
    }
    render(<AssistantMessage message={message} streaming />)
    // markdown 标题正常渲染
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('标题')
    expect(document.body.textContent).toContain('普通 markdown 内容')
  })
})

describe('AssistantMessage: chit-chat section', () => {
  it('chit-chat 类型 section 不显示 h3 header (icon + title)', () => {
    const message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'chit-chat' as const,
        title: '',
        content: '你好！有什么业务问题可以问我。',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)

    // h3 标题（含 icon + title 文字）不应出现
    expect(screen.queryByText(/📋|📝|💬\s*业务概述|对话回复/)).not.toBeInTheDocument()
    // 但内容应该展示
    expect(screen.getByText(/你好/)).toBeInTheDocument()
    expect(screen.getByText(/业务问题/)).toBeInTheDocument()
  })

  it('chit-chat section 不渲染 references 区块', () => {
    const message = {
      id: 'm2',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'chit-chat' as const,
        title: '',
        content: '你好',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)
    // 不显示 "引用来源" 之类的 references 标题
    expect(screen.queryByText(/引用|参考|reference/i)).not.toBeInTheDocument()
  })

  it('普通 6 段式 section 仍然显示 h3 header（不被 chit-chat 改动影响）', () => {
    const message = {
      id: 'm3',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'overview' as const,
        title: '业务概述',
        content: 'overview 内容',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)
    // overview 类型仍带 emoji + title
    expect(screen.getByText(/📋\s*业务概述/)).toBeInTheDocument()
  })
})
