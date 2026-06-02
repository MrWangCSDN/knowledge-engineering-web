# 代码片段查看器（前端）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (推荐) 或 superpowers:executing-plans。Steps 用 checkbox（`- [ ]`）。

**Goal:** QA 答案里的代码实体（行内引用 / 底部引用 chip / 入口方法）可点击 → 打开右侧 Monaco 代码片段抽屉；片段内的方法调用处可点击 → 跳到目标方法片段（IDE 式 go-to-definition）。

**Architecture:** 新增 Zustand `codeViewer` store（持有 projectId + tabs + 当前激活实体）；`openEntity(entityId)` 调后端 `GET /api/projects/{pid}/code-snippet` 拉片段；`CodeViewerDrawer` 用懒加载的 `@monaco-editor/react` 渲染片段，按后端给的 callees(line/col) 在编辑器里加可点击装饰，点击 → `openEntity(callee.entity_id)`。EntityRef/EntityChip onClick 接 openEntity。

**Tech Stack:** React 19 · Vite · TS · Zustand · Tailwind v4 `@theme` oklch token · vitest · @monaco-editor/react（新依赖，懒加载）。

**设计 spec（已审批）:** `/Users/java/obsidian/01 Engineering/knowledge-engineering/代码片段查看器-设计.md`（§3 契约 / §5 组件 / §6 数据流 / §7 降级 / §9 范围）

**后端契约（已上线生产 167eae1，实测通过）:** `GET /api/projects/{pid}/code-snippet?entity_id=` → `{entity_id, qualified_name, kind, file_path, language, start_line, end_line, code, callees:[{entity_id,name,line,col}], callers:[{entity_id,name}]}`。callees 的 `line` 是**文件绝对行**（前端按 `line - start_line + 1` 换算到片段内 1-indexed 行）；`col` 是 **0-indexed**（Monaco 列号 1-indexed → `col + 1`）；`col`/`line` 可能为 `null`。未知实体 → 404。

**用户偏好 / 前端宪法:** TS/React + 中文注释；**light/dark 双主题都要达标、禁硬编码色值走 token**；Monaco 主题随 app 主题切换；设计文档 Obsidian 不双写。

**探索已确认的事实（实现照此）:**
- `src/api/client.ts`：`export const apiClient`（axios，baseURL `/api`，withCredentials，自动注入 Bearer + 401 refresh + 503 infra）。新 api 模块 `import { apiClient } from './client'`。
- `src/types/chat.ts`：`Reference {entity_id, display_text, kind}`、`Section`、`SectionType` 等。新 CodeSnippet 类型放新文件 `src/types/codeSnippet.ts`（避免污染 chat.ts）。
- `src/store/chat.ts`：Zustand 范式 `export const useChatStore = create<T>((set, get) => ({...}))`（vanilla，无 immer）。
- `src/components/chat/EntityRef.tsx`：`EntityRef({entityId, children})`（行内 button）+ `EntityChip({entityId})`（底部 chip）；二者 onClick 现为 `setActive(...) + navigator.clipboard.writeText(entityId)`；用 `useContext(HighlightCtx)`；色走 `--ref-accent` token。
- `src/components/chat/AssistantMessage.tsx`：`MD_COMPONENTS.a`（L80-86）把 `entity:` scheme link → `<EntityRef>`；组件有 `projectId` prop（L272）；用 `useThemeStore(s => s.theme)` 取 'light'|'dark'；section.references 渲染成 chip（用 `EntityChip` 或纯 span，见 T5 定位）。
- `src/pages/ChatPage.tsx`：`const { projectId, sessionId } = useParams<{projectId: string, sessionId?: string}>()`；底部输入坞渲染 `<ContextWindowBar/>` + `<ChatInput>`（"有消息"分支）。
- `src/index.css`：`@custom-variant dark (&:where(.dark, .dark *))`；token 在 `:root`（light）+ `.dark`（暗）双档定义、`@theme inline` 注册；已有 `--ref-accent: oklch(0.55 0.17 250)`（light）。主题切换 = `<html class="dark">`。
- `src/store/theme.ts`：`useThemeStore(s => s.theme)` → 'light'|'dark'。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `package.json` | 加 `@monaco-editor/react` 依赖 | Modify |
| `src/types/codeSnippet.ts` | CodeSnippet / CalleeRef / CallerRef 类型 | Create |
| `src/api/codeSnippets.ts` | `getCodeSnippet(projectId, entityId)` | Create |
| `src/store/codeViewer.ts` | Zustand：projectId + tabs + openEntity/switchTab/closeTab/close/setProject | Create |
| `src/components/code/calleeDecorations.ts` | `computeCalleeDecorations` 纯函数（换算） | Create |
| `src/components/code/MonacoSnippet.tsx` | Monaco 渲染片段 + 调用点装饰 + 点击跳转 + 降级 | Create |
| `src/components/code/CodeViewerDrawer.tsx` | 右侧抽屉 + Tab 栏 + callers 侧栏 | Create |
| `src/components/chat/EntityRef.tsx` | EntityRef/EntityChip onClick 接 openEntity | Modify |
| `src/components/chat/AssistantMessage.tsx` | 底部 references chip 用 EntityChip（可点击） | Modify |
| `src/pages/ChatPage.tsx` | 挂 CodeViewerDrawer + setProject(projectId) | Modify |
| `src/index.css` | `.cs-callee` 装饰 CSS（走 --ref-accent token，light/dark 自动） | Modify |
| 对应 `*.test.ts(x)` | 各单测 | Create |

