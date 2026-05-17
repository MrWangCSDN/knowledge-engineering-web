/**
 * src/pages/ChatPage.contextbar.test.tsx
 *
 * ChatPage 重度依赖 router params + 多 store，整页 render 过脆；沿用本仓库
 * readFileSync 源码不变量手法（见 chat.test.ts）验证装配契约：
 *   - import 了 ContextWindowBar
 *   - 「有消息」分支输入坞内、ChatInput 前渲染 <ContextWindowBar />
 *   - 恰好出现一次（空态/归档空态分支不挂）
 * 设计：[[上下文窗口前端展示-设计]] §5.5
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/pages/ChatPage.tsx', 'utf-8')

describe('ChatPage 装配 ContextWindowBar', () => {
  it('import 了 ContextWindowBar', () => {
    expect(src).toContain(
      "import { ContextWindowBar } from '@/components/chat/ContextWindowBar'",
    )
  })

  it('<ContextWindowBar /> 恰好出现一次（仅有消息分支，空态不挂）', () => {
    const n = src.split('<ContextWindowBar />').length - 1
    expect(n).toBe(1)
  })

  it('ContextWindowBar 在「有消息」分支、位于该分支 ChatInput 之前', () => {
    // 有消息分支锚：placeholder 三元含「继续追问...」的那个 ChatInput
    const anchorIdx = src.indexOf("placeholder={isArchived ? '该对话已归档，无法继续提问' : '继续追问...'}")
    const barIdx = src.indexOf('<ContextWindowBar />')
    expect(anchorIdx).toBeGreaterThan(-1)
    expect(barIdx).toBeGreaterThan(-1)
    expect(barIdx).toBeLessThan(anchorIdx)
    // 且 bar 在该分支起始（最后一个 return 前的 error 行）之后，确属有消息分支
    const msgBranchIdx = src.lastIndexOf('{error && <ErrorBar message={error} />}')
    expect(barIdx).toBeGreaterThan(msgBranchIdx)
  })
})
