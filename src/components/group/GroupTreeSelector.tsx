/**
 * src/components/group/GroupTreeSelector.tsx
 *
 * 按 Group 分组的工程树形选择器，替换 TopBar 的扁平下拉。
 *
 * 功能：
 *  - 将 flat groups 转成嵌套树（buildTree）
 *  - 每个 GroupNode 可展开 / 折叠（默认展开）
 *  - 工程项点击 → 调用 onSelect(pid)
 *  - 当前工程高亮（bg-primary/10）
 *  - 支持 light + dark 主题（全用 Tailwind 语义色 / CSS 变量，无硬编码）
 *
 * 设计文档：[[multi-tenant-rbac-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */
import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, FolderClosed, Layers } from 'lucide-react'

import type { Group } from '@/types/group'
import type { Project } from '@/types/project'
import { StatusChip } from '@/components/project/StatusChip'

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GroupTreeSelectorProps {
  /** 当前用户可见的所有 Group（flat 列表，含嵌套关系） */
  groups: Group[]
  /** 当前用户可访问的所有工程 */
  projects: Project[]
  /** 当前选中工程的 ID（高亮用），可为 undefined */
  currentProjectId?: string
  /** 点击某个工程时的回调，传入工程 ID */
  onSelect: (pid: string) => void
}

// ─── Internal types ───────────────────────────────────────────────────────────

/**
 * 树节点：Group + 子 Group 列表 + 该 Group 直接归属的工程列表
 */
interface GroupTreeNode {
  group: Group
  children: GroupTreeNode[]
  /** 属于该 Group（parent_group_id === group.id，或无任何 group 归属的孤立工程放根层）下的工程 */
  projects: Project[]
}

// ─── Helper: buildTree ────────────────────────────────────────────────────────

/**
 * 将 flat groups + flat projects 转成嵌套树结构。
 *
 * 算法：
 *  1. 先按 parent_group_id 把 groups 分成顶层组 / 子组两类
 *  2. 递归把子组挂到父节点上
 *  3. 把 projects 按 group_id 挂到对应节点（v2 Project 暂无 group_id 字段，
 *     因此全部挂在根层；当后端有 group_id 字段时只需改此函数）
 *
 * @param groups   - 所有可见 Group（flat）
 * @param projects - 所有可见 Project（flat）
 * @returns        - 树根节点数组；孤立工程通过 orphanProjects 额外返回
 */
export function buildTree(
  groups: Group[],
  projects: Project[],
): { roots: GroupTreeNode[]; orphanProjects: Project[] } {
  // 用 Map 快速查找：groupId → 对应 node
  const nodeMap = new Map<string, GroupTreeNode>()

  // 第一遍：为每个 group 创建空 node
  for (const g of groups) {
    nodeMap.set(g.id, { group: g, children: [], projects: [] })
  }

  // 第二遍：把子 node 挂到父 node；顶层 node 收集到 roots
  const roots: GroupTreeNode[] = []
  for (const g of groups) {
    const node = nodeMap.get(g.id)!
    if (g.parent_group_id && nodeMap.has(g.parent_group_id)) {
      // 有父且父节点存在 → 挂到父节点的 children 数组
      nodeMap.get(g.parent_group_id)!.children.push(node)
    } else {
      // 无父（或父不在可见列表）→ 顶层
      roots.push(node)
    }
  }

  // 第三遍：把 projects 挂到对应 group
  // TODO: 当 Project 类型增加 group_id 字段时，在这里改分配逻辑
  // 目前 Project 没有 group_id，所有工程视为孤立工程显示在树底部
  const orphanProjects = [...projects]

  return { roots, orphanProjects }
}

// ─── GroupNode（递归子组件）──────────────────────────────────────────────────

interface GroupNodeProps {
  node: GroupTreeNode
  currentProjectId?: string
  onSelect: (pid: string) => void
  /** 缩进层级，从 0 开始；每层加 12px 缩进 */
  depth: number
}

/**
 * 单个 Group 节点：可展开/折叠，递归渲染子 Group + 工程列表。
 */
