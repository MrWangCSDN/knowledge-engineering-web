/**
 * src/pages/settings/GroupListPage.tsx
 *
 * Group 管理页 — 树形展示所有可见 group，点击进入详情；Admin 可新建组。
 *
 * 设计文档：[[groups-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, ChevronDown, FolderOpen, FolderClosed, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { listVisibleGroups, createGroup } from '@/api/groups'
import type { Group } from '@/types/group'
import { useAuthStore } from '@/store/auth'

// ─── Tree helpers ─────────────────────────────────────────────────────────────

interface GroupTreeNode {
  group: Group
  children: GroupTreeNode[]
}

function buildGroupTree(groups: Group[]): GroupTreeNode[] {
  const nodeMap = new Map<string, GroupTreeNode>()
  for (const g of groups) {
    nodeMap.set(g.id, { group: g, children: [] })
  }
  const roots: GroupTreeNode[] = []
  for (const g of groups) {
    const node = nodeMap.get(g.id)!
    if (g.parent_group_id && nodeMap.has(g.parent_group_id)) {
      nodeMap.get(g.parent_group_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ─── Tree node component ───────────────────────────────────────────────────────

function GroupTreeRow({
  node,
  depth,
  onNavigate,
}: {
  node: GroupTreeNode
  depth: number
  onNavigate: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const indentPx = depth * 16

  return (
    <div>
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/40 transition-colors cursor-pointer group"
        style={{ paddingLeft: `${16 + indentPx}px` }}
      >
        {/* 展开/折叠按钮（有子节点时显示） */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            setOpen(prev => !prev)
          }}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={open ? '折叠' : '展开'}
        >
          {hasChildren ? (
            open
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5 block" />
          )}
        </button>

        {/* 文件夹图标 */}
        {open
          ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          : <FolderClosed className="h-4 w-4 shrink-0 text-amber-500" />
        }

        {/* 组名（点击 → 详情） */}
        <button
          type="button"
          onClick={() => onNavigate(node.group.id)}
          className="flex-1 text-left text-[14px] font-medium group-hover:text-primary transition-colors"
        >
          {node.group.name}
        </button>

        {/* 描述 */}
        {node.group.description && (
          <span className="text-[13px] text-muted-foreground truncate max-w-[240px]">
            {node.group.description}
          </span>
        )}

        {/* 进入详情箭头 */}
        <button
          type="button"
          onClick={() => onNavigate(node.group.id)}
          className="ml-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="查看详情"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {open && node.children.map(child => (
        <GroupTreeRow
          key={child.group.id}
          node={child}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}

// ─── Create Group Modal ────────────────────────────────────────────────────────

function CreateGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setId(''); setName(''); setDescription(''); setParentId(''); setError(null)
    onClose()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createGroup({
        id: id.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        parent_group_id: parentId.trim() || undefined,
      })
      handleClose()
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="新建用户组" width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">组 ID *</label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="如：backend-team"
            disabled={submitting}
            required
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <p className="mt-1 text-[12px] text-muted-foreground">业务可读 slug，创建后不可修改</p>
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">组名称 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="如：后端开发团队"
            disabled={submitting}
            required
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">描述</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="可选"
            disabled={submitting}
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">父组 ID（可选）</label>
          <input
            type="text"
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            placeholder="如：engineering"
            disabled={submitting}
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {error && (
          <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button type="submit" disabled={!id.trim() || !name.trim() || submitting}>
            {submitting ? '创建中…' : '创建'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── GroupListPage ─────────────────────────────────────────────────────────────

export function GroupListPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_admin ?? false

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setGroups(await listVisibleGroups())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const roots = buildGroupTree(groups)

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">用户组管理</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            通过用户组批量授权，将一批用户绑定到工程并自动继承访问权限。
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            新建组
          </Button>
        )}
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          加载失败：{error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        {/* 表头 */}
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div className="flex-1">组名称</div>
          <div className="w-[200px]">描述</div>
          <div className="w-[40px]"></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">加载中…</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">还没有用户组</p>
            {isAdmin && (
              <p className="text-xs text-muted-foreground/70 mt-1">点击右上角"新建组"创建第一个用户组</p>
            )}
          </div>
        ) : (
          roots.map(root => (
            <GroupTreeRow
              key={root.group.id}
              node={root}
              depth={0}
              onNavigate={id => navigate(`/settings/groups/${encodeURIComponent(id)}`)}
            />
          ))
        )}
      </div>

      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void refresh()}
      />
    </div>
  )
}
