# 上下文窗口前端展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在对话页输入框上方画一条 Claude Code 风格极简进度条，用后端真实 `context_usage` 显示上下文窗口占用（三态配色），并在后端自动压缩(§18)发生时给出内联提示。

**Architecture:** 复用既有 SSE→Zustand→组件单向链路：后端 `meta` 事件已含 `context_usage`，前端在 `chat.ts` 的 `meta` 分支把它写入 store 新字段 `contextUsage`，新组件 `ContextWindowBar` 订阅渲染；新建 `--context-*` 语义主题 token（light/dark 双档）。前端纯展示，**不**触发压缩（§18 后端每轮自动跑）。

**Tech Stack:** React 19 + Vite + TypeScript + Zustand + Tailwind v4（CSS `@theme inline`）+ vitest + @testing-library/react。

**Spec（单一来源）：** `/Users/java/obsidian/01 Engineering/knowledge-engineering/上下文窗口前端展示-设计.md`（父设计 `记忆系统-设计.md` §18）。

**Repo：** `/Users/java/knowledge-engineering-web`（**独立 git 仓库**，当前分支 `feat/chit-chat-skill`；与后端 `knowledge-engineering-auth@release-0513` 是两个仓库）。后端不改。⚠️ 实施前在执行交接处与用户确认分支与逐任务提交授权。

---

## 现状基线（已核对真实代码 2026-05-18）

- **后端已发**（不改）：`knowledge-engineering-auth/src/service/qa_router.py:295-299` 构造 `context_usage={used_tokens,window_tokens,pct,history_trimmed}`（`pct` 已 `round(min(used/window,1.0)*100,1)`，clamp 0–100、1 位小数）；`sse_emitter.py:125-126` 非空时并入 `meta`。chit-chat/异常 → `context_usage=None`，meta 不含该键。
- `src/types/chat.ts`：`MetaPayload` 在 L132-143，无 `context_usage`；无 `ContextUsage` 类型。
- `src/store/chat.ts`：`import type {...} from '@/types/chat'` 在 L26-34；`ChatStore` 接口 L80-111；`create<ChatStore>` 初始 state L117-123；`startNew` L125-134；`loadSession` set L140-146；`case 'meta'` L225-242（只读 session_id/message_id）；`reset` L426-437。
- `src/index.css`：light `:root` 内 `--destructive-foreground: oklch(0.985 0 0);`(L100) 后空行、`--border: oklch(0.922 0 0);`(L102)；`.dark` 内 `--destructive-foreground: oklch(0.985 0 0);`(L150)、`--border: oklch(1 0 0 / 10%);`(L152)；`@theme inline` 内 `--color-destructive-foreground: var(--destructive-foreground);`(L185)、`--color-border: var(--border);`(L186)。
- `src/pages/ChatPage.tsx`：组件 import L18-20；`<div className="px-4 py-3 bg-background">` 出现 **两处**（L159 归档空态、L199 有消息）→ 挂载点必须用宽上下文唯一锚定 L199 那处。
- **测试房规**（关键）：`chat.ts` 的 SSE parser 是 `sendMessage` 内闭包、不导出，房规**不** mock fetch/SSE，而是①测真实可调 action 契约 ②对 `chat.ts` 源码做 `readFileSync` 不变量断言（见 `src/store/chat.test.ts` 现有 `case 'done'` 不变量测试）。本计划 store 测试沿用此法。组件测试用 `@testing-library/react` + `useChatStore.setState(...)`（Zustand 全局 store，测试可直接置态，见 `chat.test.ts` 对 `useSessionStore.setState` 用法）。
- vitest：`npm test`（watch）/`npm run test:run`（单次）；测试协同位 `*.test.ts(x)`；别名 `@/`→`src/`；cwd=仓库根。

---

## File Structure

