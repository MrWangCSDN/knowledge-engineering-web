// src/store/codeViewer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCodeViewerStore } from './codeViewer'
import * as api from '@/api/codeSnippets'

const reset = () => useCodeViewerStore.setState({ projectId: null, open: false, tabs: [], activeEntityId: null, width: 560 })

describe('codeViewer store', () => {
  beforeEach(() => { reset(); vi.restoreAllMocks(); localStorage.clear() })

  it('openEntity 拉片段、开抽屉、建 tab、激活', async () => {
    const snip = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [], qualified_name: 'A::m', kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1 }
    vi.spyOn(api, 'getCodeSnippet').mockResolvedValue(snip as never)
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('A::m#()')
    const s = useCodeViewerStore.getState()
    expect(s.open).toBe(true)
    expect(s.activeEntityId).toBe('A::m#()')
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].snippet).toBe(snip)
    expect(s.tabs[0].loading).toBe(false)
  })

  it('无 projectId 时 openEntity 不动作', async () => {
    const spy = vi.spyOn(api, 'getCodeSnippet').mockResolvedValue({} as never)
    await useCodeViewerStore.getState().openEntity('A::m#()')
    expect(spy).not.toHaveBeenCalled()
    expect(useCodeViewerStore.getState().open).toBe(false)
  })

  it('重复 openEntity 复用已有 tab（不重复拉取）', async () => {
    const snip = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [], qualified_name: 'A::m', kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1 }
    const spy = vi.spyOn(api, 'getCodeSnippet').mockResolvedValue(snip as never)
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('A::m#()')
    useCodeViewerStore.getState().close()
    await useCodeViewerStore.getState().openEntity('A::m#()')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(useCodeViewerStore.getState().open).toBe(true)
  })

  it('404 → tab 带 error', async () => {
    vi.spyOn(api, 'getCodeSnippet').mockRejectedValue({ response: { status: 404 } })
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('Ghost::x#()')
    const t = useCodeViewerStore.getState().tabs[0]
    expect(t.loading).toBe(false)
    expect(t.error).toBe('未找到该实体的源码')
  })

  it('closeTab 移除 tab；移除激活 tab 回退最后一个；空则关抽屉', async () => {
    const mk = (id: string) => ({ entityId: id, snippet: null, loading: false, error: null })
    useCodeViewerStore.setState({ open: true, tabs: [mk('a'), mk('b')], activeEntityId: 'b', projectId: 'p' })
    useCodeViewerStore.getState().closeTab('b')
    expect(useCodeViewerStore.getState().activeEntityId).toBe('a')
    useCodeViewerStore.getState().closeTab('a')
    expect(useCodeViewerStore.getState().tabs).toHaveLength(0)
    expect(useCodeViewerStore.getState().open).toBe(false)
  })

  it('setWidth 夹紧到 [320,1400]、NaN 回落默认 560、并持久化到 localStorage', () => {
    const st = () => useCodeViewerStore.getState()
    st().setWidth(800)                                                // 正常值
    expect(st().width).toBe(800)
    expect(localStorage.getItem('ke.codeViewer.width')).toBe('800')   // 已持久化
    st().setWidth(100)                                                // < 下限 320 → 夹到 320
    expect(st().width).toBe(320)
    st().setWidth(99999)                                              // > 上限 1400 → 夹到 1400
    expect(st().width).toBe(1400)
    st().setWidth(Number.NaN)                                         // 非法 → 回落默认 560
    expect(st().width).toBe(560)
  })
})