function GroupNode({ node, currentProjectId, onSelect, depth }: GroupNodeProps) {
  // useState：控制该节点是否展开（默认 true = 展开）
  const [open, setOpen] = useState(true)

  const hasContent = node.children.length > 0 || node.projects.length > 0
  const indentPx = depth * 12

  return (
    <div>
      {/* ── Group 标题行 ── */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="
          w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md
          text-sm font-medium text-foreground
          hover:bg-muted transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
        style={{ paddingLeft: `${8 + indentPx}px` }}
        aria-expanded={open}
      >
        {/* 展开/折叠图标 */}
        {hasContent ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          // 占位让对齐一致
          <span className="h-3.5 w-3.5 shrink-0" />
        )}

        {/* 文件夹图标：展开用 FolderOpen，折叠用 FolderClosed */}
        {open
          ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          : <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />
        }

        <span className="truncate">{node.group.name}</span>
      </button>

      {/* ── 展开时渲染子节点 + 工程列表 ── */}
      {open && (
        <div>
          {/* 子 Group（递归） */}
          {node.children.map(child => (
            <GroupNode
              key={child.group.id}
              node={child}
              currentProjectId={currentProjectId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}

          {/* 该 Group 直属的工程 */}
          {node.projects.map(p => (
            <ProjectRow
              key={p.id}
              project={p}
              currentProjectId={currentProjectId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ProjectRow ───────────────────────────────────────────────────────────────

interface ProjectRowProps {
  project: Project
  currentProjectId?: string
  onSelect: (pid: string) => void
  depth: number
}

/**
 * 工程行：点击触发 onSelect；当前工程高亮。
 * indexing / failed 状态不可点击。
 */
function ProjectRow({ project, currentProjectId, onSelect, depth }: ProjectRowProps) {
  const isCurrent = project.id === currentProjectId
  // 允许点选任意状态工程（含 indexing/failed）：索引进度面板 / 报错+重新索引都在工程页内呈现，
  // QA 输入由页面内 gating 控制。原先禁用导致刚通过连接向导建好的"索引中"工程点不进去、
  // 进度面板被锁在门后、看不到进度。
  const indentPx = depth * 12

  return (
    <button
      type="button"
      onClick={() => onSelect(project.id)}
      data-project-id={project.id}
      className={[
        'w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-sm transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // 当前选中高亮：使用 bg-primary/10（CSS 变量，light + dark 自动适配）
        isCurrent
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-foreground hover:bg-muted',
      ].join(' ')}
      style={{ paddingLeft: `${8 + indentPx}px` }}
    >
      {/* 当前项前置 checkmark */}
      {isCurrent && (
        <span className="h-3.5 w-3.5 shrink-0 text-primary text-xs leading-none">✓</span>
      )}
      {!isCurrent && <span className="h-3.5 w-3.5 shrink-0" />}

      <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

      <span className="truncate">{project.name}</span>

      {/* 状态角标：只展示非 ready 状态 */}
      {project.status !== 'ready' && (
        <span className="ml-auto">
          <StatusChip status={project.status} />
        </span>
      )}
    </button>
  )
}

// ─── GroupTreeSelector（公开根组件）──────────────────────────────────────────

/**
 * 树形工程选择器根组件。
 *
 * 渲染顺序：
 *  1. 有 Group 的树结构（递归 GroupNode）
 *  2. 无 Group 的孤立工程（flatList，直接列在底部）
 *  3. 两者都没有 → 空状态提示
 */
export function GroupTreeSelector({
  groups,
  projects,
  currentProjectId,
  onSelect,
}: GroupTreeSelectorProps) {
  const { roots, orphanProjects } = buildTree(groups, projects)
  const isEmpty = roots.length === 0 && orphanProjects.length === 0

  if (isEmpty) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
        暂无可用工程
      </div>
    )
  }

  return (
    <div className="py-1">
      {/* 带 Group 的树结构 */}
      {roots.map(root => (
        <GroupNode
          key={root.group.id}
          node={root}
          currentProjectId={currentProjectId}
          onSelect={onSelect}
          depth={0}
        />
      ))}

      {/* 孤立工程（无 Group 归属） */}
      {orphanProjects.length > 0 && (
        <div>
          {roots.length > 0 && (
            <div className="mx-2 my-1 border-t border-border" />
          )}
          {orphanProjects.map(p => (
            <ProjectRow
              key={p.id}
              project={p}
              currentProjectId={currentProjectId}
              onSelect={onSelect}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
