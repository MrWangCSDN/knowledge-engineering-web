import { describe, it, expect } from 'vitest'
import { isProjectStatusEnabled } from './features'

describe('features.isProjectStatusEnabled', () => {
  it('返回 false 当 env 未设置或非 "true"', () => {
    expect(isProjectStatusEnabled({})).toBe(false)
    expect(isProjectStatusEnabled({ VITE_KE_PROJECT_STATUS: 'false' })).toBe(false)
    expect(isProjectStatusEnabled({ VITE_KE_PROJECT_STATUS: '1' })).toBe(false)
  })

  it('返回 true 仅当 env === "true"', () => {
    expect(isProjectStatusEnabled({ VITE_KE_PROJECT_STATUS: 'true' })).toBe(true)
  })
})