---

## Task 1：依赖 + 类型 + API client

**Files:** Modify `package.json`；Create `src/types/codeSnippet.ts`、`src/api/codeSnippets.ts`、`src/api/codeSnippets.test.ts`

- [ ] **Step 1: 装依赖**

Run: `cd /Users/java/knowledge-engineering-web && npm install @monaco-editor/react`
Expected: package.json 出现 `@monaco-editor/react`，无错误。

- [ ] **Step 2: 创建类型 `src/types/codeSnippet.ts`**

```ts
// src/types/codeSnippet.ts
// 代码片段查看器：后端 GET /code-snippet 的响应类型。设计 [[代码片段查看器-设计]] §3。

/** 调用点（callee）：方法体内一次方法调用 + 其位置。line/col 可能为 null。 */
export interface CalleeRef {
  entity_id: string          // 目标方法的持久 key（可回传 openEntity 实现跳转）
  name: string               // 目标方法短名（用于装饰范围 + 展示）
  line: number | null        // 调用点所在**文件绝对行**（1-indexed）；null 表示无行号
  col: number | null         // 调用点列号（**0-indexed**）；null 表示无列号
}

/** 调用者（caller）：谁调用了当前实体（反向导航，无位置）。 */
export interface CallerRef {
  entity_id: string
  name: string
}

/** GET /code-snippet 的完整响应。 */
export interface CodeSnippet {
  entity_id: string
  qualified_name: string
  kind: string               // 'method' | 'class' | ...
  file_path: string
  language: string           // 'java' | 'xml' | ... | 'plaintext'
  start_line: number         // 片段在文件中的起止行（1-indexed，含）
  end_line: number
  code: string               // 片段源码（可能为空串）
  callees: CalleeRef[]       // 片段内调用点（不去重，逐个可点击）
  callers: CallerRef[]       // 反向导航列表
}
```

- [ ] **Step 3: 写失败测试 `src/api/codeSnippets.test.ts`**

```ts
// src/api/codeSnippets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './client'
import { getCodeSnippet } from './codeSnippets'

describe('getCodeSnippet', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('打到正确 URL + query 并返回 data', async () => {
    const fake = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [] }
    // mock apiClient.get：返回 axios 风格 {data}
    const spy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: fake } as never)
    const out = await getCodeSnippet('mall-swarm', 'A::m#()')
    expect(spy).toHaveBeenCalledWith(
      '/projects/mall-swarm/code-snippet',
      { params: { entity_id: 'A::m#()' } },
    )
    expect(out).toBe(fake)
  })
})
```

- [ ] **Step 4: 运行确认失败**

Run: `npx vitest run src/api/codeSnippets.test.ts`
Expected: FAIL（`./codeSnippets` 不存在）

- [ ] **Step 5: 实现 `src/api/codeSnippets.ts`**

```ts
// src/api/codeSnippets.ts
// 代码片段查看器 API：按 entity_id 取片段。复用全局 apiClient（自动鉴权）。设计 [[代码片段查看器-设计]] §3。
import { apiClient } from './client'
import type { CodeSnippet } from '@/types/codeSnippet'

/**
 * 取某实体的代码片段 + callees(带调用点) + callers。
 * @param projectId 工程 id（URL path）
 * @param entityId  实体持久 key（query 参数 entity_id）
 * @returns CodeSnippet；404 时 apiClient 抛 AxiosError（调用方/ store 处理）
 */
export async function getCodeSnippet(projectId: string, entityId: string): Promise<CodeSnippet> {
  // encodeURIComponent 防 projectId 含特殊字符破坏 path；entity_id 走 params 由 axios 自动 encode
  const resp = await apiClient.get<CodeSnippet>(
    `/projects/${encodeURIComponent(projectId)}/code-snippet`,
    { params: { entity_id: entityId } },
  )
  return resp.data
}
```

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run src/api/codeSnippets.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add package.json package-lock.json src/types/codeSnippet.ts src/api/codeSnippets.ts src/api/codeSnippets.test.ts
git commit -m "feat(code-viewer): add @monaco-editor/react dep + CodeSnippet types + getCodeSnippet API

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2：codeViewer store（Zustand）

**Files:** Create `src/store/codeViewer.ts`、`src/store/codeViewer.test.ts`

- [ ] **Step 1: 写失败测试 `src/store/codeViewer.test.ts`**

