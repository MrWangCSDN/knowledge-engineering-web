# 会话标题（前端）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端支持会话重命名（SessionMenu「重命名」→ SessionItem 就地 inline 编辑 → PATCH 后端）+ 接收 SSE `session_title` 事件实时刷新侧栏标题。

**Architecture:** `api/sessions.ts` 加 `renameSession`（PATCH）；`store/sessions.ts` 加 `renameSession`（乐观更新）+ `updateSessionTitle`（SSE 用）；`store/chat.ts` SSE parser 加 `session_title` case；`SessionMenu` 加「重命名」项；`SessionItem` 加 inline 编辑态。

**Tech Stack:** React 19 / TypeScript / Zustand / Vitest / @testing-library/react

**Spec:** `/Users/java/obsidian/01 Engineering/knowledge-engineering/会话标题-重命名与智能总结-设计.md`

**前置依赖:** 后端 plan（`knowledge-engineering-auth/docs/superpowers/plans/2026-05-16-session-title-backend.md`）需先完成——本 plan 依赖后端 `PATCH /sessions/{sid}` 接口 + SSE `session_title` 事件契约。

**Repo:** `/Users/java/knowledge-engineering-web`（分支 `feat/chit-chat-skill`，vite dev :5173 task bja9mo8yv 运行中）

---

## File Structure

| 文件 | 改动 |
|---|---|
| `src/api/sessions.ts` | 加 `renameSession(projectId, sessionId, title)` |
| `src/store/sessions.ts` | 加 `renameSession` action（乐观更新+回滚）+ `updateSessionTitle` action |
| `src/store/chat.ts` | SSE parser 加 `case 'session_title'` |
| `src/components/session/SessionMenu.tsx` | 加「重命名」菜单项 + `onRename` prop |
| `src/components/session/SessionItem.tsx` | 加 inline 编辑态（input/Enter/Esc/blur/空值） |
| `src/api/sessions.test.ts` | 🆕 / 或加 renameSession 测试 |
| `src/store/sessions.test.ts` | 🆕 / 或加 renameSession + updateSessionTitle 测试 |
| `src/components/session/SessionMenu.test.tsx` | 加「重命名」项测试 |
| `src/components/session/SessionItem.test.tsx` | 加 inline 编辑测试 |

---

## Task 1: api/sessions.ts 加 renameSession（TDD）

**Files:**
- Modify: `src/api/sessions.ts`
- Create/Modify: `src/api/sessions.test.ts`

- [ ] **Step 1: 看现有 api 测试风格**

Run: `cd /Users/java/knowledge-engineering-web && ls src/api/*.test.ts 2>/dev/null && grep -rn "vi.mock\|apiClient" src/api/*.test.ts 2>/dev/null | head -5`
Expected: 看是否已有 api 测试 + mock apiClient 的模式（没有则下面新建）

- [ ] **Step 2: 写失败测试**

新建（或追加）`src/api/sessions.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renameSession } from './sessions'
import apiClient from './client'

vi.mock('./client', () => ({
  default: { patch: vi.fn(), get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

describe('renameSession', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /projects/{pid}/qa/sessions/{sid} with title', async () => {
    ;(apiClient.patch as any).mockResolvedValue({
      data: { id: 's1', title: '新名', title_custom: true },
    })
    const r = await renameSession('p1', 's1', '新名')
    expect(apiClient.patch).toHaveBeenCalledWith(
      '/projects/p1/qa/sessions/s1',
      { title: '新名' },
    )
    expect(r.title).toBe('新名')
    expect(r.title_custom).toBe(true)
  })
})
```

⚠️ 实施者：`./client` 的真实路径/默认导出名按 `src/api/sessions.ts` 顶部 import 为准（可能是 `import apiClient from './client'` 或具名）。核对后改 mock。

