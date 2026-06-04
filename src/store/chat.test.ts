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
import { useChatStore } from './chat'
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

/**
 * §上下文窗口前端展示：contextUsage 状态接线
 * 房规：SSE parser 是 sendMessage 内闭包不可单测 → ①真实 action 契约 ②源码不变量
 * （沿用本文件既有 case 'done' 不变量测试手法）。设计：[[上下文窗口前端展示-设计]] §5.2/§6
 */
describe('chat store contextUsage 接线', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it('初始 contextUsage 为 null', () => {
    expect(useChatStore.getState().contextUsage).toBeNull()
  })

  it('startNew 后 contextUsage 归 null（不跨会话泄漏）', () => {
    useChatStore.setState({
      contextUsage: { used_tokens: 1, window_tokens: 2, pct: 50, history_trimmed: false },
    })
    useChatStore.getState().startNew('p1')
    expect(useChatStore.getState().contextUsage).toBeNull()
  })

  it('reset 后 contextUsage 归 null', () => {
    useChatStore.setState({
      contextUsage: { used_tokens: 1, window_tokens: 2, pct: 50, history_trimmed: false },
    })
    useChatStore.getState().reset()
    expect(useChatStore.getState().contextUsage).toBeNull()
  })

  it("源码不变量：case 'meta' 块内写入 contextUsage（含形状校验 + null 兜底）", () => {
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const metaIdx = src.indexOf("case 'meta':")
    const nextCaseIdx = src.indexOf("case 'tool_call':", metaIdx)
    expect(metaIdx).toBeGreaterThan(-1)
    expect(nextCaseIdx).toBeGreaterThan(metaIdx)
    const metaBlock = src.slice(metaIdx, nextCaseIdx)
    expect(metaBlock).toContain('contextUsage')
    expect(metaBlock).toContain('context_usage')
    // 全字段形状校验（Fix：防止只验 pct 后 as ContextUsage 存残缺对象）
    expect(metaBlock).toContain("typeof (cu as { pct?: unknown }).pct === 'number'")
    expect(metaBlock).toContain('used_tokens')
    expect(metaBlock).toContain('window_tokens')
    expect(metaBlock).toContain('history_trimmed')
  })

  it('源码不变量：loadSession 切会话时从 messages 累计算 contextUsage（Claude Code 风进度条）', () => {
    // 2026-05-21 重构：切到已有会话时，进度条要继续展示该会话的累计 tokens
    // （以前是清 null → 切会话进度条消失；改造后必须主动算出）
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const lsIdx = src.indexOf('loadSession: async')
    const abortIdx = src.indexOf('abort:', lsIdx)
    expect(lsIdx).toBeGreaterThan(-1)
    const lsBlock = src.slice(lsIdx, abortIdx)
    // 关键不变量：loadSession 必须显式设 contextUsage（不能让上个会话数据残留）；
    // 且来源是 computeUsageFromMessages（由 messages 累计算，非旧 SSE meta 残留）
    expect(lsBlock).toContain('contextUsage:')
    expect(lsBlock).toContain('computeUsageFromMessages(detail.messages)')
  })
})

/**
 * §新对话乐观渲染（2026-06-04）：sendMessage 首个 set 必须同步置 currentSessionId，
 * 让 ChatPage 点发送的瞬间就翻到对话视图，而非干等后端首个 meta 往返（~1s）。
 * 房规：sendMessage SSE 闭包不可单测 → 用源码不变量兜底（同 case 'done' / case 'meta' 手法）。
 */
describe('chat store sendMessage 乐观渲染', () => {
  it("源码不变量：sendMessage 首个 set（user msg + submitting）同步带 currentSessionId: initialSid", () => {
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const smIdx = src.indexOf('sendMessage: async')
    expect(smIdx).toBeGreaterThan(-1)
    // 取 sendMessage 起点 → 首个 AbortController（SSE 发起前）之间的"首段"，
    // 该段含首个 set（立即加 user msg + 置状态/会话），不含后续 SSE 逻辑
    const ctrlIdx = src.indexOf('new AbortController()', smIdx)
    expect(ctrlIdx).toBeGreaterThan(smIdx)
    const headBlock = src.slice(smIdx, ctrlIdx)
    expect(headBlock).toContain("status: 'submitting'")
    expect(headBlock).toContain('currentSessionId: initialSid')   // ← 乐观渲染关键：不等 meta
  })

  it("源码不变量：首段建空 streaming 占位（临时 sid）→ assistant 立即「正在思考」", () => {
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const smIdx = src.indexOf('sendMessage: async')
    const ctrlIdx = src.indexOf('new AbortController()', smIdx)
    const headBlock = src.slice(smIdx, ctrlIdx)
    // 构造空 assistant 占位（同 meta 的 newStreaming 形态）并放进 streamingBySession[initialSid]
    expect(headBlock).toContain("role: 'assistant'")
    expect(headBlock).toContain('streamingBySession: { ...s.streamingBySession, [initialSid]: thinkingPlaceholder }')
  })

  it("源码不变量：case 'meta' 迁移时删除临时 sid 的 streaming 占位（不残留孤儿）", () => {
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const metaIdx = src.indexOf("case 'meta':")
    const nextCaseIdx = src.indexOf("case 'tool_call':", metaIdx)
    expect(metaIdx).toBeGreaterThan(-1)
    const metaBlock = src.slice(metaIdx, nextCaseIdx)
    // 迁移块剥掉 streamingBySession[initialSid]，再以 nextStreamingBySession 为基底在 realSid 下重建
    expect(metaBlock).toContain('nextStreamingBySession')
    expect(metaBlock).toContain('streamingBySession: { ...nextStreamingBySession, [realSid]: newStreaming }')
  })
})

describe('chat SSE tool_call 透传 render（agent 内联调用图）', () => {
  const src = readFileSync('src/store/chat.ts', 'utf-8')
  it("case 'tool_call' 把 render 与到达偏移 at 存进 tool_call 条目", () => {
    const i = src.indexOf("case 'tool_call':")
    const j = src.indexOf("case 'token':", i)
    const block = src.slice(i, j)
    expect(block).toContain('render')        // 透传 render（渲染类工具的图数据）
    expect(block).toContain('raw_stream')    // 记录到达时 raw_stream 偏移
    expect(block).toContain('at:')           // 偏移字段 at（有序段内联用）
  })
})