```ts
// src/store/codeViewer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCodeViewerStore } from './codeViewer'
import * as api from '@/api/codeSnippets'

const reset = () => useCodeViewerStore.setState({ projectId: null, open: false, tabs: [], activeEntityId: null })

describe('codeViewer store', () => {
  beforeEach(() => { reset(); vi.restoreAllMocks() })

  it('openEntity 拉片段、开抽屉、建 tab、激活', async () => {
    const snip = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [], qualified_name: 'A::m', kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1 }
    vi.spyOn(api, 'getCodeSnippet').mockResolvedValue(snip as never)
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('A::m#()')
    const s = useCodeViewerStore.getState()
    expect(s.open).toBe(true)
    expect(s.activeEntityId).toBe('A::m#()')
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0].snippet).toBe(snip)
    expect(s.tabs[0].loading).toBe(false)
  })

  it('无 projectId 时 openEntity 不动作', async () => {
    const spy = vi.spyOn(api, 'getCodeSnippet').mockResolvedValue({} as never)
    await useCodeViewerStore.getState().openEntity('A::m#()')
    expect(spy).not.toHaveBeenCalled()
    expect(useCodeViewerStore.getState().open).toBe(false)
  })

  it('重复 openEntity 复用已有 tab（不重复拉取）', async () => {
    const snip = { entity_id: 'A::m#()', code: 'x', callees: [], callers: [], qualified_name: 'A::m', kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1 }
    const spy = vi.spyOn(api, 'getCodeSnippet').mockResolvedValue(snip as never)
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('A::m#()')
    useCodeViewerStore.getState().close()
    await useCodeViewerStore.getState().openEntity('A::m#()')   // 第二次
    expect(spy).toHaveBeenCalledTimes(1)                         // 只拉一次
    expect(useCodeViewerStore.getState().open).toBe(true)       // 重新打开
  })

  it('404 → tab 带 error', async () => {
    vi.spyOn(api, 'getCodeSnippet').mockRejectedValue({ response: { status: 404 } })
    useCodeViewerStore.getState().setProject('mall-swarm')
    await useCodeViewerStore.getState().openEntity('Ghost::x#()')
    const t = useCodeViewerStore.getState().tabs[0]
    expect(t.loading).toBe(false)
    expect(t.error).toBe('未找到该实体的源码')
  })

  it('closeTab 移除 tab；移除激活 tab 时回退到最后一个；空则关抽屉', async () => {
    const mk = (id: string) => ({ entityId: id, snippet: null, loading: false, error: null })
    useCodeViewerStore.setState({ open: true, tabs: [mk('a'), mk('b')], activeEntityId: 'b', projectId: 'p' })
    useCodeViewerStore.getState().closeTab('b')
    expect(useCodeViewerStore.getState().activeEntityId).toBe('a')
    useCodeViewerStore.getState().closeTab('a')
    expect(useCodeViewerStore.getState().tabs).toHaveLength(0)
    expect(useCodeViewerStore.getState().open).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/codeViewer.test.ts`
Expected: FAIL（store 不存在）

- [ ] **Step 3: 实现 `src/store/codeViewer.ts`**

```ts
// src/store/codeViewer.ts
// 代码片段查看器状态：持有当前 projectId + 打开的 tabs + 激活实体。设计 [[代码片段查看器-设计]] §5/§6。
// 设计选择：tab 即导航模型——openEntity 复用/新建 tab 并激活；点击片段内调用点 = openEntity(callee)。
import { create } from 'zustand'
import { getCodeSnippet } from '@/api/codeSnippets'
import type { CodeSnippet } from '@/types/codeSnippet'

/** 一个已打开的实体片段 tab。snippet=null 表示加载中/失败。 */
export interface ViewerTab {
  entityId: string
  snippet: CodeSnippet | null
  loading: boolean
  error: string | null
}

interface CodeViewerState {
  projectId: string | null       // 当前工程（ChatPage 进入时 setProject 注入；openEntity 用它拼 URL）
  open: boolean                  // 抽屉是否打开
  tabs: ViewerTab[]              // 已打开的实体片段
  activeEntityId: string | null  // 当前激活 tab 的 entityId
  setProject: (projectId: string) => void
  openEntity: (entityId: string) => Promise<void>
  switchTab: (entityId: string) => void
  closeTab: (entityId: string) => void
  close: () => void
}

export const useCodeViewerStore = create<CodeViewerState>((set, get) => ({
  projectId: null,
  open: false,
  tabs: [],
  activeEntityId: null,

  // ChatPage 挂载/切工程时调用，注入当前工程 id
  setProject: (projectId) => set({ projectId }),

  // 打开一个实体的片段：复用已有 tab，或新建 tab 并拉取
  openEntity: async (entityId) => {
    const { projectId, tabs } = get()
    if (!projectId) return                                  // 没工程上下文 → 不动作（防御）
    // 已有该 tab → 直接激活 + 打开抽屉（不重复拉取）
    if (tabs.some(t => t.entityId === entityId)) {
      set({ open: true, activeEntityId: entityId })
      return
    }
    // 新 tab：先插一个 loading 占位（抽屉立即可见、不闪）
    set({ open: true, activeEntityId: entityId, tabs: [...tabs, { entityId, snippet: null, loading: true, error: null }] })
    try {
      const snippet = await getCodeSnippet(projectId, entityId)
      // set 用函数式读最新 tabs（拉取期间可能有其它 tab 变化）
      set(s => ({ tabs: s.tabs.map(t => t.entityId === entityId ? { ...t, snippet, loading: false } : t) }))
    } catch (e) {
      // 404 → 友好"未找到"，其余 → 通用失败（设计 §7）
      const status = (e as { response?: { status?: number } })?.response?.status
      const msg = status === 404 ? '未找到该实体的源码' : '加载代码片段失败'
      set(s => ({ tabs: s.tabs.map(t => t.entityId === entityId ? { ...t, loading: false, error: msg } : t) }))
    }
  },

  switchTab: (entityId) => set({ activeEntityId: entityId }),

  // 关一个 tab：若关的是激活 tab，回退到最后一个；tabs 空则顺手关抽屉
  closeTab: (entityId) => set(s => {
    const tabs = s.tabs.filter(t => t.entityId !== entityId)
    const activeEntityId = s.activeEntityId === entityId
      ? (tabs.length ? tabs[tabs.length - 1].entityId : null)
      : s.activeEntityId
    return { tabs, activeEntityId, open: tabs.length > 0 ? s.open : false }
  }),

  close: () => set({ open: false }),
}))
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/codeViewer.test.ts`
Expected: PASS（5 测试）

