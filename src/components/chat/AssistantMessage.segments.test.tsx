// AssistantMessage 整页 render 依赖 ReactFlow/Markdown 插件链，过脆；沿用本仓库源码不变量手法
// （见 ChatPage.contextbar.test.tsx 说明）。验证 agent 有序段内联 + 调查类收敛 + 结束后持久 的装配。
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/components/chat/AssistantMessage.tsx', 'utf-8')

describe('AssistantMessage agent 有序段内联渲染', () => {
  it('import 了 buildAnswerSegments', () => {
    expect(src).toContain('import { buildAnswerSegments }')
  })

  it('流式自由分支用 buildAnswerSegments + render 段走 CallChainFlow 内联', () => {
    expect(src).toContain('buildAnswerSegments(raw, message.tool_calls)')
    expect(src).toContain("seg.renderKind === 'call_graph'")
  })

  it('调查类 tool_calls 收敛为可展开「调查过程」（过滤掉带 render 的）', () => {
    expect(src).toContain('tc.render == null')
    expect(src).toContain('调查过程')
  })

  it('最终态 sections 渲染后补渲染 render 块（图持久，不随 raw_stream 删除而消失）', () => {
    expect(src).toContain("tc.render?.kind === 'call_graph'")
  })
})
