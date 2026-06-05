import { describe, it, expect } from 'vitest'
import { buildAnswerSegments, stripReactflowFences } from './buildAnswerSegments'

const tc = (over: Record<string, unknown>) => ({ name: 'x', phase: 'complete', ...over })

describe('buildAnswerSegments', () => {
  it('无 render → 单个文本段', () => {
    expect(buildAnswerSegments('你好世界', {})).toEqual([{ kind: 'text', content: '你好世界' }])
  })

  it('一个 render 块按 at 偏移把文本切两段、中间插图', () => {
    const raw = '先看调用关系：后面继续说明。'   // at=7（"先看调用关系："的长度）
    const tcs = { a: tc({ render: { kind: 'call_graph', data: { nodes: [], edges: [] } }, at: 7 }) }
    const segs = buildAnswerSegments(raw, tcs)
    expect(segs[0]).toEqual({ kind: 'text', content: '先看调用关系：' })
    expect(segs[1].kind).toBe('render')
    expect((segs[1] as { data: unknown }).data).toEqual({ nodes: [], edges: [] })
    expect(segs[2]).toEqual({ kind: 'text', content: '后面继续说明。' })
  })

  it('多个 render 按 at 升序插入；空文本段被丢弃', () => {
    const raw = 'AB'
    const tcs = {
      a: tc({ render: { kind: 'call_graph', data: { n: 1 } }, at: 0 }),  // 开头
      b: tc({ render: { kind: 'call_graph', data: { n: 2 } }, at: 2 }),  // 结尾
    }
    const segs = buildAnswerSegments(raw, tcs)
    // 开头 render（at=0，前面无文本，不产空文本段）→ 文本 'AB' → render（at=2）
    expect(segs.map(s => s.kind)).toEqual(['render', 'text', 'render'])
  })

  it('调查类 tool_call（无 render）不进段序列', () => {
    const tcs = { a: tc({ name: 'ke_search', result_preview: '...' }) }
    expect(buildAnswerSegments('正文', tcs)).toEqual([{ kind: 'text', content: '正文' }])
  })

  it('既有工具 render 块时，文本里手画的 ```reactflow 被剥掉（去重）', () => {
    const raw = '说明：\n```reactflow\n{"nodes":[1]}\n```\n结尾'
    const tcs = { a: tc({ render: { kind: 'call_graph', data: { nodes: [] } }, at: raw.length }) }
    const segs = buildAnswerSegments(raw, tcs)
    const textJoined = segs.filter(s => s.kind === 'text').map(s => (s as { content: string }).content).join('')
    expect(textJoined).not.toContain('reactflow')          // 手画块被剥
    expect(segs.some(s => s.kind === 'render')).toBe(true)  // 工具图保留
  })

  it('无工具 render 时，手画 ```reactflow 保留（唯一图来源，不剥）', () => {
    const raw = '说明\n```reactflow\n{"nodes":[]}\n```'
    const segs = buildAnswerSegments(raw, {})              // 无 render
    expect((segs[0] as { content: string }).content).toContain('reactflow')
  })

  it('既有工具 render 时，手画的 ```mermaid 调用图被剥掉（去重，治"解析失败"）', () => {
    const raw = '说明：\n```mermaid\nflowchart TD\n  A-->B\n```\n结尾'
    const tcs = { a: tc({ render: { kind: 'call_graph', data: { nodes: [] } }, at: raw.length }) }
    const segs = buildAnswerSegments(raw, tcs)
    const textJoined = segs.filter(s => s.kind === 'text').map(s => (s as { content: string }).content).join('')
    expect(textJoined).not.toContain('flowchart')          // 手画 mermaid 调用图被剥
    expect(segs.some(s => s.kind === 'render')).toBe(true)  // 工具图保留
  })
})

describe('stripReactflowFences', () => {
  it('剥掉 ```reactflow 块、保留其余文本', () => {
    const r = stripReactflowFences('前文\n```reactflow\n{"nodes":[]}\n```\n后文')
    expect(r).not.toContain('reactflow')   // 围栏块整体删除
    expect(r).toContain('前文')
    expect(r).toContain('后文')
  })
  it('无 reactflow 块原样返回', () => {
    expect(stripReactflowFences('正常文本')).toBe('正常文本')
  })
  it('剥掉手画 mermaid 调用图块（flowchart / graph）', () => {
    const r = stripReactflowFences('前文\n```mermaid\nflowchart TD\n  A-->B\n```\n后文')
    expect(r).not.toContain('flowchart')   // 手画 mermaid 调用图整体删（应走 render_call_graph 工具）
    expect(r).toContain('前文')
    expect(r).toContain('后文')
  })
  it('剥掉手画 mermaid graph LR 调用图块', () => {
    expect(stripReactflowFences('x\n```mermaid\ngraph LR\n  A-->B\n```')).not.toContain('graph LR')
  })
  it('保留 mermaid 非调用图（sequenceDiagram 等，工具画不了）', () => {
    const src = '说明\n```mermaid\nsequenceDiagram\n  A->>B: x\n```'
    expect(stripReactflowFences(src)).toContain('sequenceDiagram')
  })
})