| 文件 | 职责 | 改动 |
|---|---|---|
| `src/types/chat.ts` | SSE 协议类型 | 加 `ContextUsage` 接口 + `MetaPayload.context_usage?` |
| `src/store/chat.ts` | 对话状态 store | 加 `contextUsage` 字段 + meta 写入 + startNew/loadSession/reset 归 null |
| `src/index.css` | 主题 token 单一来源 | 加 `--context-ok/warn/danger`（:root + .dark）+ `@theme inline` 注册 |
| `src/components/chat/ContextWindowBar.tsx` | 进度条展示组件（唯一职责：读 contextUsage 渲染） | 新建 |
| `src/pages/ChatPage.tsx` | 对话页装配 | import + 有消息分支输入坞内挂载 |
| `src/store/chat.test.ts` | store 测试（既有文件） | 追加 contextUsage 契约 + 源码不变量 |
| `src/components/chat/ContextWindowBar.test.tsx` | 组件测试 | 新建 |

---

## Task 1: 类型 + store 接线（contextUsage 状态、meta 写入、跨会话归零）

**Files:**
- Modify: `src/types/chat.ts`（`MetaPayload` 区 L130-143）
- Modify: `src/store/chat.ts`（import L26-34；接口 L80-111；初始 L117-123；startNew L125-134；loadSession L140-146；meta L229-240；reset L426-437）
- Test: `src/store/chat.test.ts`（既有文件，末尾追加）

- [ ] **Step 1a: 加 import（顶部，避免 ESLint import/first）** —— `src/store/chat.test.ts`，把顶部：

```typescript
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessions'
import type { Session } from '@/types/session'
```

替换为：

```typescript
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from './sessions'
import { useChatStore } from './chat'
import type { Session } from '@/types/session'
```

- [ ] **Step 1b: 写失败测试** —— 追加到 `src/store/chat.test.ts` **末尾**（`describe`/`it`/`expect`/`beforeEach`/`readFileSync` 顶部已 import，勿在此再 import）：

```typescript

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
    expect(metaBlock).toContain("typeof")
    expect(metaBlock).toContain('context_usage')
  })

  it('源码不变量：loadSession 切会话时一并清 contextUsage（无串台）', () => {
    const src = readFileSync('src/store/chat.ts', 'utf-8')
    const lsIdx = src.indexOf('loadSession:')
    const abortIdx = src.indexOf('abort:', lsIdx)
    expect(lsIdx).toBeGreaterThan(-1)
    const lsBlock = src.slice(lsIdx, abortIdx)
    expect(lsBlock).toContain('contextUsage')
  })
})
```

- [ ] **Step 2: 跑，确认失败** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/store/chat.test.ts`
  Expected: FAIL —— `初始 contextUsage 为 null` 报 `expected undefined to be null`（store 尚无该字段）；源码不变量断言也 FAIL。

- [ ] **Step 3: 实现 types** —— `src/types/chat.ts`，把：

```typescript
// ─── 各 SSE 事件的 data payload 类型（按 spec §6.4）──────────────────────

export interface MetaPayload {
  session_id: string
  message_id: string
  plan_steps: string[]
  entry_points?: string[]
  /** v1.1 路由决策：skill 名（business / dependency / data-flow / architecture）。 */
  skill_id?: string
  /** v1.1：路由来源 'keyword' | 'llm' | 'llm-fallback' | 'llm-error'。 */
  route_source?: string
  /** v1.1：关键词路径命中的具体词（用于 UI 解释"识别到 X / Y"）。 */
  matched_keywords?: string[]
}
```

替换为：

```typescript
// ─── 各 SSE 事件的 data payload 类型（按 spec §6.4）──────────────────────

/** 上下文窗口用量（后端 qa_router 每轮经 meta 事件发；设计 §5.1）。 */
export interface ContextUsage {
  used_tokens: number
  window_tokens: number
  /** 后端已 clamp 0–100、1 位小数。 */
  pct: number
  /** 本轮是否触发了 §18 自动裁史/压缩。 */
  history_trimmed: boolean
}

