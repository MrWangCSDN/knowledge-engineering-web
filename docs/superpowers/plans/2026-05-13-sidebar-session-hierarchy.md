# Sidebar 会话历史层级化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Sidebar 中段从「单工程会话列表」改造成「最近 → 工程 → session」三层折叠树，状态持久化到 localStorage，参考 ChatGPT 视觉惯例。

**Architecture:** 新增 1 个 zustand persist store (`useSidebarStore`) + 3 个新组件（`SessionHistoryGrouped` / `RecentHeader` / `ProjectGroup`），替换 `Sidebar.tsx` 中段；复用现有 `SessionItem`；删除废弃的 `SessionHistory.tsx`。工程排序在 selector 里实时算 `max(session.updated_at)`，不污染 sessions store。

**Tech Stack:** React 19 + TypeScript 6 + Vite 8 + Tailwind v4 + Zustand (含 persist 中间件) + Vitest + lucide-react

**Spec:** `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话历史层级化-设计.md`

**Working directory:** `/Users/java/knowledge-engineering-web`

---

## File Map

| 文件 | 操作 | 责任 |
|---|---|---|
| `src/store/sidebar.ts` | **新建** | 折叠状态 + localStorage persist |
| `src/store/sidebar.test.ts` | **新建** | store 单测 |
| `src/components/session/RecentHeader.tsx` | **新建** | 「最近 ⌄」一级折叠头 |
| `src/components/session/RecentHeader.test.tsx` | **新建** | 组件单测 |
| `src/components/session/ProjectGroup.tsx` | **新建** | 工程名 + chevron + sessions（二级折叠头 + 列表）|
| `src/components/session/ProjectGroup.test.tsx` | **新建** | 组件单测 |
| `src/components/session/SessionHistoryGrouped.tsx` | **新建** | 主组件（排序 + 过滤 + fetch + 空 state）|
| `src/components/session/SessionHistoryGrouped.test.tsx` | **新建** | 组件单测 |
| `src/components/layout/Sidebar.tsx` | **修改** | 替换中段 |
| `src/components/session/SessionHistory.tsx` | **删除** | 已废弃 + 与新组件命名冲突 |

---

## Task 1: useSidebarStore — 持久化折叠状态

**Files:**
- Create: `src/store/sidebar.ts`
- Create: `src/store/sidebar.test.ts`

- [ ] **Step 1: 写 failing test**

`src/store/sidebar.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarStore } from './sidebar'

describe('useSidebarStore', () => {
  beforeEach(() => {
    // 每个 case 前清掉 localStorage 并把 store 重置为默认值
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('默认 recentExpanded 为 true', () => {
    expect(useSidebarStore.getState().recentExpanded).toBe(true)
  })

  it('toggleRecent 翻转 recentExpanded', () => {
    useSidebarStore.getState().toggleRecent()
    expect(useSidebarStore.getState().recentExpanded).toBe(false)
    useSidebarStore.getState().toggleRecent()
    expect(useSidebarStore.getState().recentExpanded).toBe(true)
  })

  it('isProjectExpanded 未记录的 id 默认返回 true（默认展开）', () => {
    expect(useSidebarStore.getState().isProjectExpanded('any-project-id')).toBe(true)
  })

  it('toggleProject: 第一次调把展开状态写为 false', () => {
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
  })

  it('toggleProject: 第二次调翻回 true', () => {
    useSidebarStore.getState().toggleProject('p1')
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(true)
  })

  it('多个工程的折叠状态相互独立', () => {
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
    expect(useSidebarStore.getState().isProjectExpanded('p2')).toBe(true)
  })

  it('折叠状态写入 localStorage（key=ke-sidebar-expanded）', () => {
    useSidebarStore.getState().toggleProject('p1')
    const raw = localStorage.getItem('ke-sidebar-expanded')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    // zustand persist 的格式：{ state: {...}, version: 0 }
    expect(parsed.state.projectExpanded.p1).toBe(false)
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `npm test -- src/store/sidebar.test.ts --run`
Expected: FAIL，报错 "Cannot find module './sidebar'"。

- [ ] **Step 3: 写最小实现**

`src/store/sidebar.ts`:

```typescript
/**
 * src/store/sidebar.ts
 *
 * Sidebar 折叠状态（最近 / 工程 两层），持久化到 localStorage。
 *
 * 设计：[[会话历史层级化-设计]] §6.1
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 描述折叠状态的最小接口
interface SidebarState {
  /** 「最近」一级整体展开/折叠（默认 true）。 */
  recentExpanded: boolean
  /**
   * 每个工程的展开状态。
   * 关键不变量：projectExpanded[id] === undefined 等价于 true（默认展开），
   * 这样新工程不需要主动写入 store 即可默认展开。
   */
  projectExpanded: Record<string, boolean>

  // ─── actions ───
  toggleRecent: () => void
  toggleProject: (projectId: string) => void
  /** 当前是否展开（封装 undefined → true 的语义）。 */
  isProjectExpanded: (projectId: string) => boolean
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // 默认值
      recentExpanded: true,
      projectExpanded: {},

      toggleRecent: () =>
        set(s => ({ recentExpanded: !s.recentExpanded })),

      toggleProject: (id) =>
        set(s => {
          // 用 get().isProjectExpanded 拿到当前值（含 undefined→true 兜底）
          const current = get().isProjectExpanded(id)
          return {
            projectExpanded: { ...s.projectExpanded, [id]: !current },
          }
        }),

      isProjectExpanded: (id) => {
        const v = get().projectExpanded[id]
        // 未记录视为默认展开
        return v === undefined ? true : v
      },
    }),
    { name: 'ke-sidebar-expanded' }
  )
)
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `npm test -- src/store/sidebar.test.ts --run`
Expected: 全部 7 个 case PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/store/sidebar.ts src/store/sidebar.test.ts
git commit -m "$(cat <<'EOF'
feat(sidebar): useSidebarStore — 折叠状态 persist 到 localStorage