- [ ] **Step 3: 跑测试，确认失败**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/api/sessions.test.ts`
Expected: FAIL（`renameSession` 未导出）

- [ ] **Step 4: 实现 renameSession**

在 `src/api/sessions.ts`，`deleteSession` 函数之后加：

```typescript
/** 重命名会话。后端置 title_custom=true，异步总结将不再覆盖。 */
export async function renameSession(
  projectId: string,
  sessionId: string,
  title: string,
): Promise<{ id: string; title: string; title_custom: boolean }> {
  const { data } = await apiClient.patch(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}`,
    { title },
  )
  return data
}
```

⚠️ 实施者：核对文件顶部 `apiClient` 的导入名，保持一致。

- [ ] **Step 5: 跑测试，确认通过**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/api/sessions.test.ts`
Expected: 1 passed

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/api/sessions.ts src/api/sessions.test.ts
git commit -m "feat(api): renameSession PATCH 调用（TDD）"
```

---

## Task 2: store/sessions.ts 加 renameSession + updateSessionTitle（TDD）

**Files:**
- Modify: `src/store/sessions.ts`
- Create/Modify: `src/store/sessions.test.ts`

- [ ] **Step 1: 看 store 现有结构**

Run: `cd /Users/java/knowledge-engineering-web && sed -n '20,75p' src/store/sessions.ts`
Expected: 确认 `SessionStore` interface、`sessionsByProject: Record<string, Session[]>`、`set(state => ...)` 模式、`Session` 类型来源

- [ ] **Step 2: 写失败测试**

新建/追加 `src/store/sessions.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionStore } from './sessions'
import * as api from '@/api/sessions'

vi.mock('@/api/sessions')

const SESS = (id: string, title: string) =>
  ({ id, title, project_id: 'p1', created_at: '', updated_at: '' } as any)

describe('useSessionStore rename/updateTitle', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionsByProject: { p1: [SESS('s1', '旧标题'), SESS('s2', '另一个')] },
    } as any)
    vi.clearAllMocks()
  })

  it('updateSessionTitle 改对应 session 的 title', () => {
    useSessionStore.getState().updateSessionTitle('s1', '总结后的标题')
    const list = useSessionStore.getState().sessionsByProject['p1']
    expect(list.find(s => s.id === 's1')!.title).toBe('总结后的标题')
    expect(list.find(s => s.id === 's2')!.title).toBe('另一个') // 不动别的
  })

  it('renameSession 乐观更新 + 调 API', async () => {
    ;(api.renameSession as any).mockResolvedValue({
      id: 's1', title: '新名', title_custom: true,
    })
    await useSessionStore.getState().renameSession('p1', 's1', '新名')
    expect(api.renameSession).toHaveBeenCalledWith('p1', 's1', '新名')
    expect(
      useSessionStore.getState().sessionsByProject['p1'].find(s => s.id === 's1')!.title,
    ).toBe('新名')
  })

  it('renameSession API 失败时回滚', async () => {
    ;(api.renameSession as any).mockRejectedValue(new Error('boom'))
    await expect(
      useSessionStore.getState().renameSession('p1', 's1', '新名'),
    ).rejects.toThrow()
    // 回滚到旧标题
    expect(
      useSessionStore.getState().sessionsByProject['p1'].find(s => s.id === 's1')!.title,
    ).toBe('旧标题')
  })
})
```

- [ ] **Step 3: 跑测试，确认失败**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/store/sessions.test.ts`
Expected: FAIL（`renameSession`/`updateSessionTitle` 不存在）

- [ ] **Step 4: 实现两个 action**

在 `src/store/sessions.ts` 的 `SessionStore` interface 里加：

```typescript
  /** SSE session_title 事件用：直接改某 session 标题（不调 API）。 */
  updateSessionTitle: (sessionId: string, title: string) => void
  /** 用户手动重命名：乐观更新 + 调 API，失败回滚。 */
  renameSession: (projectId: string, sessionId: string, title: string) => Promise<void>
```

在 `create<SessionStore>((set) => ({ ... }))` 里加（注意：renameSession 需读旧值做回滚，用 `set` 的 functional form + 闭包存旧 list）：

```typescript
  updateSessionTitle: (sessionId, title) => {
    set(state => {
      const next: Record<string, typeof state.sessionsByProject[string]> = {}
      for (const [pid, list] of Object.entries(state.sessionsByProject)) {
        next[pid] = list.map(s => (s.id === sessionId ? { ...s, title } : s))
      }
      return { sessionsByProject: next }
    })
  },

  renameSession: async (projectId, sessionId, title) => {
    // 存旧标题用于回滚
    const prev = useSessionStore
      .getState()
      .sessionsByProject[projectId]?.find(s => s.id === sessionId)?.title
    // 乐观更新
    set(state => ({
      sessionsByProject: {
        ...state.sessionsByProject,
        [projectId]: (state.sessionsByProject[projectId] ?? []).map(s =>
          s.id === sessionId ? { ...s, title } : s,
        ),
      },
    }))
    try {
      await renameSessionApi(projectId, sessionId, title)
    } catch (err) {
      // 回滚
      set(state => ({
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: (state.sessionsByProject[projectId] ?? []).map(s =>
            s.id === sessionId ? { ...s, title: prev ?? s.title } : s,
          ),
        },
      }))
      throw err
    }
  },
