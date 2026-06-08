// src/api/codeSnippets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './client'
import { getCodeSnippet, resolveSymbol } from './codeSnippets'

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

describe('resolveSymbol', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('POST 到正确 URL 并把 payload 原样转发为 body', async () => {
    const fake = { entity_id: 'Foo', has_source: true, kind: 'class' }
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: fake } as never)
    const out = await resolveSymbol('mall-swarm', {
      file_path: 'src/Bar.java',
      line: 15,
      col: 8,
      token: 'Foo',
      want_doc: false,
    })
    expect(spy).toHaveBeenCalledWith(
      '/projects/mall-swarm/code/resolve-symbol',
      {
        file_path: 'src/Bar.java',
        line: 15,
        col: 8,
        token: 'Foo',
        want_doc: false,
      },
    )
    expect(out).toBe(fake)
  })

  it('projectId 含特殊字符时 path segment 被 encode', async () => {
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: null } as never)
    await resolveSymbol('org/repo', { file_path: 'a.java', line: 1, col: 0 })
    expect(spy).toHaveBeenCalledWith(
      '/projects/org%2Frepo/code/resolve-symbol',
      { file_path: 'a.java', line: 1, col: 0 },
    )
  })

  it('后端 200 + null（全落空）时返 null', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: null } as never)
    const out = await resolveSymbol('p', { file_path: 'a.java', line: 1, col: 0 })
    expect(out).toBeNull()
  })
})