export interface MetaPayload {
  session_id: string
  message_id: string
  plan_steps: string[]
  entry_points?: string[]
  /** v1.1 路由决策：skill 名（business / dependency / data-flow / architecture）。 */
  skill_id?: string
  /** v1.1：路由来源 'keyword' | 'llm' | 'llm-fallback' | 'llm-error'。 */
  route_source?: string
  /** v1.1：关键词路径命中的具体词（用于 UI 解释"识别到 X / Y"）。 */
  matched_keywords?: string[]
  /** 上下文窗口用量（旧后端/ chit-chat 不发 → 可选）。设计 §5.1 */
  context_usage?: ContextUsage
}
```

- [ ] **Step 4: 实现 store import** —— `src/store/chat.ts`，把 L26-34 的：

```typescript
import type {
  ChatStatus,
  Message,
  Section,
  SectionType,
  Reference,
  MessageMetadata,
  ToolCallPayload,
} from '@/types/chat'
```

替换为：

```typescript
import type {
  ChatStatus,
  Message,
  Section,
  SectionType,
  Reference,
  MessageMetadata,
  ToolCallPayload,
  ContextUsage,
} from '@/types/chat'
```

- [ ] **Step 5: 实现 store 接口字段** —— `src/store/chat.ts`，把：

```typescript
  /** 中止控制器（用户点 ⏸ 停止时调）。 */
  _abortCtrl: AbortController | null

  // ─── actions ───
```

替换为：

```typescript
  /** 中止控制器（用户点 ⏸ 停止时调）。 */
  _abortCtrl: AbortController | null
  /** 上下文窗口用量（每轮 meta 刷新；新会话/切会话/重置归 null）。设计 §5.2 */
  contextUsage: ContextUsage | null

  // ─── actions ───
```

- [ ] **Step 6: 实现初始 state** —— `src/store/chat.ts`，把：

```typescript
  currentSessionId: null,
  currentProjectId: null,
  messages: [],
  streamingMessage: null,
  status: 'idle',
  error: null,
  _abortCtrl: null,

  startNew: (projectId: string) => {
```

替换为：

```typescript
  currentSessionId: null,
  currentProjectId: null,
  messages: [],
  streamingMessage: null,
  status: 'idle',
  error: null,
  _abortCtrl: null,
  contextUsage: null,

  startNew: (projectId: string) => {
```

- [ ] **Step 7: 实现 startNew 归零** —— `src/store/chat.ts`，把 `startNew` 内：

```typescript
    set({
      currentSessionId: null,
      currentProjectId: projectId,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
    })
  },
```

替换为：

```typescript
    set({
      currentSessionId: null,
      currentProjectId: projectId,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
      contextUsage: null,
    })
  },
```

- [ ] **Step 8: 实现 loadSession 归零（切会话无串台）** —— `src/store/chat.ts`，把 `loadSession` 内：

```typescript
      set({
        currentSessionId: sessionId,
        currentProjectId: projectId,
        messages: detail.messages,
        streamingMessage: null,
        status: 'idle',
      })
```

替换为：

```typescript
      set({
        currentSessionId: sessionId,
        currentProjectId: projectId,
        messages: detail.messages,
        streamingMessage: null,
        status: 'idle',
        contextUsage: null,
      })
```

- [ ] **Step 9: 实现 meta 写入** —— `src/store/chat.ts`，把 `case 'meta':` 块：

```typescript
            case 'meta': {
              metaSessionId = (data.session_id as string) ?? metaSessionId
              metaMessageId = (data.message_id as string) ?? null
              // 创建空的 streamingMessage
              set({
                streamingMessage: {
                  id: metaMessageId ?? tempId('msg'),
                  session_id: metaSessionId ?? '',
                  role: 'assistant',
                  content: '',
                  sections: [],
                  tool_calls: {},  // v1.3 ReAct：累积 tool 调用
                  created_at: new Date().toISOString(),
                },
                currentSessionId: metaSessionId,
              })
              break
            }
