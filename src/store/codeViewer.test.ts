// src/store/codeViewer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCodeViewerStore, fileKeyOf } from './codeViewer'
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

  it('同文件不同方法 → 复用同一 tab、激活切到新方法、重取片段定位新行', async () => {
    // IDEA 式「一个文件一个 tab」：pay 与 webPay 同属 Svc.java → 不新建 tab，复用并切方法
    const snipPay = { entity_id: 'com.x.Svc::pay#()', code: 'pay', callees: [], callers: [], qualified_name: 'com.x.Svc::pay', kind: 'method', file_path: 'x/Svc.java', language: 'java', start_line: 10, end_line: 20 }
    const snipWebPay = { entity_id: 'com.x.Svc::webPay#()', code: 'webPay', callees: [], callers: [], qualified_name: 'com.x.Svc::webPay', kind: 'method', file_path: 'x/Svc.java', language: 'java', start_line: 30, end_line: 40 }
    const spy = vi.spyOn(api, 'getCodeSnippet')
      .mockResolvedValueOnce(snipPay as never)        // 第一次 openEntity 返回 pay 片段
      .mockResolvedValueOnce(snipWebPay as never)     // 第二次返回 webPay 片段（新 start_line）
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('com.x.Svc::pay#()')
    await useCodeViewerStore.getState().openEntity('com.x.Svc::webPay#()')
    const s = useCodeViewerStore.getState()
    expect(s.tabs).toHaveLength(1)                       // 同文件 → 仍只有 1 个 tab
    expect(s.activeEntityId).toBe('com.x.Svc::webPay#()')// 激活态切到新方法
    expect(s.tabs[0].entityId).toBe('com.x.Svc::webPay#()')
    expect(s.tabs[0].snippet).toBe(snipWebPay)           // 片段更新为新方法（含新 start_line 供 reveal 定位）
    expect(spy).toHaveBeenCalledTimes(2)                 // 各取一次（换方法需新行号）
  })

  it('不同文件 → 各自独立 tab', async () => {
    const mk = (id: string, fp: string) => ({ entity_id: id, code: 'x', callees: [], callers: [], qualified_name: id, kind: 'method', file_path: fp, language: 'java', start_line: 1, end_line: 1 })
    vi.spyOn(api, 'getCodeSnippet')
      .mockResolvedValueOnce(mk('com.x.A::m#()', 'x/A.java') as never)
      .mockResolvedValueOnce(mk('com.x.B::m#()', 'x/B.java') as never)
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('com.x.A::m#()')
    await useCodeViewerStore.getState().openEntity('com.x.B::m#()')
    expect(useCodeViewerStore.getState().tabs).toHaveLength(2)  // 两个文件 → 两个 tab
  })

  it('404 → tab 带 error', async () => {
    vi.spyOn(api, 'getCodeSnippet').mockRejectedValue({ response: { status: 404 } })
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('Ghost::x#()')
    const t = useCodeViewerStore.getState().tabs[0]
    expect(t.loading).toBe(false)
    // Task 6 起 404 文案统一为"暂无源码"（与 cmd-click toast 一致）
    expect(t.error).toBe('暂无源码')
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

describe('fileKeyOf（一个文件一个 tab 的去重 key）', () => {
  it('取 :: 前的类全限定名（去方法名与参数签名）', () => {
    expect(fileKeyOf('com.x.AlipayServiceImpl::pay#(String)')).toBe('com.x.AlipayServiceImpl')
  })
  it('去内部类后缀（Outer$Inner → Outer，归并到同一物理文件）', () => {
    expect(fileKeyOf('com.x.Outer$Inner::m#()')).toBe('com.x.Outer')
  })
  it('无 :: 时返回原串（兜底）', () => {
    expect(fileKeyOf('plain-id')).toBe('plain-id')
  })
})