设计：[[会话历史层级化-设计]] §6.1

- recentExpanded + projectExpanded 两层状态
- undefined → true 兜底，新工程默认展开
- 用 zustand persist 中间件存 localStorage key=ke-sidebar-expanded

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: RecentHeader 组件 — 「最近 ⌄」一级折叠头

**Files:**
- Create: `src/components/session/RecentHeader.tsx`
- Create: `src/components/session/RecentHeader.test.tsx`

- [ ] **Step 1: 写 failing test**

`src/components/session/RecentHeader.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentHeader } from './RecentHeader'
import { useSidebarStore } from '@/store/sidebar'

describe('RecentHeader', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('渲染「最近」文案', () => {
    render(<RecentHeader />)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('展开状态下显示 ChevronDown', () => {
    render(<RecentHeader />)
    expect(screen.getByTestId('recent-chevron-down')).toBeInTheDocument()
  })

  it('折叠状态下显示 ChevronRight', () => {
    useSidebarStore.setState({ recentExpanded: false, projectExpanded: {} })
    render(<RecentHeader />)
    expect(screen.getByTestId('recent-chevron-right')).toBeInTheDocument()
  })

  it('点击切换 recentExpanded', () => {
    render(<RecentHeader />)
    fireEvent.click(screen.getByRole('button', { name: /最近/ }))
    expect(useSidebarStore.getState().recentExpanded).toBe(false)
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `npm test -- src/components/session/RecentHeader.test.tsx --run`
Expected: FAIL，报错 "Cannot find module './RecentHeader'"。

- [ ] **Step 3: 写最小实现**

`src/components/session/RecentHeader.tsx`:

```typescript
/**
 * src/components/session/RecentHeader.tsx
 *
 * 侧栏「最近」一级折叠头。点击切换整组展开/折叠。
 *
 * 设计：[[会话历史层级化-设计]] §4, §5（字体规格）, §7
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar'

export function RecentHeader() {
  // 从 store 读折叠状态 + toggle action
  const recentExpanded = useSidebarStore(s => s.recentExpanded)
  const toggleRecent = useSidebarStore(s => s.toggleRecent)

  return (
    <button
      type="button"
      onClick={toggleRecent}
      // 字体规格（设计 §5）：text-xs / font-semibold / uppercase / tracking-wider / muted
      className="
        w-full flex items-center gap-1 px-3 pt-3 pb-1.5
        text-xs font-semibold uppercase tracking-wider text-muted-foreground
        hover:bg-muted rounded transition-colors
      "
    >
      {/* chevron：展开 → ↓ ; 折叠 → → */}
      {recentExpanded ? (
        <ChevronDown
          data-testid="recent-chevron-down"
          className="h-3.5 w-3.5"
        />
      ) : (
        <ChevronRight
          data-testid="recent-chevron-right"
          className="h-3.5 w-3.5"
        />
      )}
      <span>最近</span>
    </button>
  )
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `npm test -- src/components/session/RecentHeader.test.tsx --run`
Expected: 全部 4 个 case PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/session/RecentHeader.tsx src/components/session/RecentHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): RecentHeader — 「最近 ⌄」一级折叠头

