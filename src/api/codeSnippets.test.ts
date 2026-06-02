// src/api/codeSnippets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './client'
import { getCodeSnippet } from './codeSnippets'

describe('getCodeSnippet', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('打到正确 URL + query 并返回 data', async () => {
    const fake = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [] }
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: fake } as never)
    const out = await getCodeSnippet('mall-swarm', 'A::m#()')
    expect(spy).toHaveBeenCalledWith(
      '/projects/mall-swarm/code-snippet',
      { params: { entity_id: 'A::m#()' } },
    )
    expect(out).toBe(fake)
  })

  it('projectId 含特殊字符时 path segment 被 encode', async () => {
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} } as never)
    await getCodeSnippet('org/repo', 'A::m#()')
    expect(spy).toHaveBeenCalledWith(
      '/projects/org%2Frepo/code-snippet',
      { params: { entity_id: 'A::m#()' } },
    )
  })
})