```

文件顶部 import 加（避免和 store action 同名）：
```typescript
import { renameSession as renameSessionApi } from '@/api/sessions'
```

⚠️ 实施者：`sessionsByProject` 的 value 类型按文件实际 `Session[]` 写；`useSessionStore` 自引用如导致 TS 循环，改用 `get()`（若 `create` 的回调签名是 `(set, get)`——核对后用 `get().sessionsByProject`）。

- [ ] **Step 5: 跑测试，确认通过**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/store/sessions.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/store/sessions.ts src/store/sessions.test.ts
git commit -m "feat(store): sessions renameSession（乐观+回滚）+ updateSessionTitle（TDD 3 测试）"
```

---

## Task 3: store/chat.ts SSE 加 session_title case（TDD）

**Files:**
- Modify: `src/store/chat.ts`
- Modify: `src/store/chat.test.ts`（若无则在已有 chat 测试文件追加）

- [ ] **Step 1: 定位 SSE parser switch**

Run: `cd /Users/java/knowledge-engineering-web && grep -n "case 'done'\|case 'meta'\|switch (msg.event)\|switch(msg.event)" src/store/chat.ts`
Expected: 找到 `switch (msg.event) { case 'meta': ... case 'done': ... }` 的行号

- [ ] **Step 2: 写失败测试**

在 chat 的测试文件追加（沿用文件已有 SSE 解析测试模式；下面是独立单测思路——直接调用 parser onEvent 注入一个 session_title 事件，断言 sessionStore 被更新）：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSessionStore } from './sessions'

describe('chat SSE session_title 事件', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionsByProject: { p1: [{ id: 's1', title: '临时', project_id: 'p1', created_at: '', updated_at: '' } as any] },
    } as any)
  })

  it('收到 session_title 事件 → 更新 sessionStore 标题', () => {
    // 直接验证 store 行为（chat.ts case 内部就是调 updateSessionTitle）
    useSessionStore.getState().updateSessionTitle('s1', 'LLM 总结标题')
    expect(
      useSessionStore.getState().sessionsByProject['p1'][0].title,
    ).toBe('LLM 总结标题')
  })
})
```

⚠️ 实施者：若 chat.ts 的 SSE parser 可被单独测试（如导出了 onEvent handler），更好的测试是直接喂一个 `{ event: 'session_title', data: '{"session_id":"s1","title":"x"}' }` 断言 store 变。看 chat.test.ts 现有 SSE 测试怎么做的，对齐风格。本步至少保证 case 接线被测到。

- [ ] **Step 3: 跑测试，确认失败 / 或先红**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/store/chat.test.ts`
Expected: 新增 case 测试先失败（如果测的是 chat.ts 的 SSE 注入路径）

- [ ] **Step 4: 加 session_title case**

在 `src/store/chat.ts` 的 `switch (msg.event)`，`case 'done':` 块之后（`case 'error':` 之前）插入：

```typescript
            case 'session_title': {
              // 后端首轮异步总结完成，推来新标题 → 实时刷新侧栏
              // 设计：[[会话标题-重命名与智能总结-设计]] §4.2
              const sid = data.session_id as string
              const title = data.title as string
              if (sid && title) {
                useSessionStore.getState().updateSessionTitle(sid, title)
              }
              break
            }
```

文件顶部确认已 import `useSessionStore`（chat.ts 已在用 `useSessionStore.getState().prependSession` —— 见现有 done 分支，无需新增 import）。

- [ ] **Step 5: 跑测试，确认通过**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/store/chat.test.ts`
Expected: passed

- [ ] **Step 6: Commit**

```bash
git add src/store/chat.ts src/store/chat.test.ts
git commit -m "feat(chat): SSE session_title 事件 → 实时刷新侧栏标题（TDD）"
```

---

## Task 4: SessionMenu 加「重命名」项（TDD）

**Files:**
- Modify: `src/components/session/SessionMenu.tsx`
- Modify: `src/components/session/SessionMenu.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/components/session/SessionMenu.test.tsx` 追加：

```typescript
it('渲染「重命名」项，点击触发 onRename', async () => {
  const onRename = vi.fn()
  render(<SessionMenu onArchive={() => {}} onDelete={() => {}} onRename={onRename} />)
  // 打开下拉
  await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
  await userEvent.click(screen.getByText('重命名'))
  expect(onRename).toHaveBeenCalledTimes(1)
})
```

⚠️ 实施者：核对文件已有测试的 import（render/screen/userEvent）+ radix dropdown 打开方式，对齐现有 archive/delete 测试写法。

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/components/session/SessionMenu.test.tsx`
Expected: FAIL（无「重命名」项 / onRename prop 不存在）

