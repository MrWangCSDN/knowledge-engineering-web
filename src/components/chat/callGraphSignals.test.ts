import { describe, it, expect } from 'vitest'
import {
  DISABLED_ACCENT,
  DISABLED_BADGE_TEXT,
  DISABLED_OPACITY,
  VIRTUAL_EDGE_DASH,
  edgeVisual,
} from './callGraphSignals'

describe('callGraphSignals — GraphRAG 硬信号样式（P6i 前端轮）', () => {
  it('edgeVisual：virtual 边走 --edge-virtual + 虚线，普通边走 muted 实线', () => {
    const v = edgeVisual({ virtual: true })
    expect(v.stroke).toBe('var(--edge-virtual)')
    expect(v.markerColor).toBe('var(--edge-virtual)')
    expect(v.strokeDasharray).toBe(VIRTUAL_EDGE_DASH)
    const c = edgeVisual({})
    expect(c.stroke).toBe('var(--muted-foreground)')
    expect(c.markerColor).toBe('var(--muted-foreground)')
    expect(c.strokeDasharray).toBeUndefined()
  })
  it('禁用样式常量：徽章文案 / 透明度 / 去色 accent / dash 合法', () => {
    expect(DISABLED_BADGE_TEXT).toBe('未启用')
    expect(DISABLED_OPACITY).toBeGreaterThan(0)
    expect(DISABLED_OPACITY).toBeLessThan(1)
    expect(DISABLED_ACCENT).toMatch(/^var\(--/)
    expect(VIRTUAL_EDGE_DASH).toMatch(/\d/)
  })
})
