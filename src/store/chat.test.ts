/**
 * src/store/chat.test.ts
 *
 * 验证 chat SSE parser 的 `session_title` 事件接线：
 * 后端首轮异步总结完成会推 `session_title` 事件，chat.ts 的 case 内部
 * 调 useSessionStore.updateSessionTitle 实时刷新侧栏标题。
 *
 * chat.ts 的 SSE parser 是 sendMessage 内的闭包（不单独导出），完整跑通
 * 需 mock fetch+SSE+auth，过重且脆。这里聚焦验证 case body 依赖的契约：
 * updateSessionTitle 能按 sessionId 改对应 session 标题（设计 §4.2）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessions'
import type { Session } from '@/types/session'

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1', project_id: 'p1', title: '临时',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('chat SSE session_title 事件', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1', project_id: 'p1', title: '临时' })],
      },
    })
  })

  it('收到 session_title 事件 → 通过 updateSessionTitle 更新侧栏标题', () => {
    // chat.ts 的 case 'session_title' 内部就是调这个 action
    useSessionStore.getState().updateSessionTitle('s1', 'LLM 总结标题')
    expect(
      useSessionStore.getState().sessionsByProject.p1[0].title,
    ).toBe('LLM 总结标题')
  })

  it('session_title 事件 sid 不匹配时不动现有标题', () => {
    useSessionStore.getState().updateSessionTitle('不存在', 'x')
    expect(
      useSessionStore.getState().sessionsByProject.p1[0].title,
    ).toBe('临时')
  })
})
