/**
 * src/pages/ChatPage.optimistic.test.tsx
 *
 * 新对话「点发送 → 立刻翻到对话页」的乐观渲染装配契约。
 *
 * 根因（2026-06-04 诊断）：ChatPage 的 messages/streamingMessage 原本严格按 URL sessionId 取，
 * 而落地页 URL 无 sessionId → 视图恒为 EmptyState，必须等后端首个 meta 事件回传真 sid →
 * navigate 写 URL 后才翻页（~1s 干等）。修复：选择器回退到 store.currentSessionId
 * （sendMessage 已同步置临时 sid），URL 无 sid 时也能立刻渲染对话视图。
 *
 * ChatPage 整页 render 过脆（见 ChatPage.contextbar.test.tsx 说明），沿用本仓库
 * readFileSync 源码不变量手法验证装配。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/pages/ChatPage.tsx', 'utf-8')

describe('ChatPage 新对话乐观渲染', () => {
  it('messages/streamingMessage 选择器用 sessionId ?? currentSessionId 回退（URL 无 sid 时也渲染）', () => {
    // viewSid 回退模式应恰好出现两次：messages 与 streamingMessage 各一处
    const n = src.split('sessionId ?? s.currentSessionId').length - 1
    expect(n).toBe(2)
  })

  it('navigate 回填 URL 时跳过临时 sid（sess_tmp_），避免地址栏闪现 sess_tmp_xxx', () => {
    // 定位回填 URL 的 navigate 调用
    const navIdx = src.indexOf('navigate(`/project/${projectId}/chat/${liveSessionId}`')
    expect(navIdx).toBeGreaterThan(-1)
    // 它所在 if 的守卫必须含「非临时 sid」判断
    const guardStart = src.lastIndexOf('if (liveSessionId', navIdx)
    expect(guardStart).toBeGreaterThan(-1)
    const guardBlock = src.slice(guardStart, navIdx)
    expect(guardBlock).toContain("!liveSessionId.startsWith('sess_tmp_')")
  })
})
