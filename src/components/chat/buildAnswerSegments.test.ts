import { describe, it, expect } from 'vitest'
import { buildAnswerSegments } from './buildAnswerSegments'

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
})
