import { describe, it, expect } from 'vitest'
import { computeCalleeDecorations } from './calleeDecorations'
import type { CalleeRef } from '@/types/codeSnippet'

const C = (over: Partial<CalleeRef>): CalleeRef => ({ entity_id: 'X::y#()', name: 'y', line: 5, col: 8, ...over })

describe('computeCalleeDecorations', () => {
  it('文件绝对行换算到片段内行 + col 0→1-indexed + 覆盖方法名长度', () => {
    const r = computeCalleeDecorations([C({ line: 104, col: 8, name: 'confirmReceiveOrder' })], 100)
    expect(r).toEqual([{
      entityId: 'X::y#()', startLineNumber: 5, startColumn: 9,
      endLineNumber: 5, endColumn: 9 + 'confirmReceiveOrder'.length, wholeLine: false,
    }])
  })
  it('col 为 null → 整行高亮（wholeLine）', () => {
    const r = computeCalleeDecorations([C({ line: 102, col: null, name: 'foo' })], 100)
    expect(r[0].wholeLine).toBe(true)
    expect(r[0].startLineNumber).toBe(3)
  })
  it('line 为 null → 跳过', () => {
    expect(computeCalleeDecorations([C({ line: null })], 100)).toEqual([])
  })
  it('换算后行 < 1（脏数据）→ 跳过', () => {
    expect(computeCalleeDecorations([C({ line: 50 })], 100)).toEqual([])
  })
})