```

替换为：

```typescript
            case 'meta': {
              metaSessionId = (data.session_id as string) ?? metaSessionId
              metaMessageId = (data.message_id as string) ?? null
              // 上下文窗口用量（设计 §5.2）：形状校验，缺失/非法一律 null，绝不抛
              const cu = data.context_usage
              const validCu =
                cu != null && typeof cu === 'object' &&
                typeof (cu as { pct?: unknown }).pct === 'number'
              // 创建空的 streamingMessage
              set({
                streamingMessage: {
                  id: metaMessageId ?? tempId('msg'),
                  session_id: metaSessionId ?? '',
                  role: 'assistant',
                  content: '',
                  sections: [],
                  tool_calls: {},  // v1.3 ReAct：累积 tool 调用
                  created_at: new Date().toISOString(),
                },
                currentSessionId: metaSessionId,
                contextUsage: validCu ? (cu as ContextUsage) : null,
              })
              break
            }
```

- [ ] **Step 10: 实现 reset 归零** —— `src/store/chat.ts`，把 `reset` 内：

```typescript
    set({
      currentSessionId: null,
      currentProjectId: null,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
      _abortCtrl: null,
    })
  },
}))
```

替换为：

```typescript
    set({
      currentSessionId: null,
      currentProjectId: null,
      messages: [],
      streamingMessage: null,
      status: 'idle',
      error: null,
      _abortCtrl: null,
      contextUsage: null,
    })
  },
}))
```

- [ ] **Step 11: 跑，确认通过** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/store/chat.test.ts`
  Expected: 全 passed（新增 6 项 + 既有 session_title / done 不变量不回归）。

- [ ] **Step 12: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/types/chat.ts src/store/chat.ts src/store/chat.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): 接线 contextUsage 状态——meta 写入 + 跨会话归零（TDD）

types 加 ContextUsage + MetaPayload.context_usage?；store 加 contextUsage 字段，
case 'meta' 形状校验后写入（缺失/非法→null 不抛），startNew/loadSession/reset 一并
归零防串台。设计 [[上下文窗口前端展示-设计]] §5.1/§5.2。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 主题语义 token（`--context-*`，light/dark 双档）

**Files:**
- Modify: `src/index.css`（:root L99-102 区；.dark L150-152 区；@theme inline L185-186 区）
- Test: `src/index.test.ts`（新建——沿用房规 readFileSync 源码不变量，CSS 无行为可单测）

- [ ] **Step 1: 写失败测试** —— 新建 `src/index.test.ts`：

```typescript
/**
 * src/index.test.ts
 *
 * 主题 token 源码不变量：--context-ok/warn/danger 必须在 :root 与 .dark 各定义一档，
 * 并在 @theme inline 注册为 --color-context-*（Tailwind 才能用 bg-context-*）。
 * CSS 无运行时行为可单测，沿用本仓库 readFileSync 不变量手法（见 chat.test.ts）。
 * 设计：[[上下文窗口前端展示-设计]] §5.3
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('src/index.css', 'utf-8')

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'))
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('@theme inline {'))
const themeBlock = css.slice(css.indexOf('@theme inline {'))

describe('index.css --context-* 语义 token', () => {
  it(':root 定义三态 light token', () => {
    expect(rootBlock).toContain('--context-ok: oklch(0.55 0.17 250)')
    expect(rootBlock).toContain('--context-warn: oklch(0.75 0.15 85)')
    expect(rootBlock).toContain('--context-danger: oklch(0.577 0.245 27.325)')
  })

  it('.dark 定义三态 dark token（提亮一档防脏块）', () => {
    expect(darkBlock).toContain('--context-ok: oklch(0.70 0.15 250)')
    expect(darkBlock).toContain('--context-warn: oklch(0.82 0.14 85)')
    expect(darkBlock).toContain('--context-danger: oklch(0.704 0.191 22.216)')
  })

  it('@theme inline 注册 --color-context-* (启用 bg-context-*)', () => {
    expect(themeBlock).toContain('--color-context-ok: var(--context-ok)')
    expect(themeBlock).toContain('--color-context-warn: var(--context-warn)')
    expect(themeBlock).toContain('--color-context-danger: var(--context-danger)')
  })
})
```