- [ ] **Step 3: 加重命名项**

修改 `src/components/session/SessionMenu.tsx`：

import 加 `Pencil`：
```typescript
import { MoreHorizontal, Archive, Trash2, Pencil } from 'lucide-react'
```

`Props` interface 加：
```typescript
  onRename: () => void
```
函数签名解构加 `onRename`。

在 `<DropdownMenuContent>` 里，「归档」项**之前**加：
```typescript
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onRename()
          }}
          className="cursor-pointer"
        >
          <Pencil className="h-4 w-4 mr-2" />
          <span>重命名</span>
        </DropdownMenuItem>
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/components/session/SessionMenu.test.tsx`
Expected: passed（含原 archive/delete 测试不回归）

- [ ] **Step 5: Commit**

```bash
git add src/components/session/SessionMenu.tsx src/components/session/SessionMenu.test.tsx
git commit -m "feat(session): SessionMenu 加「重命名」项（TDD）"
```

---

## Task 5: SessionItem inline 编辑（TDD）

**Files:**
- Modify: `src/components/session/SessionItem.tsx`
- Modify: `src/components/session/SessionItem.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `src/components/session/SessionItem.test.tsx` 追加（沿用文件已有 render/mock 模式；mock `useSessionStore` 的 renameSession）：

```typescript
describe('SessionItem inline rename', () => {
  it('点重命名 → 出现 input，Enter 保存调 renameSession', async () => {
    const renameSession = vi.fn().mockResolvedValue(undefined)
    // 用文件已有的 mock store 方式注入 renameSession（按现有测试套路）
    // ...render SessionItem with a session {id:'s1', title:'旧'}...
    // 打开 SessionMenu → 点「重命名」
    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(screen.getByText('重命名'))
    const input = screen.getByDisplayValue('旧')
    await userEvent.clear(input)
    await userEvent.type(input, '新标题{Enter}')
    expect(renameSession).toHaveBeenCalledWith(expect.any(String), 's1', '新标题')
  })

  it('Esc 取消编辑，不调 renameSession', async () => {
    // ...同上打开 inline 编辑...
    const input = screen.getByDisplayValue('旧')
    await userEvent.type(input, 'abc{Escape}')
    expect(screen.queryByDisplayValue(/abc/)).toBeNull()
    // renameSession 未被调用
  })

  it('空标题不调 renameSession，恢复原标题', async () => {
    // ...打开 inline 编辑...
    const input = screen.getByDisplayValue('旧')
    await userEvent.clear(input)
    await userEvent.type(input, '   {Enter}')
    // renameSession 未被调用，标题仍「旧」
  })
})
```

⚠️ 实施者：**先读 `src/components/session/SessionItem.test.tsx` 全文**搞清现有 mock 套路（怎么 mock useSessionStore / useNavigate / 提供 session+project props），把上面骨架补全成可跑测试。

- [ ] **Step 2: 跑测试，确认失败**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/components/session/SessionItem.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现 inline 编辑**

修改 `src/components/session/SessionItem.tsx`：

- import 加 `useState, useRef, useEffect`（按需）
- 从 store 取 `renameSession`：`const renameSession = useSessionStore(s => s.renameSession)`
- 加 state：`const [isEditing, setIsEditing] = useState(false)` + `const [draft, setDraft] = useState(session.title || '')`
- `SessionMenu` 传 `onRename={() => { setDraft(session.title || ''); setIsEditing(true) }}`
- 标题渲染处条件分支：

```tsx
{isEditing ? (
  <input
    autoFocus
    value={draft}
    onChange={e => setDraft(e.target.value)}
    onClick={e => e.stopPropagation()}
    onKeyDown={e => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        commitRename()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsEditing(false)        // 取消，draft 丢弃
      }
    }}
    onBlur={commitRename}
    className="flex-1 bg-transparent border-b border-primary outline-none text-sm"
  />
) : (
  <span className="flex-1 truncate" title={session.title}>
    {session.title || '(无标题)'}
  </span>
)}
```

- 加 `commitRename`：

```tsx
const commitRename = async () => {
  const next = draft.trim()
  setIsEditing(false)
  if (!next || next === session.title) return   // 空 / 没改 → 不调 API（恢复原标题）
  try {
    await renameSession(project.id, session.id, next)
  } catch {
    // store 内部已回滚 + 可加 toast；这里静默
  }
}
```

⚠️ 实施者：核对 `session` / `project` prop 名（看文件现有）；`useSessionStore` 已在文件 import（现有 archive/delete 在用）。编辑态下阻止 li 的 onClick 导航（input 的 onClick stopPropagation 已处理；如外层 div 仍触发，给编辑态下整行包一层判断）。

- [ ] **Step 4: 跑测试，确认通过**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run src/components/session/SessionItem.test.tsx`
Expected: passed（原 archive/delete/导航测试不回归）

