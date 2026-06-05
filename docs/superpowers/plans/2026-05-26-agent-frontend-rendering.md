# 代码解读 Agent 前端渲染 Implementation Plan（Plan C-frontend）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `knowledge-engineering-web`（React + Zustand + shadcn/ui + Vite + TS）渲染后端 agent 的四样 SSE 输出：thinking 灰字折叠、todo checklist、citations 引用（内联 + 底部 chips + 轻量点击）、自由格式 markdown。

**Architecture:** 沿用现有 SSE→Zustand(`chat.ts`)→`AssistantMessage` 渲染链。`chat.ts` switch 加 `thinking`/`todo` case + `done` 读 `cited_entities`；类型加 `Message.thinking?/todos?` + `DonePayload.cited_entities?`。渲染新增 `ThinkingBlock`/`TodoList`/`EntityRef`/`EntityChip` 组件 + `remarkEntityRef` 插件（把正文 `[entity_id|显示文本]` 转成可点击引用），在 `AssistantMessage` 串联。自由格式靠 `sections.length===1` 走无段头 markdown。状态色加 CSS token（light+dark，守前端宪法）。**不动后端**。

**Tech Stack:** React 19 + TypeScript + Zustand + react-markdown v10 + remark-gfm + Tailwind v4 + shadcn/ui + vitest（jsdom + RTL）。

**测试约定（仓库现状）：** `chat.ts` 的 SSE parser 是 `sendMessage` 内闭包、不导出 → 沿用本仓**源码不变量测试**手法（`readFileSync('src/store/chat.ts')` + 断言某 `case` 块含特定代码，见现有 `src/store/chat.test.ts`）。纯函数（remark 插件）走真单测；组件走 RTL 渲染测试。跑测试：`npx vitest run <file>`。

**仓库 / 分支:** `/Users/java/knowledge-engineering-web`，分支 `feat/chit-chat-skill`（chat 相关都在此分支；那处 404 修复已单独 commit d09952a）。

**设计来源:** Obsidian `[[代码解读Agent前端渲染-设计]]`（配套后端 `[[代码解读Agent引擎-设计]]` A→C4 已落地）。

**关键现状（已确认）:**
- `src/types/chat.ts`：`Reference{entity_id,display_text,kind}`、`Section{type,title,content,references?}`、`MessageMetadata{entry_points,cited_entities,...}`（`cited_entities` 字段已有）、`Message{sections?,metadata?,tool_calls?,raw_stream?,...}`、`SSEEventType` 枚举、`DonePayload{session_id,message_id,total_tokens,cost_yuan,latency_ms}`（无 cited_entities）。
- `src/store/chat.ts`：SSE switch 在 `sendMessage` 闭包内（line ~396-590）；`updateStream(sm=>...)` helper（line 380）更新 `streamingBySession[metaSessionId]`；`case 'done'`（line 511）构造 `metadata` 时 `cited_entities: []`（line 514，写死空）；已有 `token` case 用 `updateStream(sm=>({...sm, raw_stream:...}))`（line 483）可当 thinking/todo 的范式。
- `src/components/chat/AssistantMessage.tsx`：`hasSections`（line 189）分段渲染，`isChitChat`（line 193）跳过 h3；正文 `<ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>`（line 238-244）；references 渲染 line 251-259（只 `cursor-pointer` 无点击）；footer metrics line 333-361（`opacity-0 group-hover:opacity-100` 仅 hover 可见）。
- `src/index.css`：oklch CSS 变量，`:root`（light）+ `.dark`（dark）；已有状态色范式 `--context-ok/warn/danger`（dark 提亮一档，line 102-105 / 157-160）；`@theme inline`（line 171+）注册 `--color-xxx` 给 Tailwind utility。
- 测试样例：`src/store/chat.test.ts`（源码不变量 + action 契约手法）。

---

## Task 1: 数据层 — 类型 + chat.ts SSE 解析（thinking / todo / cited_entities）

**Files:**
- Modify: `src/types/chat.ts`
- Modify: `src/store/chat.ts`
- Test: Create `src/store/chat.agent.test.ts`

- [ ] **Step 1: 写失败测试（源码不变量 + 类型）**

新建 `src/store/chat.agent.test.ts`：

