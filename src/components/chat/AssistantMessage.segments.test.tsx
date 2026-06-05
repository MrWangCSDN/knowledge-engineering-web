// AssistantMessage 整页 render 依赖 ReactFlow/Markdown 插件链，过脆；沿用本仓库源码不变量手法
// （见 ChatPage.contextbar.test.tsx 说明）。验证 agent 有序段内联 + 调查类收敛 + 结束后持久 的装配。
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/components/chat/AssistantMessage.tsx', 'utf-8')

describe('AssistantMessage agent 有序段内联渲染', () => {
  it('import 了 buildAnswerSegments', () => {
    // 前缀匹配：同一 import 语句还带了 stripReactflowFences，不写死闭合花括号
    expect(src).toContain('import { buildAnswerSegments')
  })

  it('流式自由分支用 buildAnswerSegments + render 段走 CallChainFlow 内联', () => {
    expect(src).toContain('buildAnswerSegments(raw, message.tool_calls)')
    expect(src).toContain("seg.renderKind === 'call_graph'")
  })

  it('调查类 tool_calls 收敛为可展开「调查过程」（过滤掉带 render 的）', () => {
    expect(src).toContain('tc.render == null')
    expect(src).toContain('调查过程')
  })

  it('完成态不再末尾一股脑补图（图改由 sections 的 call_chain 段渲染，治"跳到最后")', () => {
    // 后端 fold_render_sections 已把图按 at 插进 sections，前端顺序渲染即可；
    // 删掉「sections 后用 tool_calls.render 末尾补图」+ 不再需要 hasToolRender 门槛。
    expect(src).not.toContain("tc.render?.kind === 'call_graph'")
  })

  it('sections 文本无条件剥手画节点-边图（不再 gated on hasToolRender）', () => {
    expect(src).toContain('stripReactflowFences(s.content')
    expect(src).not.toContain('hasToolRender')
  })

  it('honor 后端 fold 标的 headerless（agent 自由输出折叠段不显小节头）', () => {
    expect(src).toContain('s.headerless')
  })
})
