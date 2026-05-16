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
import { readFileSync } from 'node:fs'
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

/**
 * 控制流不变量回归测试（characterization，2026-05-16）：
 *
 * 后端在 SSE `done` 事件【之后】才发 `session_title` 事件（首轮异步总结）。
 * chat.ts 的 reader 循环是 `while (!stopped)`；若 `case 'done'` 里 set
 * stopped=true，循环会在 done 后立即退出、reader 停读 → session_title
 * 永远收不到 → 侧栏标题不刷新（E2E 实测发现的真 bug）。
 *
 * SSE parser 是 sendMessage 内闭包不可直接单测，这里用源码不变量兜底：
 * `case 'done'` 块内不得出现 `stopped = true`。退出由 reader.read() 的
 * done=true（流自然结束）兜底。设计：[[会话标题-重命名与智能总结-设计]] §4.2
 */
describe('chat.ts SSE 控制流不变量', () => {
  it("case 'done' 不得 set stopped=true（否则 session_title 收不到）", () => {
    // vitest cwd = 仓库根；直接相对路径读源码（比 import.meta.url 在测试环境稳）
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const doneIdx = src.indexOf("case 'done':")
    const nextCaseIdx = src.indexOf("case 'session_title':", doneIdx)
    expect(doneIdx).toBeGreaterThan(-1)
    expect(nextCaseIdx).toBeGreaterThan(doneIdx)
    const doneBlock = src.slice(doneIdx, nextCaseIdx)
    // 先剥掉 // 行注释（注释里解释 "stopped=true" 的文字不算代码语句），
    // 再归一化空白后断言：真实代码中不得有 stopped=true 赋值。
    const codeOnly = doneBlock
      .split('\n')
      .map(line => line.replace(/\/\/.*$/, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
    expect(codeOnly).not.toMatch(/stopped\s*=\s*true/)
  })
})