```typescript
/**
 * Plan C-frontend Task1：chat.ts SSE parser 接 thinking / todo / done.cited_entities。
 * parser 是 sendMessage 内闭包不可单测 → 沿用本仓源码不变量手法（见 chat.test.ts）。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const SRC = readFileSync('src/store/chat.ts', 'utf-8')

function caseBlock(event: string, nextMarker: string): string {
  const start = SRC.indexOf(`case '${event}':`)
  const end = SRC.indexOf(nextMarker, start + 1)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return SRC.slice(start, end)
}

describe('chat.ts agent SSE 接线（源码不变量）', () => {
  it("case 'thinking' 累加到 streaming.thinking", () => {
    const blk = caseBlock('thinking', "case 'todo':")
    expect(blk).toMatch(/thinking:\s*\(sm\.thinking/)  // 累加既有 thinking
    expect(blk).toMatch(/data\.delta/)
  })

  it("case 'todo' 覆盖 streaming.todos", () => {
    const blk = caseBlock('todo', "case 'step':")
    expect(blk).toMatch(/todos:/)
    expect(blk).toMatch(/data\.items/)
  })

  it("case 'done' 用 data.cited_entities（不再写死空数组）", () => {
    const blk = caseBlock('done', "case 'session_title':")
    expect(blk).toMatch(/cited_entities:\s*\(data\.cited_entities/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/store/chat.agent.test.ts`
Expected: FAIL（thinking/todo case 不存在；done 仍 `cited_entities: []`）。

- [ ] **Step 3a: 类型（`src/types/chat.ts`）**

`SSEEventType` 枚举加两项（在 `'token'` 行后）：
```typescript
  | 'thinking'       // C-frontend：agent 推理增量（灰字折叠）
  | 'todo'           // C-frontend：多步任务 checklist 快照
```
新增 `TodoItem` + payload 类型（放在 `TokenPayload` 附近）：
```typescript
/** C-frontend：todo checklist 一项（后端 todo_write 元工具，设计 §3.3）。 */
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}
/** thinking 事件 payload：推理增量文本。 */
export interface ThinkingPayload { delta: string }
/** todo 事件 payload：当前 todo 全量快照。 */
export interface TodoPayload { items: TodoItem[] }
```
`Message` 加两字段（在 `raw_stream?` 后）：
```typescript
  /** C-frontend：agent 推理增量累计（灰字折叠展示）。 */
  thinking?: string
  /** C-frontend：agent 多步任务 checklist（todo 事件全量快照）。 */
  todos?: TodoItem[]
```
`DonePayload` 加（在 `latency_ms` 后）：
```typescript
  /** C-frontend：agent 实际查过的 entity_id（引用溯源，后端 Plan C2）。 */
  cited_entities?: string[]
```

- [ ] **Step 3b: chat.ts SSE case**

在 `case 'token': { ... break }`（line ~485）之后、`case 'step':`（line ~487）之前插入：
```typescript
            case 'thinking': {
              const delta = (data.delta as string) ?? ''
              if (!delta) break
              // 累加到 streaming.thinking（范式同 token 的 raw_stream 累计）
              updateStream(sm => ({ ...sm, thinking: (sm.thinking ?? '') + delta }))
              break
            }

            case 'todo': {
              // 后端每次全量发当前 todo 列表 → 覆盖（非累加）
              const items = (data.items as import('@/types/chat').TodoItem[]) ?? []
              updateStream(sm => ({ ...sm, todos: items }))
              break
            }
```
`case 'done'` 里的 `metadata` 构造（line ~512-518），把 `cited_entities: []` 改成：
```typescript
                cited_entities: (data.cited_entities as string[]) ?? [],
```

- [ ] **Step 4: 跑测试确认通过 + 类型检查**

Run: `npx vitest run src/store/chat.agent.test.ts`
Expected: PASS
Run: `npx tsc --noEmit`
Expected: 无新增类型错误

- [ ] **Step 5: commit**

```bash
git add src/types/chat.ts src/store/chat.ts src/store/chat.agent.test.ts
git commit -m "feat(chat): SSE 接 thinking/todo 事件 + done.cited_entities（agent 前端 Task1）"
```

---

## Task 2: 主题 token — todo 状态色 + 引用 accent（light + dark）

**Files:**
- Modify: `src/index.css`
- Test: Create `src/index.agent.test.ts`

- [ ] **Step 1: 写失败测试（源码不变量：两套主题都定义 + dark 提亮）**

