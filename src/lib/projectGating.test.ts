import { describe, it, expect } from 'vitest'
import { isQAGated, gatedPlaceholder } from './projectGating'

describe('projectGating', () => {
  it('indexing / failed → gated', () => {
    expect(isQAGated('indexing')).toBe(true)
    expect(isQAGated('failed')).toBe(true)
  })
  it('ready / partial → 不 gated（partial 允许提问）', () => {
    expect(isQAGated('ready')).toBe(false)
    expect(isQAGated('partial')).toBe(false)
  })
  it('未知状态 → 不 gated（坏数据不锁死用户）', () => {
    // @ts-expect-error 故意传非法值
    expect(isQAGated('weird')).toBe(false)
  })
  it('占位文案随 gated 状态变化', () => {
    expect(gatedPlaceholder('indexing')).toMatch(/索引/)
    expect(gatedPlaceholder('failed')).toMatch(/失败/)
  })
})
