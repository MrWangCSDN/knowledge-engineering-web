/**
 * Plan C-frontend Task1：chat.ts SSE parser 接 thinking / todo / done.cited_entities。
 * parser 是 sendMessage 内闭包不可单测 → 沿用本仓源码不变量手法（见 chat.test.ts）。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const SRC = readFileSync('src/store/chat.ts', 'utf-8')

function caseBlock(event: string, nextMarker: string): string {
  const start = SRC.indexOf(`case '${event}':`)
  const end = SRC.indexOf(nextMarker, start + 1)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('chat.ts agent SSE 接线（源码不变量）', () => {
  it("case 'thinking' 累加到 streaming.thinking", () => {
    const blk = caseBlock('thinking', "case 'todo':")
    expect(blk).toMatch(/thinking:\s*\(sm\.thinking/)
    expect(blk).toMatch(/data\.delta/)
  })

  it("case 'todo' 覆盖 streaming.todos", () => {
    const blk = caseBlock('todo', "case 'step':")
    expect(blk).toMatch(/todos:/)
    expect(blk).toMatch(/data\.items/)
  })

  it("case 'done' 用 data.cited_entities（不再写死空数组）", () => {
    const blk = caseBlock('done', "case 'session_title':")
    expect(blk).toMatch(/cited_entities:\s*\(data\.cited_entities/)
  })
})