- [ ] **Step 5: 提交**

```bash
git add src/store/codeViewer.ts src/store/codeViewer.test.ts
git commit -m "feat(code-viewer): codeViewer Zustand store (projectId + tabs + openEntity)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3：调用点装饰换算（纯函数）+ MonacoSnippet 组件 + 装饰 CSS

**Files:** Create `src/components/code/calleeDecorations.ts`、`src/components/code/calleeDecorations.test.ts`、`src/components/code/MonacoSnippet.tsx`、`src/components/code/MonacoSnippet.test.tsx`；Modify `src/index.css`

- [ ] **Step 1: 写失败测试 `src/components/code/calleeDecorations.test.ts`**

```ts
// src/components/code/calleeDecorations.test.ts
import { describe, it, expect } from 'vitest'
import { computeCalleeDecorations } from './calleeDecorations'
import type { CalleeRef } from '@/types/codeSnippet'

const C = (over: Partial<CalleeRef>): CalleeRef => ({ entity_id: 'X::y#()', name: 'y', line: 5, col: 8, ...over })

describe('computeCalleeDecorations', () => {
  it('文件绝对行换算到片段内行 + col 0→1-indexed + 覆盖方法名长度', () => {
    const r = computeCalleeDecorations([C({ line: 104, col: 8, name: 'confirmReceiveOrder' })], 100)
    expect(r).toEqual([{
      entityId: 'X::y#()', startLineNumber: 5, startColumn: 9,         // 104-100+1=5；col8→9
      endLineNumber: 5, endColumn: 9 + 'confirmReceiveOrder'.length, wholeLine: false,
    }])
  })

  it('col 为 null → 整行高亮（wholeLine）', () => {
    const r = computeCalleeDecorations([C({ line: 102, col: null, name: 'foo' })], 100)
    expect(r[0].wholeLine).toBe(true)
    expect(r[0].startLineNumber).toBe(3)
  })

  it('line 为 null → 跳过（无法定位）', () => {
    expect(computeCalleeDecorations([C({ line: null })], 100)).toEqual([])
  })

  it('换算后行 < 1（脏数据）→ 跳过', () => {
    expect(computeCalleeDecorations([C({ line: 50 })], 100)).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/code/calleeDecorations.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/components/code/calleeDecorations.ts`**

```ts
// src/components/code/calleeDecorations.ts
// 把后端 callees（文件绝对行 + 0-indexed col）换算成 Monaco 装饰范围（片段内 1-indexed 行 + 1-indexed col）。
// 纯函数，便于单测；MonacoSnippet 据此 deltaDecorations。设计 [[代码片段查看器-设计]] §5。
import type { CalleeRef } from '@/types/codeSnippet'

/** 一个调用点的装饰范围（Monaco 坐标，1-indexed）。 */
export interface CalleeDecoration {
  entityId: string           // 点击跳转目标
  startLineNumber: number    // 片段内行（1-indexed）
  startColumn: number        // 1-indexed
  endLineNumber: number
  endColumn: number
  wholeLine: boolean         // col 缺失 → 整行高亮兜底（设计 §7）
}

/**
 * @param callees   后端返回的调用点（line 文件绝对行 1-indexed、col 0-indexed，可能 null）
 * @param startLine 片段在文件中的起始行（1-indexed）
 * @returns 片段内可点击装饰范围列表（跳过无 line / 越界的项）
 */
export function computeCalleeDecorations(callees: CalleeRef[], startLine: number): CalleeDecoration[] {
  const out: CalleeDecoration[] = []
  for (const c of callees) {
    if (c.line == null) continue                  // 无行号无法在片段里定位 → 跳过
    const sLine = c.line - startLine + 1           // 文件绝对行 → 片段内 1-indexed 行
    if (sLine < 1) continue                        // 脏数据（调用点在片段起始之前）→ 跳过
    if (c.col == null) {
      // col 缺失：整行高亮兜底（仍可点击跳转）
      out.push({ entityId: c.entity_id, startLineNumber: sLine, startColumn: 1, endLineNumber: sLine, endColumn: 1, wholeLine: true })
    } else {
      const startColumn = c.col + 1                // CodeGraph 0-indexed col → Monaco 1-indexed
      const endColumn = startColumn + (c.name?.length ?? 0)   // 覆盖方法名长度
      out.push({ entityId: c.entity_id, startLineNumber: sLine, startColumn, endLineNumber: sLine, endColumn, wholeLine: false })
    }
  }
  return out
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/components/code/calleeDecorations.test.ts`
Expected: PASS（4 测试）

- [ ] **Step 5: 加装饰 CSS token（`src/index.css`）**

在 `:root` 段不需新增颜色（复用 `--ref-accent`）。在 index.css 任意全局段（如文件末尾的工具类区）加 `.cs-callee` 类（走 token、light/dark 自动）：
```css
/* 代码片段查看器：调用点可点击装饰（下划线 + 手型）。颜色走 --ref-accent（已 light/dark 双档）。 */
.cs-callee {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  cursor: pointer;
  color: var(--ref-accent);
}
.cs-callee-line {                /* col 缺失时整行兜底高亮 */
  background: color-mix(in oklch, var(--ref-accent) 12%, transparent);
  cursor: pointer;
}
```

- [ ] **Step 6: 写失败测试 `src/components/code/MonacoSnippet.test.tsx`**（Monaco 走 mock）

```tsx
// src/components/code/MonacoSnippet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// mock @monaco-editor/react：渲染一个带 code 文本的 div，避免在 jsdom 里跑真实编辑器
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>,
  loader: { config: vi.fn() },
}))

import { MonacoSnippet } from './MonacoSnippet'
import type { CodeSnippet } from '@/types/codeSnippet'

const snip = (over: Partial<CodeSnippet> = {}): CodeSnippet => ({
  entity_id: 'A::m#()', qualified_name: 'A::m', kind: 'method', file_path: 'A.java',
  language: 'java', start_line: 1, end_line: 2, code: 'line1\nline2', callees: [], callers: [], ...over,
})

describe('MonacoSnippet', () => {
  it('渲染 code 到 Monaco', () => {
    render(<MonacoSnippet snippet={snip()} theme="light" />)
    expect(screen.getByTestId('monaco')).toHaveTextContent('line1')
  })

  it('snippet=null + loading → 显示加载态', () => {
    render(<MonacoSnippet snippet={null} loading theme="dark" />)
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('error → 显示错误文案', () => {
    render(<MonacoSnippet snippet={null} error="未找到该实体的源码" theme="light" />)
    expect(screen.getByText('未找到该实体的源码')).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: 运行确认失败**

Run: `npx vitest run src/components/code/MonacoSnippet.test.tsx`
Expected: FAIL（组件不存在）

- [ ] **Step 8: 实现 `src/components/code/MonacoSnippet.tsx`**

```tsx
// src/components/code/MonacoSnippet.tsx
// 用 Monaco 渲染一段代码片段，并把后端给的 callees 调用点标成可点击装饰，点击 → openEntity 跳转。
// 设计 [[代码片段查看器-设计]] §5。Monaco 懒加载（@monaco-editor/react 内部 lazy）。
import { useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { CodeSnippet } from '@/types/codeSnippet'
import { computeCalleeDecorations } from './calleeDecorations'
import { useCodeViewerStore } from '@/store/codeViewer'

interface Props {
  snippet: CodeSnippet | null
  loading?: boolean
  error?: string | null
  theme: 'light' | 'dark'
}

export function MonacoSnippet({ snippet, loading = false, error = null, theme }: Props) {
  const openEntity = useCodeViewerStore(s => s.openEntity)
  // 存装饰范围 → entityId 的映射，onMouseDown 时按点击位置查目标
  const decoRef = useRef<{ start: { l: number; c: number }; end: { l: number; c: number }; entityId: string }[]>([])

  // 加载/错误/空态：不渲染 Monaco（也作为 Monaco 懒加载失败的兜底位）
  if (loading) return <div className="p-4 text-sm text-muted-foreground">加载中…</div>
  if (error) return <div className="p-4 text-sm text-[var(--destructive)]">{error}</div>
  if (!snippet) return null

  // Monaco 挂载后：加调用点装饰 + 注册点击跳转
  const handleMount: OnMount = (editor, monaco) => {
    const decos = computeCalleeDecorations(snippet.callees, snippet.start_line)
    decoRef.current = decos.map(d => ({
      start: { l: d.startLineNumber, c: d.startColumn }, end: { l: d.endLineNumber, c: d.endColumn }, entityId: d.entityId,
    }))
    // deltaDecorations：给每个调用点范围加 inlineClassName（.cs-callee）
    editor.deltaDecorations([], decos.map(d => ({
      range: new monaco.Range(d.startLineNumber, d.startColumn, d.endLineNumber, d.wholeLine ? d.startColumn : d.endColumn),
      options: d.wholeLine
        ? { isWholeLine: true, className: 'cs-callee-line' }
        : { inlineClassName: 'cs-callee' },
    })))
    // 点击：命中某调用点范围 → openEntity 跳转（新 tab）
    editor.onMouseDown((e: { target: { position: { lineNumber: number; column: number } | null } }) => {
      const pos = e.target.position
      if (!pos) return
      const hit = decoRef.current.find(d =>
        pos.lineNumber === d.start.l && pos.column >= d.start.c && pos.column <= d.end.c,
      )
      if (hit) void openEntity(hit.entityId)
    })
  }

  return (
    <Editor
      height="100%"
      language={snippet.language}
      value={snippet.code}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}    /* 主题随 app 切换 */
      onMount={handleMount}
      options={{ readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, lineNumbersMinChars: 3 }}
    />
  )
}
```
> 注：测试里 `@monaco-editor/react` 被 mock 成纯 div，故 `onMount` 装饰逻辑不在单测覆盖（属编辑器集成，靠 `computeCalleeDecorations` 单测保证换算正确 + 部署后 E2E 验证点击跳转）。`vs`/`vs-dark` 是 Monaco 内置主题。

- [ ] **Step 9: 运行确认通过 + 装饰换算回归**

Run: `npx vitest run src/components/code/`
Expected: PASS（calleeDecorations 4 + MonacoSnippet 3）

- [ ] **Step 10: 提交**

```bash
git add src/components/code/calleeDecorations.ts src/components/code/calleeDecorations.test.ts src/components/code/MonacoSnippet.tsx src/components/code/MonacoSnippet.test.tsx src/index.css
git commit -m "feat(code-viewer): MonacoSnippet + callee decoration计算 (click-to-jump) + .cs-callee token css

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4：CodeViewerDrawer（抽屉 + Tab + callers 侧栏）

**Files:** Create `src/components/code/CodeViewerDrawer.tsx`、`src/components/code/CodeViewerDrawer.test.tsx`

- [ ] **Step 1: 写失败测试 `src/components/code/CodeViewerDrawer.test.tsx`**

```tsx
// src/components/code/CodeViewerDrawer.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useCodeViewerStore } from '@/store/codeViewer'

vi.mock('@monaco-editor/react', () => ({ default: ({ value }: { value: string }) => <div data-testid="monaco">{value}</div>, loader: { config: vi.fn() } }))
vi.mock('@/store/theme', () => ({ useThemeStore: (sel: (s: { theme: string }) => unknown) => sel({ theme: 'light' }) }))

import { CodeViewerDrawer } from './CodeViewerDrawer'

const tab = (id: string, code = 'body') => ({
  entityId: id, loading: false, error: null,
  snippet: { entity_id: id, qualified_name: id.split('#')[0], kind: 'method', file_path: 'A.java', language: 'java', start_line: 1, end_line: 1, code, callees: [], callers: [{ entity_id: 'C::x#()', name: 'x' }] },
})

describe('CodeViewerDrawer', () => {
  beforeEach(() => useCodeViewerStore.setState({ projectId: 'p', open: false, tabs: [], activeEntityId: null }))

  it('open=false → 不渲染', () => {
    const { container } = render(<CodeViewerDrawer />)
    expect(container).toBeEmptyDOMElement()
  })

  it('open=true → 渲染激活 tab 的片段 + callers', () => {
    useCodeViewerStore.setState({ open: true, tabs: [tab('A::m#()')], activeEntityId: 'A::m#()' })
    render(<CodeViewerDrawer />)
    expect(screen.getByTestId('monaco')).toHaveTextContent('body')
    expect(screen.getByText(/x/)).toBeInTheDocument()        // callers 侧栏
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/code/CodeViewerDrawer.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现 `src/components/code/CodeViewerDrawer.tsx`**

```tsx
// src/components/code/CodeViewerDrawer.tsx
// 右侧代码片段抽屉：Tab 栏（多实体）+ 主区 Monaco 片段 + callers 侧栏（反向跳转）。
// 设计 [[代码片段查看器-设计]] §5。颜色走 token、light/dark 双达标。
import { useCodeViewerStore } from '@/store/codeViewer'
import { useThemeStore } from '@/store/theme'
import { MonacoSnippet } from './MonacoSnippet'

/** 实体 id → 展示短名（末段）。 */
function shortName(entityId: string): string {
  const head = entityId.split('#')[0]                 // 去参数签名
  return head.split('::').pop() || head               // 取 method 名
}

export function CodeViewerDrawer() {
  const open = useCodeViewerStore(s => s.open)
  const tabs = useCodeViewerStore(s => s.tabs)
  const activeEntityId = useCodeViewerStore(s => s.activeEntityId)
  const switchTab = useCodeViewerStore(s => s.switchTab)
  const closeTab = useCodeViewerStore(s => s.closeTab)
  const close = useCodeViewerStore(s => s.close)
  const openEntity = useCodeViewerStore(s => s.openEntity)
  const theme = useThemeStore(s => s.theme) as 'light' | 'dark'

  if (!open) return null                              // 关闭态不渲染（无闪烁）
  const active = tabs.find(t => t.entityId === activeEntityId) ?? null

  return (
    // 右侧固定抽屉：bg/border 走 token；宽度响应式
    <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[640px] flex-col border-l border-border bg-background shadow-xl">
      {/* 顶栏：标题 + 关闭 */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">代码片段</span>
        <button type="button" onClick={close} aria-label="关闭" className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted">✕</button>
      </div>

      {/* Tab 栏：每个已打开实体一项 */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1">
        {tabs.map(t => (
          <div key={t.entityId}
               className={`flex items-center gap-1 rounded px-2 py-1 text-[12.5px] cursor-pointer ${t.entityId === activeEntityId ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
               onClick={() => switchTab(t.entityId)} title={t.entityId}>
            <span>{shortName(t.entityId)}</span>
            <button type="button" aria-label="关闭标签" onClick={(e) => { e.stopPropagation(); closeTab(t.entityId) }} className="opacity-60 hover:opacity-100">×</button>
          </div>
        ))}
      </div>

      {/* 主区：Monaco 片段 + callers 侧栏 */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <MonacoSnippet snippet={active?.snippet ?? null} loading={active?.loading} error={active?.error} theme={theme} />
        </div>
        {/* callers 侧栏：反向导航（点击 openEntity 跳） */}
        {active?.snippet?.callers?.length ? (
          <div className="w-48 shrink-0 overflow-y-auto border-l border-border p-2">
            <div className="mb-1 text-[11px] uppercase text-muted-foreground">被调用方 (callers)</div>
            {active.snippet.callers.map(c => (
              <button key={c.entity_id} type="button" onClick={() => void openEntity(c.entity_id)} title={c.entity_id}
                      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[12px] text-[var(--ref-accent)] hover:bg-[var(--ref-accent)]/10">
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/components/code/CodeViewerDrawer.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/code/CodeViewerDrawer.tsx src/components/code/CodeViewerDrawer.test.tsx
git commit -m "feat(code-viewer): CodeViewerDrawer (tabs + Monaco snippet + callers panel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5：可点击注入 + 挂载抽屉

**Files:** Modify `src/components/chat/EntityRef.tsx`、`src/components/chat/AssistantMessage.tsx`、`src/pages/ChatPage.tsx`；Create `src/components/chat/EntityRef.test.tsx`

- [ ] **Step 1: 写失败测试 `src/components/chat/EntityRef.test.tsx`**

```tsx
// src/components/chat/EntityRef.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HighlightCtx } from './HighlightCtx'
import { EntityRef, EntityChip } from './EntityRef'
import { useCodeViewerStore } from '@/store/codeViewer'

const wrap = (ui: React.ReactNode) =>
  <HighlightCtx.Provider value={{ active: null, setActive: () => {} }}>{ui}</HighlightCtx.Provider>

describe('EntityRef/EntityChip 点击打开代码片段查看器', () => {
  beforeEach(() => useCodeViewerStore.setState({ projectId: 'p', open: false, tabs: [], activeEntityId: null }))

  it('EntityRef onClick → openEntity', () => {
    const spy = vi.spyOn(useCodeViewerStore.getState(), 'openEntity').mockResolvedValue()
    render(wrap(<EntityRef entityId="A::m#()">m</EntityRef>))
    fireEvent.click(screen.getByText('m'))
    expect(spy).toHaveBeenCalledWith('A::m#()')
  })

  it('EntityChip onClick → openEntity', () => {
    const spy = vi.spyOn(useCodeViewerStore.getState(), 'openEntity').mockResolvedValue()
    render(wrap(<EntityChip entityId="A::m#(Long)" />))
    fireEvent.click(screen.getByRole('button'))
    expect(spy).toHaveBeenCalledWith('A::m#(Long)')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/chat/EntityRef.test.tsx`
Expected: FAIL（onClick 还没调 openEntity）

- [ ] **Step 3: EntityRef/EntityChip 接 openEntity**

`src/components/chat/EntityRef.tsx`：顶部加 import：
```ts
import { useCodeViewerStore } from '@/store/codeViewer'
```
`EntityRef` 函数体内（`const { active, setActive } = useContext(HighlightCtx)` 之后）加：
```ts
  const openEntity = useCodeViewerStore(s => s.openEntity)
```
把其 `onClick` 由：
```ts
      onClick={() => { setActive(on ? null : entityId); void navigator.clipboard?.writeText(entityId) }}
```
改为（点击=打开片段查看器 + 保留高亮联动；去掉 MVP 的剪贴板复制）：
```ts
      onClick={() => { setActive(on ? null : entityId); void openEntity(entityId) }}
```
`EntityChip` 同样：函数体加 `const openEntity = useCodeViewerStore(s => s.openEntity)`，onClick 改为 `() => { setActive(on ? null : entityId); void openEntity(entityId) }`。

- [ ] **Step 4: AssistantMessage 底部 references chip 改用 EntityChip（可点击）**

先 Read `src/components/chat/AssistantMessage.tsx`，定位 section.references 渲染处（`s.references.map(...)` 把每个 reference 渲成纯 `<span>{r.display_text}</span>` 的那段）。把纯 span 替换为 `<EntityChip entityId={r.entity_id} />`（EntityChip 已 import；它现在点击会开片段查看器）。若该处已用 EntityChip 则无需改（入口方法走 MD_COMPONENTS.a→EntityRef 自动覆盖）。message 级 `cited_entities` 若也渲成纯 span，同样换 EntityChip。

> 注：EntityChip 显示 `shortLabel(entityId)`；若设计要展示 `display_text`，保持现状用 EntityChip 的 shortLabel（与正文行内 EntityRef 风格一致）即可。

- [ ] **Step 5: ChatPage 挂抽屉 + setProject**

`src/pages/ChatPage.tsx`：
顶部加 import：
```ts
import { CodeViewerDrawer } from '@/components/code/CodeViewerDrawer'
import { useCodeViewerStore } from '@/store/codeViewer'
```
组件体内（拿到 `projectId` 后）加一个 effect 注入当前工程：
```ts
  // 把当前工程注入代码片段查看器 store（openEntity 拼 URL 要用）
  const setCodeViewerProject = useCodeViewerStore(s => s.setProject)
  useEffect(() => {
    if (projectId) setCodeViewerProject(projectId)
  }, [projectId, setCodeViewerProject])
```
在 ChatPage 顶层返回的 JSX 最外层容器内（与主内容并列，抽屉是 fixed 叠加层，挂哪层都行，放根容器末尾即可）渲染：
```tsx
      <CodeViewerDrawer />
```

- [ ] **Step 6: 运行确认通过 + 全量前端回归**

Run: `npx vitest run src/components/chat/EntityRef.test.tsx`
Expected: PASS
Run: `npx vitest run 2>&1 | tail -8`
Expected: 全绿（新增本特性测试 + 既有不破）

- [ ] **Step 7: typecheck + build**

Run: `npm run build 2>&1 | tail -15`
Expected: tsc 无类型错误、vite build 成功（确认 Monaco 依赖打包 OK）。

- [ ] **Step 8: 提交**

```bash
git add src/components/chat/EntityRef.tsx src/components/chat/EntityRef.test.tsx src/components/chat/AssistantMessage.tsx src/pages/ChatPage.tsx
git commit -m "feat(code-viewer): wire EntityRef/EntityChip + bottom chips to openEntity, mount drawer in ChatPage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6：部署前端（⚠️ 需用户授权 + 确认部署方式）

> 前置：用户授权部署。前端部署机制本会话未做过，需与用户确认（典型：`npm run build` → 把 `dist/` 发布到蓝队云 nginx 静态根目录，或服务器侧 pull -web 仓 + build）。不自动执行。

- [ ] **Step 1: 本地 build** `cd /Users/java/knowledge-engineering-web && npm run build`（确认 dist 产物 + Monaco chunk）。
- [ ] **Step 2: push** `git push origin release-0513`。
- [ ] **Step 3:（授权后）按确认的方式发布 dist 到蓝队云前端目录 + reload nginx。**
- [ ] **Step 4: 浏览器 E2E**（103.47.81.50/project/mall-swarm/chat）：
  - 问一题（如"订单应付金额怎么算"）→ 答案出现后，点入口方法 / 底部引用 chip / 正文行内实体 → 右侧抽屉弹出 Monaco 代码片段。
  - 片段内方法调用处（如 calcPayAmount 里的 getTotalAmount）有下划线 → 点击 → 新 tab 跳到目标方法片段。
  - callers 侧栏点击 → 反向跳。切 light/dark → Monaco 主题与抽屉配色都跟随、无硬编码色。
  - 未知/无源码实体 → 抽屉显示"未找到该实体的源码"，不崩。
- [ ] **Step 5: 回填 Obsidian** `代码片段查看器-设计.md` §12 前端段：commit、E2E 结果、部署方式。不双写仓库。

---

## Self-Review

**1. Spec 覆盖（§5 前端组件 / §6 数据流 / §7 降级 / §9 范围）：** @monaco-editor/react 依赖 → T1 ✅；api/codeSnippets → T1 ✅；codeViewer store(openEntity/tabs) → T2 ✅；MonacoSnippet 调用点装饰(line/col 换算 + col 缺失整行兜底 + 主题随 app + 加载失败位)→ T3 ✅；CodeViewerDrawer(抽屉 + Tab + callers 侧栏)→ T4 ✅；EntityRef/EntityChip/底部 chip/入口方法可点击 + 挂载 → T5 ✅；主题 token(.cs-callee 走 --ref-accent，light/dark)→ T3 ✅；§6 数据流(点击→openEntity→GET→渲染→片段内点调用→openEntity)→ T2+T3+T5 ✅；§7 降级(404→未找到 / Monaco 失败→loading/error 文案位 / col 缺失整行)→ T2+T3 ✅；§9 不做(类名跳转/mermaid 节点/AI 解读流)→ 未涉及 ✅。

**2. 占位符扫描：** T1-T5 完整 before/after + 完整测试代码；T5 的 AssistantMessage 改动给了"定位 references.map 纯 span 换 EntityChip"的具体指引（需读文件定位，非 TBD）；T6 部署给了具体 E2E 步骤 + 标注部署方式待用户确认（前端部署机制本会话未知，诚实标注而非编造命令）。无 TODO/TBD。

**3. 类型一致性：** `CodeSnippet`/`CalleeRef`/`CallerRef`（T1）在 store(T2)、calleeDecorations(T3)、MonacoSnippet(T3)、CodeViewerDrawer(T4) 一致；`openEntity(entityId)` 单参（store 持 projectId）在 store(T2)、EntityRef(T5)、MonacoSnippet 点击(T3)、callers 侧栏(T4) 调用一致；`computeCalleeDecorations(callees, startLine)` 定义(T3)与 MonacoSnippet 调用一致；`ViewerTab {entityId, snippet, loading, error}` 在 store(T2) 与 Drawer(T4)/MonacoSnippet(T3) 消费一致。