设计：[[会话历史层级化-设计]] §4

- 字体：text-xs + font-semibold + uppercase + muted（设计 §5）
- 点击 toggle store.recentExpanded
- chevron 跟随状态切换 (Down/Right)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ProjectGroup 组件 — 工程名 + sessions 列表

**Files:**
- Create: `src/components/session/ProjectGroup.tsx`
- Create: `src/components/session/ProjectGroup.test.tsx`

- [ ] **Step 1: 写 failing test**

`src/components/session/ProjectGroup.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectGroup } from './ProjectGroup'
import { useSidebarStore } from '@/store/sidebar'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

// SessionItem 用 react-router 的 hook，要包 MemoryRouter
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: '示例工程',
  status: 'ready',
  description: '',
  ...over,
} as Project)

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  project_id: 'p1',
  title: '会话标题',
  created_at: '2026-05-13T00:00:00Z',
  updated_at: '2026-05-13T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('ProjectGroup', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('渲染工程名', () => {
    const project = mkProject({ id: 'p1', name: '订单系统' })
    renderWithRouter(<ProjectGroup project={project} sessions={[mkSession()]} />)
    expect(screen.getByText('订单系统')).toBeInTheDocument()
  })

  it('展开状态下渲染 session 列表', () => {
    const project = mkProject({ id: 'p1' })
    const sessions = [
      mkSession({ id: 's1', title: '第一条会话' }),
      mkSession({ id: 's2', title: '第二条会话' }),
    ]
    renderWithRouter(<ProjectGroup project={project} sessions={sessions} />)
    expect(screen.getByText('第一条会话')).toBeInTheDocument()
    expect(screen.getByText('第二条会话')).toBeInTheDocument()
  })

  it('折叠状态下不渲染 session 列表', () => {
    const project = mkProject({ id: 'p1' })
    useSidebarStore.setState({
      recentExpanded: true,
      projectExpanded: { p1: false },
    })
    renderWithRouter(
      <ProjectGroup
        project={project}
        sessions={[mkSession({ id: 's1', title: '隐藏会话' })]}
      />
    )
    expect(screen.queryByText('隐藏会话')).not.toBeInTheDocument()
  })

  it('点击工程名切换该工程的折叠状态', () => {
    const project = mkProject({ id: 'p1' })
    renderWithRouter(<ProjectGroup project={project} sessions={[mkSession()]} />)
    // 默认展开
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(true)
    // 点工程名行
    fireEvent.click(screen.getByRole('button', { name: /示例工程/ }))
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
  })

  it('展开状态下 chevron 朝下，折叠时朝右', () => {
    const project = mkProject({ id: 'p1' })
    const { rerender } = renderWithRouter(
      <ProjectGroup project={project} sessions={[mkSession()]} />
    )
    expect(screen.getByTestId('project-p1-chevron-down')).toBeInTheDocument()

    // 折叠后重新渲染
    useSidebarStore.setState({ projectExpanded: { p1: false }, recentExpanded: true })
    rerender(<MemoryRouter><ProjectGroup project={project} sessions={[mkSession()]} /></MemoryRouter>)
    expect(screen.getByTestId('project-p1-chevron-right')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `npm test -- src/components/session/ProjectGroup.test.tsx --run`
Expected: FAIL，报错 "Cannot find module './ProjectGroup'"。

- [ ] **Step 3: 写最小实现**

`src/components/session/ProjectGroup.tsx`:

```typescript
/**
 * src/components/session/ProjectGroup.tsx
 *
 * 单个工程的折叠组：工程名（折叠头）+ session 列表。
 *
 * 点工程名行 → 仅 toggle 折叠（不切工程，设计 §3 决策 3）。
 * 点 session 项 → 由 SessionItem 负责 navigate（设计 §7）。
 *
 * 设计：[[会话历史层级化-设计]] §4
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar'
import { SessionItem } from './SessionItem'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

interface Props {
  project: Project
  sessions: Session[]
}

export function ProjectGroup({ project, sessions }: Props) {
  // 当前工程的展开状态（含 undefined → true 兜底）
  const isExpanded = useSidebarStore(s => s.isProjectExpanded(project.id))
  const toggleProject = useSidebarStore(s => s.toggleProject)

  return (
    <div className="text-sm">
      {/* 工程名行（点击 toggle，不切工程） */}
      <button
        type="button"
        onClick={() => toggleProject(project.id)}
        // 字体规格（设计 §5）：text-sm / font-medium / foreground
        className="
          w-full flex items-center gap-1 px-3 py-1.5
          text-sm font-medium text-foreground
          hover:bg-muted rounded transition-colors
        "
      >
        {isExpanded ? (
          <ChevronDown
            data-testid={`project-${project.id}-chevron-down`}
            className="h-3.5 w-3.5 text-muted-foreground"
          />
        ) : (
          <ChevronRight
            data-testid={`project-${project.id}-chevron-right`}
            className="h-3.5 w-3.5 text-muted-foreground"
          />
        )}
        <span className="truncate">{project.name}</span>
      </button>

      {/* 展开时渲染 sessions 列表 */}
      {isExpanded && (
        <ul className="space-y-0.5">
          {sessions.map(s => (
            <SessionItem key={s.id} session={s} project={project} />
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `npm test -- src/components/session/ProjectGroup.test.tsx --run`
Expected: 全部 5 个 case PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/session/ProjectGroup.tsx src/components/session/ProjectGroup.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): ProjectGroup — 工程名折叠头 + sessions 列表

设计：[[会话历史层级化-设计]] §4, §7

- 字体：text-sm + font-medium + foreground（设计 §5）
- 点工程名 toggle 折叠，不切工程（决策 3）
- 复用 SessionItem 渲染 session 项

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SessionHistoryGrouped — 主组件（排序 + 过滤 + 占位 + fetch）

**Files:**
- Create: `src/components/session/SessionHistoryGrouped.tsx`
- Create: `src/components/session/SessionHistoryGrouped.test.tsx`

- [ ] **Step 1: 写 failing test**

`src/components/session/SessionHistoryGrouped.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionHistoryGrouped } from './SessionHistoryGrouped'
import { useSidebarStore } from '@/store/sidebar'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import type { Project } from '@/types/project'
import type { Session } from '@/types/session'

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: '示例工程',
  status: 'ready',
  description: '',
  ...over,
} as Project)

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  project_id: 'p1',
  title: '会话',
  created_at: '2026-05-13T00:00:00Z',
  updated_at: '2026-05-13T01:00:00Z',
  message_count: 2,
  ...over,
})

describe('SessionHistoryGrouped', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
    })
    // 把 fetchSessions 替换为 spy，避免触发真实 API
    vi.spyOn(useSessionStore.getState(), 'fetchSessions').mockResolvedValue()
  })

  it('渲染「最近」标题', () => {
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('所有工程都没 session 时显示占位文案', () => {
    useProjectStore.setState({
      projects: [mkProject({ id: 'p1' })],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: { p1: [] },
      fetchedProjects: new Set(['p1']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText(/还没有对话历史/)).toBeInTheDocument()
  })

  it('只渲染有 session 的工程（决策 8）', () => {
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p1', name: '有会话工程' }),
        mkProject({ id: 'p2', name: '空工程' }),
      ],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1' })],
        p2: [],
      },
      fetchedProjects: new Set(['p1', 'p2']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.getByText('有会话工程')).toBeInTheDocument()
    expect(screen.queryByText('空工程')).not.toBeInTheDocument()
  })

  it('工程按 max(session.updated_at) 倒序', () => {
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p_old', name: '老工程' }),
        mkProject({ id: 'p_new', name: '新工程' }),
      ],
      currentProjectId: 'p_new',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {
        p_old: [mkSession({ id: 's_o', project_id: 'p_old', updated_at: '2026-01-01T00:00:00Z' })],
        p_new: [mkSession({ id: 's_n', project_id: 'p_new', updated_at: '2026-05-13T00:00:00Z' })],
      },
      fetchedProjects: new Set(['p_old', 'p_new']),
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    // DOM 顺序：新工程在前
    const projectNames = screen
      .getAllByRole('button')
      .map(btn => btn.textContent ?? '')
      .filter(t => t.includes('工程'))
    expect(projectNames[0]).toContain('新工程')
    expect(projectNames[1]).toContain('老工程')
  })

  it('「最近」折叠时不渲染任何工程', () => {
    useProjectStore.setState({
      projects: [mkProject({ id: 'p1', name: '工程A' })],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: { p1: [mkSession()] },
      fetchedProjects: new Set(['p1']),
      isLoading: false,
      error: null,
    })
    useSidebarStore.setState({ recentExpanded: false, projectExpanded: {} })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(screen.queryByText('工程A')).not.toBeInTheDocument()
  })

  it('mount 时对未拉过的工程触发 fetchSessions', () => {
    const fetchSpy = vi.fn().mockResolvedValue(undefined)
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
      fetchSessions: fetchSpy,
    } as Partial<ReturnType<typeof useSessionStore.getState>> as never)
    useProjectStore.setState({
      projects: [
        mkProject({ id: 'p1' }),
        mkProject({ id: 'p2' }),
      ],
      currentProjectId: 'p1',
      isLoading: false,
      error: null,
    })
    renderWithRouter(<SessionHistoryGrouped />)
    expect(fetchSpy).toHaveBeenCalledWith('p1')
    expect(fetchSpy).toHaveBeenCalledWith('p2')
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `npm test -- src/components/session/SessionHistoryGrouped.test.tsx --run`
Expected: FAIL，报错 "Cannot find module './SessionHistoryGrouped'"。

- [ ] **Step 3: 写最小实现**

`src/components/session/SessionHistoryGrouped.tsx`:

```typescript
/**
 * src/components/session/SessionHistoryGrouped.tsx
 *
 * Sidebar 中段主组件。
 *
 * 三层结构：「最近 → 工程 → session」
 *  - 顶部 RecentHeader 控制整组折叠
 *  - 中间按 max(session.updated_at) 倒序的 ProjectGroup 列表
 *  - 只显示有 session 的工程（设计 §3 决策 8）
 *
 * 设计：[[会话历史层级化-设计]] §4, §6
 */
import { useEffect, useMemo } from 'react'

import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { useSidebarStore } from '@/store/sidebar'
import { RecentHeader } from './RecentHeader'
import { ProjectGroup } from './ProjectGroup'

export function SessionHistoryGrouped() {
  // 顶层折叠状态
  const recentExpanded = useSidebarStore(s => s.recentExpanded)
  // 数据源
  const projects = useProjectStore(s => s.projects)
  const sessionsByProject = useSessionStore(s => s.sessionsByProject)
  const fetchedProjects = useSessionStore(s => s.fetchedProjects)
  const fetchSessions = useSessionStore(s => s.fetchSessions)

  // mount + projects 变化时给每个未拉过的工程拉一次 sessions（沿用旧 SessionHistory 的模式）
  useEffect(() => {
    projects.forEach(p => {
      if (!fetchedProjects.has(p.id)) {
        fetchSessions(p.id)
      }
    })
  }, [projects, fetchedProjects, fetchSessions])

  // 派生：排序后的工程列表（过滤 + 排序），不污染 store
  const sortedProjects = useMemo(() => {
    return projects
      .map(p => {
        const sessions = sessionsByProject[p.id] ?? []
        // max(session.updated_at) 作为该工程"最后活跃时间"；没 session 则为 0
        const lastActive = sessions.length > 0
          ? Math.max(...sessions.map(s => new Date(s.updated_at).getTime()))
          : 0
        return { project: p, sessions, lastActive }
      })
      .filter(x => x.sessions.length > 0)  // 决策 8：只显示有 session 的工程
      .sort((a, b) => b.lastActive - a.lastActive)  // 决策 7：倒序
  }, [projects, sessionsByProject])

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-2">
      <RecentHeader />

      {/* 顶层折叠时不渲染下面任何工程 */}
      {recentExpanded && (
        <>
          {sortedProjects.length === 0 ? (
            <p className="px-3 py-4 text-[15px] text-muted-foreground text-center">
              还没有对话历史 — 点上方「+ 新对话」开始
            </p>
          ) : (
            <div className="mt-1 space-y-1">
              {sortedProjects.map(({ project, sessions }) => (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  sessions={sessions}
                />
              ))}
            </div>
          )}
        </>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `npm test -- src/components/session/SessionHistoryGrouped.test.tsx --run`
Expected: 全部 6 个 case PASS。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/session/SessionHistoryGrouped.tsx src/components/session/SessionHistoryGrouped.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): SessionHistoryGrouped — 主组件（排序 + 过滤 + 占位 + fetch）

设计：[[会话历史层级化-设计]] §4, §6.2, §6.3, §8

- useEffect 自动 fetchSessions 未拉过的工程（沿用旧模式）
- useMemo 排序 + 过滤（不污染 sessions store）
- 工程按 max(session.updated_at) 倒序（决策 7）
- 只显示有 session 的工程（决策 8）
- 顶层折叠时整体隐藏；空 state 显示占位文案

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Sidebar.tsx 集成 — 替换中段

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 读现状确认改动范围**

Run: `head -160 src/components/layout/Sidebar.tsx`
要替换的是从 `{/* ─── 会话历史（统一 15px + foreground） ─── */}` 到底部 footer 之前的整个 `<nav>` 段。

- [ ] **Step 2: 写 minimal 集成测试（确认替换后还能 mount）**

`src/components/layout/Sidebar.test.tsx`（新建）：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { useSidebarStore } from '@/store/sidebar'

describe('Sidebar 集成 SessionHistoryGrouped', () => {
  beforeEach(() => {
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
    useProjectStore.setState({
      projects: [],
      currentProjectId: null,
      isLoading: false,
      error: null,
    })
    useSessionStore.setState({
      sessionsByProject: {},
      fetchedProjects: new Set(),
      isLoading: false,
      error: null,
    })
  })

  it('渲染时包含「最近」分组头', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('最近')).toBeInTheDocument()
  })

  it('保留顶部「+ 新对话」按钮', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /新对话/ })).toBeInTheDocument()
  })

  it('保留底部「设置」入口', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByText('设置')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 跑 test 看它失败**

Run: `npm test -- src/components/layout/Sidebar.test.tsx --run`
Expected: FAIL（"最近" 还没出现在 sidebar 里）。

- [ ] **Step 4: 改 Sidebar.tsx 把中段换成 SessionHistoryGrouped**

`src/components/layout/Sidebar.tsx` 改动：

(a) 把顶部 import 区调整：去掉 `SessionItem` import（不再直接用），加 `SessionHistoryGrouped` import。

替换：

```typescript
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { useProjectStore } from '@/store/projects'
import { useSessionStore } from '@/store/sessions'
import { SessionItem } from '@/components/session/SessionItem'
```

改成：

```typescript
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { useProjectStore } from '@/store/projects'
import { SessionHistoryGrouped } from '@/components/session/SessionHistoryGrouped'
```

(b) 删掉组件内不再用的 sessions hook + 当前工程兜底逻辑，因为 SessionHistoryGrouped 自己管：

替换：

```typescript
  const projects = useProjectStore(s => s.projects)
  const currentProject = projects.find(p => p.id === projectId)
  const sessionsByProject = useSessionStore(s => s.sessionsByProject)
  const fetchedProjects = useSessionStore(s => s.fetchedProjects)
  const fetchSessions = useSessionStore(s => s.fetchSessions)

  // 当前工程一切换就拉一次会话
  useEffect(() => {
    if (currentProject && !fetchedProjects.has(currentProject.id)) {
      fetchSessions(currentProject.id)
    }
  }, [currentProject, fetchedProjects, fetchSessions])

  const sessions = currentProject ? (sessionsByProject[currentProject.id] ?? []) : []
```

改成：

```typescript
  // sessions 拉取 / 排序 / 过滤都交给 SessionHistoryGrouped
```

并把 `useEffect` 的 import 顶部移除（如果文件里只剩这一个用法）。

(c) 把中段的 `<nav>...</nav>` 整段替换成：

```typescript
      <SessionHistoryGrouped />
```

完整改完后 `Sidebar.tsx` 的中段是：

```typescript
      {/* ─── 动作组（保留原状） ─── */}
      <div className="px-2 py-1 space-y-0.5">
        <button
          type="button"
          onClick={goNewChat}
          disabled={!projectId}
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-[15px] font-medium text-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Edit className="h-[18px] w-[18px]" />
          新对话
        </button>
        <button
          type="button"
          disabled
          title="搜索对话（v1.5 上线）"
          className="
            w-full flex items-center gap-2.5 px-3 py-2 rounded-lg
            text-[15px] text-foreground
            hover:bg-muted transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <Search className="h-[18px] w-[18px]" />
          搜索对话
        </button>
      </div>

      {/* ─── 会话历史（三层折叠树，v1.5）─── */}
      <SessionHistoryGrouped />

      {/* ─── 底部：套餐 / 设置 / 帮助 + 主题（保留原状）─── */}
      <div className="border-t p-2 space-y-0.5">
        {/* ...原本的 SidebarFooterLink 等保留不动... */}
      </div>
```

(d) 因为不再用 `useEffect` 和 `useSessionStore`，把 import 简化：

```typescript
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { Edit, Search, Settings, HelpCircle, Moon, Sun, PanelLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { useProjectStore } from '@/store/projects'
import { SessionHistoryGrouped } from '@/components/session/SessionHistoryGrouped'
```

(注意 `useEffect` import 行整个删掉。)

- [ ] **Step 5: 跑 test 看它通过 + 跑全量回归**

Run:
```bash
npm test -- src/components/layout/Sidebar.test.tsx --run
npm test -- --run
```

Expected:
- Sidebar.test.tsx 3 个 case PASS
- 全量测试不引入新红

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): 中段切换为 SessionHistoryGrouped（三层折叠树）

设计：[[会话历史层级化-设计]]

- 删除原本"只显示当前工程"的会话区
- 整段替换为 SessionHistoryGrouped
- 顶部 + 新对话 / 底部设置/主题 全部保留

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 删除废弃的 SessionHistory.tsx

**Files:**
- Delete: `src/components/session/SessionHistory.tsx`

- [ ] **Step 1: 确认无人引用**

Run:
```bash
cd /Users/java/knowledge-engineering-web
grep -r "from.*SessionHistory[^G]" src/ --include='*.ts' --include='*.tsx' || echo "no references"
grep -r "import.*SessionHistory[^G]" src/ --include='*.ts' --include='*.tsx' || echo "no references"
```

Expected: 输出 "no references"（除了文件自身 / SessionHistoryGrouped 不算）。

如果有引用，需要先迁移那些引用点再回来删。

- [ ] **Step 2: 删除文件**

Run:
```bash
cd /Users/java/knowledge-engineering-web
git rm src/components/session/SessionHistory.tsx
```

- [ ] **Step 3: 跑全量测试确认无回归**

Run: `npm test -- --run`
Expected: 全部 PASS。

- [ ] **Step 4: TypeScript 编译确认无幽灵引用**

Run: `npx tsc --noEmit`
Expected: 退出码 0，无 error。

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git commit -m "$(cat <<'EOF'
chore(sidebar): 删除废弃的 SessionHistory.tsx

被 SessionHistoryGrouped 替代；保留命名易与新组件混淆。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 手工端到端验证 + 截图记录

**Files:**
- Modify: `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话历史层级化-设计.md`（添加变更日志）

- [ ] **Step 1: 启动 dev server**

Run（**前台启动**，开新窗口跑）:
```bash
cd /Users/java/knowledge-engineering-web
npm run dev
```

或后台：
```bash
cd /Users/java/knowledge-engineering-web
npm run dev > /tmp/web-dev.log 2>&1 &
```

- [ ] **Step 2: 浏览器手工过 §9 验收 checklist**

打开 http://localhost:5173 (vite 默认端口)，依次确认：

1. sidebar 中段渲染「最近」标题 + 工程组 + session 列表三层
2. 字体规格符合设计 §5（「最近」最小最灰 / 工程名中 / session 项最大）
3. 点「最近」行能切折叠状态
4. 点工程名行能切折叠（不切工程；URL 不变）
5. 刷新页面后折叠状态保留（开 DevTools → Application → Local Storage → `ke-sidebar-expanded` 应该有记录）
6. 点 session 项能切工程 + 打开会话
7. 多个工程按 `max(session.updated_at)` 倒序（最近活跃的在最上）
8. 把某工程的所有 session 删完后，刷新该工程从 sidebar 消失
9. 没有任何 session 时显示"还没有对话历史"占位
10. 切换亮 / 暗主题，颜色全部正确（无硬编码 hex）

每条不通过的项记录到下一步。

- [ ] **Step 3: 修复 §9 验收中发现的问题（如有）**

按发现的问题逐条 fix → 加 test → 再验。如果一切通过，跳过此步。

- [ ] **Step 4: 更新 Obsidian 设计文档的变更日志**

`/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话历史层级化-设计.md` 的「11. 变更日志」一节加一行：

```markdown
- 2026-05-13: 实施完成（实施计划：knowledge-engineering-web/docs/superpowers/plans/2026-05-13-sidebar-session-hierarchy.md）；§9 验收 10/10 通过。
```

- [ ] **Step 5: 关闭 dev server**

如果是前台启动，Ctrl+C。如果是后台：
```bash
pkill -f 'vite.*--host\|npm run dev' 2>/dev/null || true
```

- [ ] **Step 6: 最终 commit**

```bash
cd /Users/java/knowledge-engineering-web
git status
git log --oneline -10
```

确认本次共有 6 个 feat/chore commit（Tasks 1-6）+ 此 task 已完成。

如果有未追踪/未提交的文档变更：
```bash
git add docs/superpowers/plans/2026-05-13-sidebar-session-hierarchy.md  # 实施计划本身也提交
git commit -m "$(cat <<'EOF'
docs(plan): 会话历史层级化实施计划完成验收

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**

| Spec §  | 内容 | 实现 task |
|---|---|---|
| §3 决策 1 | 三层结构 | Task 2/3/4 |
| §3 决策 2 | 点「最近」切整组 | Task 2 |
| §3 决策 3 | 点工程名只切折叠 | Task 3 |
| §3 决策 4 | 点 session 切工程+打开 | 复用 SessionItem（现状） |
| §3 决策 5 | 默认全部展开 | Task 1（undefined → true 兜底）|
| §3 决策 6 | 状态 → localStorage | Task 1 |
| §3 决策 7 | 工程按 max(session.updated_at) 倒序 | Task 4（useMemo）|
| §3 决策 8 | 只显示有 session 工程 | Task 4（filter）|
| §3 决策 9 | 字体递增 | Task 2/3/4（class 写死）|
| §5 字体规格 | text-xs/sm/[15px] | Task 2/3 |
| §6.1 store API | useSidebarStore | Task 1 |
| §6.2 排序 useMemo | sortedProjects | Task 4 |
| §6.3 fetchSessions 时机 | useEffect | Task 4 |
| §7 交互表 | 4 种点击 | Task 2/3 + 复用 SessionItem |
| §8 边界 | 全空占位 / 隐藏空工程 / 孤儿 key 不清 | Task 4 |
| §9 验收 10 条 | — | Task 7 手验 |

无 spec 项漏覆盖。

**2. Placeholder scan:** 无 TBD / TODO；所有代码块都是可执行的完整代码（非伪代码）；所有测试都给了具体断言。

**3. Type consistency:**
- `useSidebarStore`：`recentExpanded`/`projectExpanded`/`toggleRecent`/`toggleProject`/`isProjectExpanded` 5 个名字在 Task 1-4 全部一致。
- `SessionHistoryGrouped` / `ProjectGroup` / `RecentHeader` 3 个组件名在所有 task 一致。
- `Project` / `Session` 类型字段名（`id`/`name`/`project_id`/`updated_at`）与现有 `src/types/*.ts` 一致。
- `SessionItem` props 签名 `{ session, project }` 沿用现有，没造新接口。

无不一致问题。

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-sidebar-session-hierarchy.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 每个 task 派一个 fresh subagent 实现，task 之间快速 review + 迭代

**2. Inline Execution** - 当前会话内按批次执行，到 checkpoint 时停下来 review

**Which approach?**