- [ ] **Step 2: 跑，确认失败** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/index.test.ts`
  Expected: FAIL —— `:root 定义三态 light token` 报找不到 `--context-ok`（尚未加）。

- [ ] **Step 3: 实现 light token** —— `src/index.css`，把（注意此处 `--border` 值 `oklch(0.922 0 0)` 是 light 块唯一锚）：

```css
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.922 0 0);
```

替换为：

```css
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  /* 上下文窗口三态语义色（设计 §5.3）：蓝 ≤80% / 琥珀 ≤95% / 红 >95% */
  --context-ok: oklch(0.55 0.17 250);
  --context-warn: oklch(0.75 0.15 85);
  --context-danger: oklch(0.577 0.245 27.325);

  --border: oklch(0.922 0 0);
```

- [ ] **Step 4: 实现 dark token** —— `src/index.css`，把（`--border` 值 `oklch(1 0 0 / 10%)` 是 .dark 块唯一锚）：

```css
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(1 0 0 / 10%);
```

替换为：

```css
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  /* 上下文窗口三态（dark 提亮一档防"脏块"，前端宪法状态色暗变体；设计 §5.3） */
  --context-ok: oklch(0.70 0.15 250);
  --context-warn: oklch(0.82 0.14 85);
  --context-danger: oklch(0.704 0.191 22.216);

  --border: oklch(1 0 0 / 10%);
```

- [ ] **Step 5: 实现 @theme inline 注册** —— `src/index.css`，把：

```css
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
```

替换为：

```css
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-context-ok: var(--context-ok);
  --color-context-warn: var(--context-warn);
  --color-context-danger: var(--context-danger);
  --color-border: var(--border);
```

- [ ] **Step 6: 跑，确认通过** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/index.test.ts`
  Expected: 全 3 passed。

- [ ] **Step 7: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/index.css src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): 新增 --context-ok/warn/danger 语义 token（light/dark 双档，TDD）

