# 业务问答 agent 化输出改造（前端）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端消费后端新增的 `render` 字段：把 agent 自由文本与"调用图渲染块"按到达顺序**内联交错**渲染；普通调查类 tool_call 收敛为低调可展开的"调查过程"，不再每个弹大卡片。

**Architecture:** SSE `tool_call` 事件可能带 `render`（后端姊妹计划产出）。chat store 把 `render` + 到达时 `raw_stream` 偏移 `at` 存到 tool_call 条目。纯函数 `buildAnswerSegments(rawStream, toolCalls)` 按 `at` 切分文本、插入 render 块得有序段。`AssistantMessage` 流式/最终分支据此渲染：文本段→ReactMarkdown、render 段→内联 `CallChainFlow`（复用点击跳源码/文件名 tab/方法置顶）、调查类→折叠组。

**Tech Stack:** React 18 / Zustand / vitest / ReactFlow（CallChainFlow 已有）。**前置依赖**：后端计划已部署、SSE `tool_call` 事件带 `render`。设计见 Obsidian [[业务问答-agent化输出改造-设计]] §5.3。

**约束**：light/dark 双主题（走 token，不硬编码色值）；Monaco/ReactFlow 实例类逻辑测试里被 stub 不可单测时沿用本仓库「源码不变量」房规（见 chat.test.ts / ChatPage.contextbar.test.tsx / MonacoSnippet.test.tsx）；设计文档 Obsidian 不双写；部署走 rsync（属部署步骤、需用户授权、本计划不自动部署）。

---

## 现状关键事实（实现前必读）