新建 `src/index.agent.test.ts`：
```typescript
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const CSS = readFileSync('src/index.css', 'utf-8')
// 取 :root{...} 与 .dark{...} 两块
const rootBlock = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('.dark {'))
const darkBlock = CSS.slice(CSS.indexOf('.dark {'), CSS.indexOf('@theme inline'))

describe('agent 状态色 token（守前端宪法：light+dark 双定义）', () => {
  for (const t of ['--status-pending', '--status-progress', '--status-done', '--ref-accent']) {
    it(`light 定义 ${t}`, () => expect(rootBlock).toContain(t))
    it(`dark 定义 ${t}`, () => expect(darkBlock).toContain(t))
  }
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/index.agent.test.ts`
Expected: FAIL（token 还没加）

- [ ] **Step 3: 加 token**

`src/index.css` 的 `:root { ... }` 块内（在 `--context-danger` 行后）加：
```css
  /* agent todo 状态色 + 引用 accent（light）。沿用 context-* 范式：dark 提亮一档防脏块 */
  --status-pending: oklch(0.556 0 0);        /* 灰，同 muted-foreground */
  --status-progress: oklch(0.75 0.15 85);    /* 琥珀 */
  --status-done: oklch(0.58 0.15 150);       /* 绿 */
  --ref-accent: oklch(0.55 0.17 250);        /* 引用蓝 */
```
`.dark { ... }` 块内（在 `--context-danger` 行后）加（提亮一档）：
```css
  /* agent 状态色（dark 提亮，前端宪法状态色暗变体） */
  --status-pending: oklch(0.74 0 0);
  --status-progress: oklch(0.82 0.14 85);
  --status-done: oklch(0.72 0.15 150);
  --ref-accent: oklch(0.70 0.15 250);
```
`@theme inline { ... }` 块内加（注册为 Tailwind 颜色，紧跟其它 `--color-*`）：
```css
  --color-status-pending: var(--status-pending);
  --color-status-progress: var(--status-progress);
  --color-status-done: var(--status-done);
  --color-ref-accent: var(--ref-accent);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/index.agent.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/index.css src/index.agent.test.ts
git commit -m "feat(theme): agent todo 状态色 + 引用 accent token（light+dark，agent 前端 Task2）"
```

---

## Task 3: 引用渲染基元 — remarkEntityRef 插件 + EntityRef / EntityChip

**Files:**
- Create: `src/components/chat/remarkEntityRef.ts`
- Create: `src/components/chat/EntityRef.tsx`
- Test: Create `src/components/chat/remarkEntityRef.test.tsx`

**思路:** `[entity_id|显示文本]` 不是标准 markdown。remark 插件遍历 mdast `text` 节点，把该模式替换成标准 `link` 节点（`url='entity:'+entityId`，children=显示文本）；再在 react-markdown 的 `a` 组件里识别 `href` 以 `entity:` 开头 → 渲染 `EntityRef`。复用 react-markdown 的 link 渲染，稳。

- [ ] **Step 1: 写失败测试**

新建 `src/components/chat/remarkEntityRef.test.tsx`：
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { remarkEntityRef } from './remarkEntityRef'

// 用一个简化 a 组件断言 entity: href 被转出来
const comps: Components = {
  a: ({ href, children }) => <a data-href={href}>{children}</a>,
}

function md(src: string) {
  render(<ReactMarkdown remarkPlugins={[remarkEntityRef]} components={comps}>{src}</ReactMarkdown>)
}