:root + .dark 各一档（dark 提亮防脏块），@theme inline 注册 --color-context-*
启用 bg-context-* utility。组件零硬编码色值前置依赖。设计 §5.3。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ContextWindowBar` 组件

**Files:**
- Create: `src/components/chat/ContextWindowBar.tsx`
- Test: `src/components/chat/ContextWindowBar.test.tsx`

- [ ] **Step 1: 写失败测试** —— 新建 `src/components/chat/ContextWindowBar.test.tsx`：

```typescript
/**
 * src/components/chat/ContextWindowBar.test.tsx
 *
 * 验证 ContextWindowBar：
 *   - contextUsage=null → 不渲染
 *   - 三态阈值：pct≤80 ok蓝 / 80<pct≤95 warn黄 / pct>95 danger红
 *   - 文案：ok 显 {pct}%；warn/danger 显"剩余 X% 直到自动压缩"
 *   - history_trimmed → 追加"已自动压缩较早历史"
 *   - role=progressbar + aria-valuenow；title 含 used/window
 * 设计：[[上下文窗口前端展示-设计]] §5.4
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'

import { ContextWindowBar } from './ContextWindowBar'
import { useChatStore } from '@/store/chat'
import type { ContextUsage } from '@/types/chat'

function setCU(cu: ContextUsage | null) {
  useChatStore.setState({ contextUsage: cu })
}
const base: ContextUsage = {
  used_tokens: 1200, window_tokens: 1000000, pct: 50, history_trimmed: false,
}

describe('ContextWindowBar', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
  })

  it('contextUsage=null → 不渲染任何东西', () => {
    setCU(null)
    const { container } = render(<ContextWindowBar />)
    expect(container.firstChild).toBeNull()
  })

  it('pct=50 → ok 蓝，文案显 50%，progressbar aria 正确', () => {
    setCU({ ...base, pct: 50 })
    render(<ContextWindowBar />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', '上下文窗口使用量')
    const fill = bar.querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-ok')
    expect(fill).toHaveStyle({ width: '50%' })
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('pct=85 → warn 黄，文案"剩余 15% 直到自动压缩"', () => {
    setCU({ ...base, pct: 85 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-warn')
    expect(screen.getByText(/剩余 15% 直到自动压缩/)).toBeInTheDocument()
  })

  it('pct=97 → danger 红', () => {
    setCU({ ...base, pct: 97 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill?.className).toContain('bg-context-danger')
    expect(screen.getByText(/剩余 3% 直到自动压缩/)).toBeInTheDocument()
  })

  it('边界 pct=80 → ok；pct=80.1 → warn；pct=95 → warn；pct=95.1 → danger', () => {
    setCU({ ...base, pct: 80 })
    const r1 = render(<ContextWindowBar />)
    expect(r1.container.querySelector('[data-fill]')?.className).toContain('bg-context-ok')
    r1.unmount()
    setCU({ ...base, pct: 80.1 })
    const r2 = render(<ContextWindowBar />)
    expect(r2.container.querySelector('[data-fill]')?.className).toContain('bg-context-warn')
    r2.unmount()
    setCU({ ...base, pct: 95 })
    const r3 = render(<ContextWindowBar />)
    expect(r3.container.querySelector('[data-fill]')?.className).toContain('bg-context-warn')
    r3.unmount()
    setCU({ ...base, pct: 95.1 })
    const r4 = render(<ContextWindowBar />)
    expect(r4.container.querySelector('[data-fill]')?.className).toContain('bg-context-danger')
  })

  it('history_trimmed=true → 追加"已自动压缩较早历史"提示', () => {
    setCU({ ...base, pct: 60, history_trimmed: true })
    render(<ContextWindowBar />)
    expect(screen.getByText(/已自动压缩较早历史以继续对话/)).toBeInTheDocument()
  })

  it('title 含 used/window 原始数（极简版唯一原始数字处）', () => {
    setCU({ ...base, pct: 50, used_tokens: 1234, window_tokens: 1000000 })
    render(<ContextWindowBar />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'title', '已用 ~1234 / 1000000 tokens',
    )
  })

  it('pct 越界（>100）→ clamp 到 100 宽度', () => {
    setCU({ ...base, pct: 150 })
    render(<ContextWindowBar />)
    const fill = screen.getByRole('progressbar').querySelector('[data-fill]')
    expect(fill).toHaveStyle({ width: '100%' })
  })
})
```

- [ ] **Step 2: 跑，确认失败** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/components/chat/ContextWindowBar.test.tsx`
  Expected: FAIL —— 解析失败/`Cannot find module './ContextWindowBar'`（组件未建）。

- [ ] **Step 3: 实现组件** —— 新建 `src/components/chat/ContextWindowBar.tsx`：

```typescript
/**
 * src/components/chat/ContextWindowBar.tsx
 *
 * 上下文窗口用量进度条（Claude Code 风格极简）。读 store.contextUsage：
 *   - null → 不渲染
 *   - 三态：pct≤80 蓝(ok) / 80<pct≤95 黄(warn) / pct>95 红(danger)
 *   - 文案：ok 显 {pct}%；warn/danger 显"剩余 X% 直到自动压缩"
 *   - history_trimmed（后端 §18 已自动压缩）→ 内联提示
 * 纯展示，不触发压缩（§18 后端职责）。设计：[[上下文窗口前端展示-设计]] §5.4
 */