- `src/store/chat.ts` SSE parser：`case 'tool_call'`(L505-516) 把事件存进 `sm.tool_calls`（dict，key=tc.id，值含 starting/complete/name/arguments/result_preview）；`case 'token'`(L520-523) 把 delta 累加进 `sm.raw_stream`。
- `src/components/chat/AssistantMessage.tsx`：
  - tool_calls 渲染 L368-378（`ToolCallCard`，在答案**之前**、显眼）。
  - 流式分支 L474-538：`streaming && message.raw_stream` → `isJsonStream`(```json) 走 `extractStreamingSections`（6 段流），否则 L525+ 纯 `raw_stream` markdown。
  - `CallChainFlow` 在 hasSections 分支 L426（`<CallChainFlow data={chunk.data} theme={theme} />`）。
- agent 自由输出走"纯 raw_stream markdown"分支（非 isJsonStream）——这是本计划改造主战场。

---

## File Structure

- **Modify** `src/store/chat.ts` — `case 'tool_call'`：把事件的 `render` + 到达时 `raw_stream.length`（`at`）一起存进 tool_call 条目。
- **Create** `src/components/chat/buildAnswerSegments.ts` — 纯函数：`(rawStream, toolCalls) → Segment[]`（文本段 + render 块段，按 `at` 有序）。
- **Create** `src/components/chat/buildAnswerSegments.test.ts` — 纯函数单测。
- **Modify** `src/components/chat/AssistantMessage.tsx` — 流式 raw_stream 分支用有序段渲染（文本→ReactMarkdown、render→内联 CallChainFlow）；tool_calls 块（L368-378）改为只渲染调查类、收敛为折叠"调查过程"。
- **Test** `src/components/chat/AssistantMessage.tsx` 相关：`AssistantMessage.segments.test.tsx`（源码不变量 + 轻量断言）。

---

## Task 1: chat store 存 render + at 偏移

**Files:**
- Modify: `src/store/chat.ts`（`case 'tool_call'` L505-516）
- Test: `src/store/chat.test.ts`（追加源码不变量）

- [ ] **Step 1: 写失败测试（源码不变量，SSE parser 是闭包不可单测——沿用本文件既有房规）**

```ts
// 追加到 src/store/chat.test.ts
import { readFileSync } from 'node:fs'

describe('chat SSE tool_call 透传 render（agent 内联调用图）', () => {
  const src = readFileSync('src/store/chat.ts', 'utf-8')
  it("case 'tool_call' 把 render 与到达偏移 at 存进 tool_call 条目", () => {
    const i = src.indexOf("case 'tool_call':")
    const j = src.indexOf("case 'token':", i)
    const block = src.slice(i, j)
    expect(block).toContain('render')                 // 透传 render
    expect(block).toContain('raw_stream')             // 记录到达时 raw_stream 偏移（at）
    expect(block).toContain('at')
  })
})
```

Run: `npx vitest run src/store/chat.test.ts` → 新例 FAIL

- [ ] **Step 2: 实现**

读 `chat.ts` L505-516 的 `case 'tool_call'`，在写入 tool_call 条目时带上 `render`（来自事件 data）和 `at`（当前 `sm.raw_stream` 长度，记录渲染块该插在文本何处）：

```ts
            case 'tool_call': {
              updateStream(sm => {
                const tcs = { ...(sm.tool_calls || {}) }
                const id = data.id as string
                const prev = tcs[id] || {}
                tcs[id] = {
                  ...prev,
                  name: data.name,
                  phase: data.phase,
                  arguments: data.arguments ?? prev.arguments,
                  result_preview: data.result_preview ?? prev.result_preview,
                  // 渲染类工具：带 render（图数据）+ 记录到达时文本偏移 at（用于有序段内联）
                  ...(data.render != null
                    ? { render: data.render, at: (sm.raw_stream || '').length }
                    : {}),
                }
                return { ...sm, tool_calls: tcs }
              })
              break
            }
```

> 若现有 `case 'tool_call'` 结构与上不同，按实际字段合并，关键是新增 `render` 与 `at` 两个字段；`Message` / tool_call 类型定义（`src/types/*`）相应补 `render?: { kind: string; data: unknown }` 与 `at?: number`。

Run: `npx vitest run src/store/chat.test.ts` → PASS

- [ ] **Step 3: Commit**

```bash
git add src/store/chat.ts src/store/chat.test.ts src/types
git commit -m "feat(chat): SSE tool_call 透传 render + 记录到达偏移 at（内联调用图）"
```

---

## Task 2: buildAnswerSegments 纯函数（有序段）

**Files:**
- Create: `src/components/chat/buildAnswerSegments.ts`
- Test: `src/components/chat/buildAnswerSegments.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/components/chat/buildAnswerSegments.test.ts
import { describe, it, expect } from 'vitest'
import { buildAnswerSegments } from './buildAnswerSegments'

const tc = (over: Record<string, unknown>) => ({ name: 'x', phase: 'complete', ...over })

describe('buildAnswerSegments', () => {
  it('无 render → 单个文本段', () => {
    expect(buildAnswerSegments('你好世界', {})).toEqual([{ kind: 'text', content: '你好世界' }])
  })

  it('一个 render 块按 at 偏移把文本切两段、中间插图', () => {
    const raw = '先看调用关系：后面继续说明。'   // at=7（"先看调用关系：".length）
    const tcs = { a: tc({ render: { kind: 'call_graph', data: { nodes: [], edges: [] } }, at: 7 }) }
    const segs = buildAnswerSegments(raw, tcs)
    expect(segs[0]).toEqual({ kind: 'text', content: '先看调用关系：' })
    expect(segs[1].kind).toBe('render')
    expect((segs[1] as { data: unknown }).data).toEqual({ nodes: [], edges: [] })
    expect(segs[2]).toEqual({ kind: 'text', content: '后面继续说明。' })
  })

  it('多个 render 按 at 升序插入；空文本段被丢弃', () => {
    const raw = 'AB'
    const tcs = {
      a: tc({ render: { kind: 'call_graph', data: { n: 1 } }, at: 0 }),  // 开头
      b: tc({ render: { kind: 'call_graph', data: { n: 2 } }, at: 2 }),  // 结尾
    }
    const segs = buildAnswerSegments(raw, tcs)
    // 开头 render（at=0，前面无文本，不产空文本段）→ 文本 'AB' → render（at=2）
    expect(segs.map(s => s.kind)).toEqual(['render', 'text', 'render'])
  })

  it('调查类 tool_call（无 render）不进段序列', () => {
    const tcs = { a: tc({ name: 'ke_search', result_preview: '...' }) }
    expect(buildAnswerSegments('正文', tcs)).toEqual([{ kind: 'text', content: '正文' }])
  })
})
```

Run: `npx vitest run src/components/chat/buildAnswerSegments.test.ts` → FAIL

- [ ] **Step 2: 实现**

```ts
// src/components/chat/buildAnswerSegments.ts
// 把"自由文本 raw_stream + 带 render 的 tool_calls"编排成有序段：
// 文本段与渲染块段按 render 的到达偏移 at 交错（agent 先说几句→插调用图→再接着说）。
// 设计 [[业务问答-agent化输出改造-设计]] §5.3。

/** 渲染块（目前仅 call_graph，未来可扩 table 等）。 */
export interface RenderBlock {
  kind: string          // 'call_graph' | ...
  data: unknown         // CallChainFlow 等组件直接消费
}

/** 一个 tool_call 条目（只取本函数关心的字段）。 */
interface ToolCallEntry {
  render?: RenderBlock | null
  at?: number           // 到达时 raw_stream 偏移（render 块插入位置）
}

/** 有序段：文本段 或 渲染块段。 */
export type AnswerSegment =
  | { kind: 'text'; content: string }
  | { kind: 'render'; data: unknown; renderKind: string }

/**
 * 按 render 的 at 偏移，把 rawStream 切成文本段并交错插入渲染块。
 *
 * @param rawStream agent 自由输出累计文本
 * @param toolCalls message.tool_calls（dict，key=tool_call id）
 * @returns 有序段列表（文本段空串会被丢弃）
 */
export function buildAnswerSegments(
  rawStream: string,
  toolCalls: Record<string, ToolCallEntry> | null | undefined,
): AnswerSegment[] {
  const text = rawStream || ''
  // 收集带 render 的渲染点：{at, block}；按 at 升序（同 at 按插入序稳定）
  const renders = Object.values(toolCalls || {})
    .filter((tc): tc is ToolCallEntry & { render: RenderBlock } => tc.render != null)
    .map(tc => ({ at: Math.max(0, Math.min(tc.at ?? text.length, text.length)), block: tc.render }))
    .sort((a, b) => a.at - b.at)

  // 无渲染点 → 单文本段（空串也返回一个空文本段，调用方可据需处理）
  if (renders.length === 0) return [{ kind: 'text', content: text }]

  const segs: AnswerSegment[] = []
  let cursor = 0
  // 在每个渲染点切一刀：先 push [cursor, at) 文本段（非空才 push），再 push 渲染块
  for (const r of renders) {
    const chunk = text.slice(cursor, r.at)
    if (chunk) segs.push({ kind: 'text', content: chunk })
    segs.push({ kind: 'render', data: r.block.data, renderKind: r.block.kind })
    cursor = r.at
  }
  // 收尾：最后一个渲染点之后的剩余文本
  const tail = text.slice(cursor)
  if (tail) segs.push({ kind: 'text', content: tail })
  return segs
}
```

Run: `npx vitest run src/components/chat/buildAnswerSegments.test.ts` → PASS（4 例）

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/buildAnswerSegments.ts src/components/chat/buildAnswerSegments.test.ts
git commit -m "feat(chat): buildAnswerSegments 有序段（文本+render 块按 at 交错）"
```

---

## Task 3: AssistantMessage 流式分支用有序段 + 调查类收敛

**Files:**
- Modify: `src/components/chat/AssistantMessage.tsx`（tool_calls 块 L368-378；纯 raw_stream 流式分支 L525+）
- Test: `src/components/chat/AssistantMessage.segments.test.tsx`

- [ ] **Step 1: 写失败测试（源码不变量 + 轻量）**

```tsx
// src/components/chat/AssistantMessage.segments.test.tsx
// AssistantMessage 整页 render 依赖 ReactFlow/Markdown 插件链，过脆；沿用源码不变量手法
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/components/chat/AssistantMessage.tsx', 'utf-8')

describe('AssistantMessage 有序段内联渲染', () => {
  it('import 了 buildAnswerSegments', () => {
    expect(src).toContain("buildAnswerSegments")
  })
  it('纯文本流式分支用 buildAnswerSegments 渲染（render 段走 CallChainFlow 内联）', () => {
    // 渲染块分支：renderKind==='call_graph' → CallChainFlow
    expect(src).toContain("'call_graph'")
    expect(src).toContain('CallChainFlow')
  })
  it('调查类 tool_calls 收敛（不再无条件每个 ToolCallCard）', () => {
    // 过滤掉带 render 的（那些走内联），只把调查类放进折叠组
    expect(src).toMatch(/render\s*==\s*null|!.*\.render|filter.*render/)
  })
})
```

Run: `npx vitest run src/components/chat/AssistantMessage.segments.test.tsx` → FAIL

- [ ] **Step 2: 实现 —— 纯 raw_stream 流式分支改有序段**

在 import 区加：`import { buildAnswerSegments } from './buildAnswerSegments'`。

把 L525+ 的"纯 raw_stream markdown"渲染（非 isJsonStream 分支）改为有序段：

```tsx
          // 自由 markdown（agent 默认输出）：按有序段渲染——文本段 markdown 逐字流、
          // render 段（调用图）内联 CallChainFlow（复用点击跳源码/文件名tab/方法置顶）
          const segments = buildAnswerSegments(raw, message.tool_calls)
          return (
            <div className={MD_PROSE_STREAM}>
              {segments.map((seg, i) =>
                seg.kind === 'render' && seg.renderKind === 'call_graph' ? (
                  <CallChainFlow key={`r${i}`} data={seg.data} theme={theme} />
                ) : seg.kind === 'text' ? (
                  <ReactMarkdown key={`t${i}`} {...MD_REMARK_PROPS}>{seg.content}</ReactMarkdown>
                ) : null,
              )}
              {streaming && <span className="ml-0.5 animate-pulse">▌</span>}
            </div>
          )
```

> 最终态（非 streaming）的纯文本分支同理用 segments（保证完成后图仍内联在原位）。若最终态走 hasSections（agent 极少产 JSON），保持原 hasSections 分支不变。

- [ ] **Step 3: 实现 —— 调查类 tool_calls 收敛**

把 L368-378 的 tool_calls 渲染块改为：**只渲染调查类**（无 render 的），且收敛成一条可展开"调查过程"，render 类不在这里渲染（它们已在有序段内联）：

```tsx
      {/* 调查过程（调查类工具）：收敛为一条低调可展开行；渲染类工具不在此（已内联进答案） */}
      {(() => {
        const calls = Object.entries(message.tool_calls || {}).filter(([, tc]) => tc.render == null)
        if (calls.length === 0) return null
        return (
          <details className="mb-2 text-[12px] text-muted-foreground">
            <summary className="cursor-pointer select-none">调查过程（看了 {calls.length} 处）</summary>
            <div className="mt-1 space-y-1">
              {calls.map(([id, tc]) => (
                <ToolCallCard key={id} starting={tc.starting} complete={tc.complete} />
              ))}
            </div>
          </details>
        )
      })()}
```

> light/dark：`text-muted-foreground` 是 token，双主题自适应；不引入裸色值。

Run: `npx vitest run src/components/chat/AssistantMessage.segments.test.tsx` → PASS

- [ ] **Step 4: chat 组件全量回归 + build**

Run: `npx vitest run src/components/chat/ src/store/chat.test.ts && npm run build`
Expected: 全绿 + built ✓（注意 ToolCallCard props 若与现用法不同，按实际签名传参）

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/AssistantMessage.tsx src/components/chat/AssistantMessage.segments.test.tsx
git commit -m "feat(chat): agent 自由输出有序段内联渲染（调用图内联 + 调查类收敛）"
```

---

## Task 4（部署，需用户授权，不自动执行）

- [ ] `npm run build` → rsync `dist/` 到 `/opt/knowledge-engineering-web-dist`（备份 + `--delete`）。**需用户显式授权**（沿用本会话部署惯例：备份 dist.bak → rsync → 验证 chunk 完整 + no-cache）。
- [ ] 浏览器 E2E：问一个涉及调用关系的问题，确认 agent 自由文本 + 内联调用图（可点击跳源码）+ 调查过程折叠；问一个简单问题确认无多余图、秒答。

---

## 自检（spec 覆盖 / 占位 / 类型一致性）

- spec §5.3 有序段内联 → Task 2（buildAnswerSegments）+ Task 3（渲染）✓
- spec §5.4 调查类收敛 → Task 3 Step 3 ✓
- spec §5.2 render 消费 → Task 1（store 存 render+at）→ Task 2/3（渲染）✓
- 类型一致：`render={kind,data}` + `at` 在 Task1 存、Task2 读（ToolCallEntry）、Task3 用（renderKind==='call_graph'→CallChainFlow）一致 ✓
- 前置依赖：后端姊妹计划 `2026-06-04-qa-agent-free-output-backend.md` 已部署、SSE 带 render（否则本计划无数据可渲染——Task 3 仍向后兼容：无 render 时 segments 退化为单文本段）。
- 注：`message.tool_calls` 在 6 段历史消息上也可能存在；buildAnswerSegments 只在"纯 raw_stream 流式/最终文本分支"调用，不影响 hasSections 分支。