describe('remarkEntityRef', () => {
  it('把 [entity_id|显示文本] 转成 entity: 链接', () => {
    md('见 [method://com.bank.openAccount|DepositController.openAccount()] 实现')
    const a = screen.getByText('DepositController.openAccount()')
    expect(a.getAttribute('data-href')).toBe('entity:method://com.bank.openAccount')
  })

  it('不误伤普通 markdown 链接', () => {
    md('[文档](https://example.com)')
    const a = screen.getByText('文档')
    expect(a.getAttribute('data-href')).toBe('https://example.com')
  })

  it('一行多个引用都转', () => {
    md('[class://A|甲] 和 [method://b|乙]')
    expect(screen.getByText('甲').getAttribute('data-href')).toBe('entity:class://A')
    expect(screen.getByText('乙').getAttribute('data-href')).toBe('entity:method://b')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/chat/remarkEntityRef.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3a: remarkEntityRef.ts**

新建 `src/components/chat/remarkEntityRef.ts`：
```typescript
/**
 * remark 插件：把正文里的 [entity_id|显示文本] 标记转成 mdast link 节点
 * （url = 'entity:' + entityId）。后端 AGENT_SYSTEM_PROMPT 用这种标记标实体引用。
 * 渲染侧由 AssistantMessage 的 `a` 组件识别 entity: 前缀 → EntityRef。
 */
import type { Root, Text, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

// entity_id 形如 method://... / class://... / table://... / doc://...；显示文本不含 ']' 和 '|'
const ENTITY_RE = /\[([a-z]+:\/\/[^|\]]+)\|([^\]]+)\]/g

export function remarkEntityRef() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index == null) return
      const value = node.value
      ENTITY_RE.lastIndex = 0
      if (!ENTITY_RE.test(value)) return
      ENTITY_RE.lastIndex = 0

      const out: PhrasingContent[] = []
      let last = 0
      let m: RegExpExecArray | null
      while ((m = ENTITY_RE.exec(value)) !== null) {
        if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) })
        const [, entityId, display] = m
        out.push({
          type: 'link',
          url: `entity:${entityId}`,
          children: [{ type: 'text', value: display }],
        })
        last = m.index + m[0].length
      }
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) })

      // 用拆出的节点替换原 text 节点
      parent.children.splice(index, 1, ...out)
      return index + out.length  // 跳过新插入节点，避免无限递归
    })
  }
}
```
> 依赖 `unist-util-visit`（react-markdown 生态自带传递依赖，通常已在 node_modules）。Step 4 跑测试若报缺包：`npm i -D unist-util-visit` 后重跑。

- [ ] **Step 3b: EntityRef.tsx（EntityRef 内联 + EntityChip 底部）**

新建 `src/components/chat/EntityRef.tsx`：
```tsx
/** 引用渲染基元：内联 EntityRef（正文 [entity_id|文本]）+ 底部 EntityChip（cited_entities）。
 * MVP：轻量交互——点击高亮同 entityId 的其它引用 + 复制 id（不跳实体详情页）。 */
import { createContext, useContext } from 'react'

/** 当前高亮的 entityId（message 级），用于点一个引用高亮全部同 entity。 */
export const HighlightCtx = createContext<{
  active: string | null
  setActive: (id: string | null) => void
}>({ active: null, setActive: () => {} })

function shortLabel(entityId: string): string {
  // method://com.bank.openAccount → openAccount；兜底取 :// 后末段
  const tail = entityId.split('://')[1] ?? entityId
  return tail.split(/[.#/]/).pop() || tail
}

export function EntityRef({ entityId, children }: { entityId: string; children?: React.ReactNode }) {
  const { active, setActive } = useContext(HighlightCtx)
  const on = active === entityId
  return (
    <button
      type="button"
      onClick={() => { setActive(on ? null : entityId); void navigator.clipboard?.writeText(entityId) }}
      title={entityId}
      className={`inline px-1 rounded text-[var(--ref-accent)] underline-offset-2 hover:underline cursor-pointer ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {children}
    </button>
  )
}

export function EntityChip({ entityId }: { entityId: string }) {
  const { active, setActive } = useContext(HighlightCtx)
  const on = active === entityId
  return (
    <button
      type="button"
      onClick={() => { setActive(on ? null : entityId); void navigator.clipboard?.writeText(entityId) }}
      title={entityId}
      className={`px-2 py-0.5 rounded-full border text-[12px] cursor-pointer transition-colors text-[var(--ref-accent)] border-[var(--ref-accent)]/40 hover:bg-[var(--ref-accent)]/10 ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {shortLabel(entityId)}
    </button>
  )
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/chat/remarkEntityRef.test.tsx`
Expected: PASS（如报缺 `unist-util-visit` 先 `npm i -D unist-util-visit` 再跑）

- [ ] **Step 5: commit**

```bash
git add src/components/chat/remarkEntityRef.ts src/components/chat/EntityRef.tsx src/components/chat/remarkEntityRef.test.tsx package.json package-lock.json
git commit -m "feat(chat): remarkEntityRef 插件 + EntityRef/EntityChip 引用基元（agent 前端 Task3）"
```

---

## Task 4: ThinkingBlock 组件 + 接入 AssistantMessage

**Files:**
- Create: `src/components/chat/ThinkingBlock.tsx`
- Modify: `src/components/chat/AssistantMessage.tsx`
- Test: Create `src/components/chat/ThinkingBlock.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/chat/ThinkingBlock.test.tsx`：
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThinkingBlock } from './ThinkingBlock'

describe('ThinkingBlock', () => {
  it('流式中展开显示推理文本', () => {
    render(<ThinkingBlock thinking="先看调用方" streaming />)
    expect(screen.getByText('先看调用方')).toBeInTheDocument()
  })

  it('done 后默认折叠，点击展开', () => {
    render(<ThinkingBlock thinking="推理内容" streaming={false} />)
    expect(screen.queryByText('推理内容')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /思考过程/ }))
    expect(screen.getByText('推理内容')).toBeInTheDocument()
  })

  it('thinking 为空时不渲染', () => {
    const { container } = render(<ThinkingBlock thinking="" streaming={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/chat/ThinkingBlock.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3a: ThinkingBlock.tsx**

新建 `src/components/chat/ThinkingBlock.tsx`：
```tsx
/** agent 推理灰字（仿 Claude）：流式中展开实时显示，done 后折叠成可点开的小条。 */
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function ThinkingBlock({ thinking, streaming }: { thinking?: string; streaming: boolean }) {
  // 流式中默认展开；done 后默认折叠
  const [open, setOpen] = useState(streaming)
  if (!thinking) return null
  // streaming 中始终展开（跟随实时输出）
  const expanded = streaming || open
  return (
    <div className="mb-3 text-[13px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 hover:text-foreground/80 transition-colors"
        aria-label="思考过程"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span>思考过程{streaming ? '…' : ''}</span>
      </button>
      {expanded && (
        <div className="mt-1 pl-4 border-l-2 border-muted whitespace-pre-wrap leading-[1.6]">
          {thinking}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3b: 接入 AssistantMessage**

`src/components/chat/AssistantMessage.tsx` 顶部 import 加：
```tsx
import { ThinkingBlock } from './ThinkingBlock'
```
在 tool_calls 卡片块（line ~176-186）**之后**、`{hasSections ? (` （line ~189）**之前**插入：
```tsx
      {/* agent 推理灰字（C-frontend）*/}
      <ThinkingBlock thinking={message.thinking} streaming={streaming} />
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/chat/ThinkingBlock.test.tsx`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/components/chat/ThinkingBlock.tsx src/components/chat/AssistantMessage.tsx src/components/chat/ThinkingBlock.test.tsx
git commit -m "feat(chat): ThinkingBlock 灰字折叠 + 接入 AssistantMessage（agent 前端 Task4）"
```

---

## Task 5: TodoList 组件 + 接入 AssistantMessage

**Files:**
- Create: `src/components/chat/TodoList.tsx`
- Modify: `src/components/chat/AssistantMessage.tsx`
- Test: Create `src/components/chat/TodoList.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/chat/TodoList.test.tsx`：
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodoList } from './TodoList'
import type { TodoItem } from '@/types/chat'

const items: TodoItem[] = [
  { content: '分析订单域入口', status: 'completed' },
  { content: '画调用链', status: 'in_progress' },
  { content: '总结', status: 'pending' },
]

describe('TodoList', () => {
  it('渲染所有 todo 项的文本', () => {
    render(<TodoList todos={items} />)
    expect(screen.getByText('分析订单域入口')).toBeInTheDocument()
    expect(screen.getByText('画调用链')).toBeInTheDocument()
    expect(screen.getByText('总结')).toBeInTheDocument()
  })

  it('空数组不渲染', () => {
    const { container } = render(<TodoList todos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('undefined 不渲染', () => {
    const { container } = render(<TodoList todos={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/chat/TodoList.test.tsx`
Expected: FAIL（模块不存在）

- [ ] **Step 3a: TodoList.tsx**

新建 `src/components/chat/TodoList.tsx`：
```tsx
/** agent 多步任务 checklist（后端 todo_write，设计 §3.3）。状态色走 index.css token（守前端宪法）。 */
import { Circle, Loader2, CheckCircle2 } from 'lucide-react'
import type { TodoItem } from '@/types/chat'

const STATUS_ICON: Record<TodoItem['status'], { Icon: typeof Circle; cls: string; spin?: boolean }> = {
  pending: { Icon: Circle, cls: 'text-[var(--status-pending)]' },
  in_progress: { Icon: Loader2, cls: 'text-[var(--status-progress)]', spin: true },
  completed: { Icon: CheckCircle2, cls: 'text-[var(--status-done)]' },
}

export function TodoList({ todos }: { todos?: TodoItem[] }) {
  if (!todos || todos.length === 0) return null
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
      <div className="mb-1.5 font-medium text-muted-foreground">任务进度</div>
      <ul className="space-y-1">
        {todos.map((t, i) => {
          const { Icon, cls, spin } = STATUS_ICON[t.status] ?? STATUS_ICON.pending
          return (
            <li key={i} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls} ${spin ? 'animate-spin' : ''}`} />
              <span className={t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground/85'}>
                {t.content}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3b: 接入 AssistantMessage**

import 加 `import { TodoList } from './TodoList'`。在 `<ThinkingBlock .../>`（Task4 加的）之后插入：
```tsx
      {/* agent 多步任务 checklist（C-frontend）*/}
      <TodoList todos={message.todos} />
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/chat/TodoList.test.tsx`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/components/chat/TodoList.tsx src/components/chat/AssistantMessage.tsx src/components/chat/TodoList.test.tsx
git commit -m "feat(chat): TodoList checklist + 接入 AssistantMessage（agent 前端 Task5）"
```

---

## Task 6: AssistantMessage 整合 — 自由格式 + 内联引用 + 底部 cited_entities chips

**Files:**
- Modify: `src/components/chat/AssistantMessage.tsx`
- Test: Create `src/components/chat/AssistantMessage.agent.test.tsx`

- [ ] **Step 1: 写失败测试**

新建 `src/components/chat/AssistantMessage.agent.test.tsx`：
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssistantMessage } from './AssistantMessage'
import type { Message } from '@/types/chat'

const base: Omit<Message, 'sections' | 'metadata'> = {
  id: 'm1', session_id: 's1', role: 'assistant', content: '', created_at: '2026-05-26T00:00:00Z',
}

describe('AssistantMessage agent 整合', () => {
  it('单段自由格式：不显示段头（业务概述/回答 h3），正文 markdown 渲染', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '## 概述\n这是自由格式答案' }],
      metadata: { entry_points: [], cited_entities: [], interpretation_freshness: '', token_usage: 0, latency_ms: 0 },
    }
    render(<AssistantMessage message={msg} />)
    // 单段不渲染 "📋 回答" 段头
    expect(screen.queryByRole('heading', { name: /回答/ })).not.toBeInTheDocument()
    // markdown h2 "概述" 渲染出来
    expect(screen.getByText('概述')).toBeInTheDocument()
  })

  it('正文内联 [entity_id|文本] 渲染成可点击引用', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '见 [method://com.bank.foo|Foo.bar()]' }],
    }
    render(<AssistantMessage message={msg} />)
    expect(screen.getByText('Foo.bar()')).toBeInTheDocument()
  })

  it('底部渲染 cited_entities chips', () => {
    const msg: Message = { ...base,
      sections: [{ type: 'overview', title: '回答', content: '答案' }],
      metadata: { entry_points: [], cited_entities: ['method://com.bank.openAccount'], interpretation_freshness: '', token_usage: 0, latency_ms: 0 },
    }
    render(<AssistantMessage message={msg} />)
    // EntityChip 用 shortLabel：openAccount
    expect(screen.getByText('openAccount')).toBeInTheDocument()
  })

  it('多段结构化答案仍显示段头（回归）', () => {
    const msg: Message = { ...base, sections: [
      { type: 'overview', title: '业务概述', content: 'a' },
      { type: 'entry_point', title: '入口方法', content: 'b' },
    ] }
    render(<AssistantMessage message={msg} />)
    expect(screen.getByRole('heading', { name: /业务概述/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/chat/AssistantMessage.agent.test.tsx`
Expected: FAIL（单段仍显示段头；内联引用是纯文本；无 chips）

- [ ] **Step 3a: import + 高亮 context + remark 插件**

`AssistantMessage.tsx` import 加：
```tsx
import { useMemo } from 'react'
import remarkGfm from 'remark-gfm'  // 已有，确认在
import { remarkEntityRef } from './remarkEntityRef'
import { EntityRef, EntityChip, HighlightCtx } from './EntityRef'
```
`MD_COMPONENTS`（line 35-54）加一个 `a` 组件（识别 entity: 前缀）：
```tsx
  a: (props) => {
    const href = (props.href as string) || ''
    if (href.startsWith('entity:')) {
      return <EntityRef entityId={href.slice('entity:'.length)}>{props.children as React.ReactNode}</EntityRef>
    }
    return <a href={href} target="_blank" rel="noreferrer" className="text-[var(--ref-accent)] underline">{props.children as React.ReactNode}</a>
  },
```
把两处 `remarkPlugins={[remarkGfm]}`（line ~239 和 line ~295/318 流式分支）改为 `remarkPlugins={[remarkGfm, remarkEntityRef]}`。

- [ ] **Step 3b: 单段自由格式无段头**

`hasSections` 分支里（line ~191-209），把 `isChitChat` 判断扩展为"单段即无段头"：
```tsx
            // 单段（chit-chat 或 agent 自由格式）跳过 h3 段头：清爽 markdown
            const headerless = s.type === 'chit-chat' || sections.length === 1
```
把下面 `{!isChitChat && (` 改成 `{!headerless && (`（line ~205）。

- [ ] **Step 3c: 高亮 context 包裹 + 底部 cited_entities chips**

在组件 return 的最外层 `<div className="my-6 group">`（line 164）内容用 `HighlightCtx.Provider` 包裹。最简做法：在 `AssistantMessage` 函数体顶部加：
```tsx
  const [activeEntity, setActiveEntity] = useState<string | null>(null)
  const highlightValue = useMemo(() => ({ active: activeEntity, setActive: setActiveEntity }), [activeEntity])
```
把 return 的根 `<div className="my-6 group">...</div>` 整体包进：
```tsx
    <HighlightCtx.Provider value={highlightValue}>
      <div className="my-6 group">
        ...原有内容...
      </div>
    </HighlightCtx.Provider>
```
在内容区结束后、footer metrics 块（line ~333 `{!streaming && (`）**之前**，加 always-visible cited_entities chips：
```tsx
      {/* agent 引用溯源 chips（C-frontend，message 级，常驻可见）*/}
      {message.metadata?.cited_entities && message.metadata.cited_entities.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">本答案引用：</span>
          {message.metadata.cited_entities.map((id) => (
            <EntityChip key={id} entityId={id} />
          ))}
        </div>
      )}
```

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `npx vitest run src/components/chat/AssistantMessage.agent.test.tsx`
Expected: PASS
Run: `npx vitest run && npx tsc --noEmit`
Expected: 全绿 + 无类型错误（重点确认既有 AssistantMessage / chat store 测试不被破坏）

- [ ] **Step 5: 手动验证（light + dark 都过一遍，守前端宪法）**

`npm run dev`，造一条 agent 消息（或 mock）确认：thinking 折叠灰字、todo 三态图标色、内联引用可点高亮、底部 chips、单段无段头 markdown —— **切 light/dark 两主题都验对比度/可读性**。

- [ ] **Step 6: commit**

```bash
git add src/components/chat/AssistantMessage.tsx src/components/chat/AssistantMessage.agent.test.tsx
git commit -m "feat(chat): AssistantMessage 整合自由格式 + 内联引用 + cited_entities chips（agent 前端 Task6）"
```

---

## 完成定义（验收）

1. ✅ `chat.ts` 接 thinking/todo 事件 + done 读 cited_entities；类型加 `thinking?/todos?/TodoItem/DonePayload.cited_entities?`（源码不变量 + 类型测试）
2. ✅ 状态色 token（`--status-pending/progress/done` + `--ref-accent`）light+dark 双定义、dark 提亮（源码不变量测试）
3. ✅ `remarkEntityRef` 把 `[entity_id|文本]` 转引用、不误伤普通链接（真单测）
4. ✅ ThinkingBlock 灰字折叠（流式展开 / done 折叠）（RTL）
5. ✅ TodoList 三态 checklist，颜色走 token（RTL）
6. ✅ AssistantMessage：单段自由格式无段头 + 内联引用可点高亮 + 底部 cited_entities chips；多段结构化回归不破（RTL）
7. ✅ `npx vitest run` 全绿 + `npx tsc --noEmit` 无错；light/dark 手验

## 后续（不在本 Plan）
- 配合后端翻 `KE_QA_USE_REACT` 默认 ON → agent 带完整前端渲染正式上线（用户保留的独立决策）。
- 引用点击跳实体详情页（本期只做轻量高亮/复制）。