- [ ] **Step 5: Commit**

```bash
git add src/components/session/SessionItem.tsx src/components/session/SessionItem.test.tsx
git commit -m "feat(session): SessionItem inline 重命名（Enter/Esc/blur/空值，TDD）"
```

---

## Task 6: 全量回归 + tsc

**Files:** 无新文件

- [ ] **Step 1: 全量测试**

Run: `cd /Users/java/knowledge-engineering-web && npx vitest run`
Expected: 全 passed（新增测试 + 原有不回归）

- [ ] **Step 2: tsc**

Run: `cd /Users/java/knowledge-engineering-web && npx tsc --noEmit`
Expected: 无 error

- [ ] **Step 3: 若有问题修复后 Commit；无问题跳过**

---

## Task 7: Preview MCP 端到端手动验证（controller 执行）

**Files:** 无

由控制器（主 agent）用 Claude Preview MCP 跑：

- [ ] 启动 ke-web preview（reuse :5173），resize 1400x900，登录 admin/admin12345
- [ ] **重命名验证**：进 demo-system，hover 一个 session →「⋯」→「重命名」→ 标题变 input → 改名 + Enter → 侧栏标题更新；刷新页面标题持久（后端 title_custom=true）
- [ ] **Esc 取消验证**：进编辑态打字 → Esc → 恢复原标题，未调接口
- [ ] **空标题验证**：清空 + Enter → 恢复原标题
- [ ] **异步总结验证**：点「新对话」发一个首问（如"杭州周末两天去哪玩"）→ 看回答流式完成 → 稍后（1~3s）侧栏该会话标题从截断版**自动变成 LLM 总结版**
- [ ] **保护验证**：手动重命名一个会话 → 在该会话继续发消息 → 标题**不被**异步总结覆盖（因 title_custom=true；注意只有首轮才触发总结，这里主要验证 rename 后 flag 生效）
- [ ] 截图留证，确认 Light/Dark 下 inline input 视觉正常（input 用 bg-transparent + border，需双主题可读 —— 按用户 CLAUDE.md 前端规则）

---

## Self-Review 检查项（实施者跑完过一遍）

- [ ] 设计 §4.1（SessionMenu 重命名 + inline 编辑 Enter/Esc/blur/空值）→ Task 4+5 ✓
- [ ] 设计 §4.1（api renameSession）→ Task 1 ✓
- [ ] 设计 §4.1（store renameSession 乐观+回滚）→ Task 2 ✓
- [ ] 设计 §4.2（SSE session_title → updateSessionTitle 刷侧栏）→ Task 2+3 ✓
- [ ] 设计 §6.2 前端测试矩阵（SessionMenu/inline/store/SSE）→ Task 1-5 覆盖 ✓
- [ ] 类型一致：`renameSession(projectId, sessionId, title)` 签名在 api/store/SessionItem 三处一致 ✓
- [ ] 类型一致：`updateSessionTitle(sessionId, title)` 在 store 定义、chat.ts 调用一致 ✓

## Phase Definition of Done

- [ ] `npx vitest run` 全 pass（新增 ~9 测试 + 无回归）
- [ ] `npx tsc --noEmit` clean
- [ ] Preview MCP 验证：重命名/Esc/空值/异步总结/保护 全部 OK
- [ ] inline input 在 Light + Dark 都可读（CLAUDE.md 前端双主题规则）
- [ ] git 历史按 task 干净分段