import { useChatStore } from '@/store/chat'

const FILL_CLASS = {
  ok: 'bg-context-ok',
  warn: 'bg-context-warn',
  danger: 'bg-context-danger',
} as const

export function ContextWindowBar() {
  const cu = useChatStore(s => s.contextUsage)
  if (cu == null) return null

  // 后端已 clamp，组件再防御一次（越界/脏数据不破版）
  const pct = Math.min(100, Math.max(0, cu.pct))
  const state: keyof typeof FILL_CLASS =
    pct <= 80 ? 'ok' : pct <= 95 ? 'warn' : 'danger'
  const remaining = Math.max(0, 100 - pct)

  return (
    <div className="max-w-3xl mx-auto w-full mb-1.5">
      <div
        role="progressbar"
        aria-label="上下文窗口使用量"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`已用 ~${cu.used_tokens} / ${cu.window_tokens} tokens`}
        className="h-1.5 w-full rounded-full bg-border overflow-hidden"
      >
        <div
          data-fill
          className={`h-full rounded-full transition-all ${FILL_CLASS[state]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {state === 'ok'
          ? `${cu.pct}%`
          : `剩余 ${remaining}% 直到自动压缩`}
        {cu.history_trimmed && ' · 已自动压缩较早历史以继续对话'}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: 跑，确认通过** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/components/chat/ContextWindowBar.test.tsx`
  Expected: 全 passed（9 项含三态、边界、history_trimmed、title、clamp、aria）。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/chat/ContextWindowBar.tsx src/components/chat/ContextWindowBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): ContextWindowBar 进度条组件（三态配色 + 压缩提示，TDD）

读 store.contextUsage：null 不渲染；pct≤80 蓝/≤95 黄/>95 红（组件内 clamp）；
ok 显百分比、warn/danger 显"剩余 X%"、history_trimmed 追加"已自动压缩"内联提示；
纯 token 配色零硬编码；role=progressbar 无障碍。纯展示不触发压缩。设计 §5.4。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 挂载到 ChatPage（有消息分支输入坞内，空态不挂）

**Files:**
- Modify: `src/pages/ChatPage.tsx`（import L18-20；有消息分支输入坞 L199-207）
- Test: `src/pages/ChatPage.contextbar.test.tsx`（新建——沿用房规源码不变量，ChatPage 依赖 router/多 store 重而脆）

- [ ] **Step 1: 写失败测试** —— 新建 `src/pages/ChatPage.contextbar.test.tsx`：

```typescript
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
```

- [ ] **Step 2: 跑，确认失败** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/pages/ChatPage.contextbar.test.tsx`
  Expected: FAIL —— `import 了 ContextWindowBar` 找不到（未 import）。

- [ ] **Step 3: 实现 import** —— `src/pages/ChatPage.tsx`，把：

```typescript
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageList } from '@/components/chat/MessageList'
```

替换为：

```typescript
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageList } from '@/components/chat/MessageList'
import { ContextWindowBar } from '@/components/chat/ContextWindowBar'
```

- [ ] **Step 4: 实现挂载** —— `src/pages/ChatPage.tsx`，把「有消息」分支末尾这段（用 `loading={isLoading}` + `继续追问...` 三元唯一锚定，区别于 L159 归档空态那处）：

```tsx
      {error && <ErrorBar message={error} />}

      <div className="px-4 py-3 bg-background">
        <ChatInput
          onSend={handleSend}
          loading={isLoading}
          onAbort={abort}
          disabled={isArchived}
          placeholder={isArchived ? '该对话已归档，无法继续提问' : '继续追问...'}
        />
      </div>
    </div>
  )
}
```

替换为：

```tsx
      {error && <ErrorBar message={error} />}

      <div className="px-4 py-3 bg-background">
        <ContextWindowBar />
        <ChatInput
          onSend={handleSend}
          loading={isLoading}
          onAbort={abort}
          disabled={isArchived}
          placeholder={isArchived ? '该对话已归档，无法继续提问' : '继续追问...'}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 跑，确认通过** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run -- src/pages/ChatPage.contextbar.test.tsx`
  Expected: 全 3 passed。

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/pages/ChatPage.tsx src/pages/ChatPage.contextbar.test.tsx
git commit -m "$(cat <<'EOF'
feat(chat): ChatPage 有消息分支输入坞内挂载 ContextWindowBar（空态不挂，TDD）

仅「有消息」分支 ChatInput 上方渲染，max-w-3xl 对齐；EmptyState/归档空态不挂
（组件本身 null 时不渲染，双保险无闪烁）。设计 §5.5。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 回归 + 类型/构建验证（无新文件/commit）

- [ ] **Step 1: 全量测试** —— Run: `cd /Users/java/knowledge-engineering-web && npm run test:run`
  Expected: 0 fail（新增 ~21 项；既有 chat/session/tool-call 等不回归——纯新增字段 + 新组件，未改既有行为）。

- [ ] **Step 2: 类型 + 构建** —— Run: `cd /Users/java/knowledge-engineering-web && npx tsc -b`
  Expected: 退出码 0，无类型错误（`ContextUsage` 全链路一致：types→store→组件）。

- [ ] **Step 3: Lint** —— Run: `cd /Users/java/knowledge-engineering-web && npm run lint`
  Expected: 无新增 error（沿用既有风格；新文件无 `any` 滥用）。

> 端到端（控制器在 Preview/浏览器跑，不在 subagent 范围）：本地 dev(5173) 连后端，发几轮长对话，观察输入框上方进度条颜色随 pct 变（蓝→黄→红）、history_trimmed 时出现"已自动压缩较早历史"；**切 light/dark 两主题各看一遍**（前端宪法自检：对比度、暗色不脏块、状态色暗变体足够亮）；新会话/切会话进度条清零不串台。截图留证。

---

## Self-Review（实施者过一遍）

- [ ] spec §5.1 类型 ✓(T1 Step3) / §5.2 store 接线+跨会话归零 ✓(T1 Step5-10，含 loadSession) / §5.3 三块 token ✓(T2) / §5.4 组件三态+文案+title+aria+clamp ✓(T3) / §5.5 挂载点+空态不挂 ✓(T4) / §6 失败语义=形状校验缺失即 null 不抛 ✓(T1 Step9) / §7 测试沿用房规（契约+源码不变量+RTL）✓
- [ ] 占位扫描：每 code step 完整可粘贴、命令带 Expected、无 TBD/“类似 Task”/含糊措辞 ✓
- [ ] 类型一致：`ContextUsage{used_tokens,window_tokens,pct,history_trimmed}` 在 types 定义、store import 同名、组件 `import type { ContextUsage }`、`contextUsage` 字段名全链路一致；`bg-context-ok|warn|danger` 与 `--color-context-*` 注册名一致；测试 `data-fill` 与组件 `data-fill` 一致 ✓
- [ ] YAGNI：只改 5 文件 + 测试；不动后端、不前端触发压缩、不修 `SSEEventType` 漏 `'session_title'`、无设置 UI、空态不显示、无 i18n ✓
- [ ] 锚点唯一性：index.css 用 `--border` 差值区分 light/dark 块；ChatPage 用 `loading={isLoading}`+`继续追问...` 三元区分 L199 与 L159 ✓

## Phase Definition of Done

- [ ] 新增 ~21 测试全绿（store 6 + index 3 + 组件 9 + ChatPage 3）
- [ ] 既有测试不回归；`tsc -b` 0 错；lint 无新增 error
- [ ] 4 feat commit 干净（类型/store｜token｜组件｜挂载）
- [ ] 已交付控制器端到端说明（含 light/dark 双主题自检 + 跨会话清零）
