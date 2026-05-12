/**
 * src/pages/settings/GroupDetailPage.tsx
 *
 * Group 详情页（/settings/groups/:gid）：
 *   - 基本信息（name / description / parent）
 *   - 成员列表（user_id / username / role / 删除）
 *   - 子组列表
 * Owner / Admin 可：编辑信息 / 加成员 / 改 role / 删成员
 *
 * 设计文档：[[groups-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronLeft, Pencil, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  getGroup,
  listGroupMembers,
  addGroupMember,
  changeGroupMemberRole,
  removeGroupMember,
  updateGroup,
} from '@/api/groups'
import type { Group, GroupMember, Role } from '@/types/group'
import { useAuthStore } from '@/store/auth'

const ROLES: Role[] = ['reporter', 'maintainer', 'owner']
const ROLE_LABEL: Record<Role, string> = {
  reporter: '只读',
  maintainer: '维护者',
  owner: '负责人',
}

// ─── EditGroupModal ────────────────────────────────────────────────────────────

function EditGroupModal({
  open,
  group,
  onClose,
  onUpdated,
}: {
  open: boolean
  group: Group
  onClose: () => void
  onUpdated: (g: Group) => void
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(group.name)
      setDescription(group.description ?? '')
      setError(null)
    }
  }, [open, group])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onUpdated(updated)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="编辑用户组" width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">组名称 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
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
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>取消</Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── AddMemberModal ────────────────────────────────────────────────────────────

function AddMemberModal({
  open,
  groupId,
  onClose,
  onAdded,
}: {
  open: boolean
  groupId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<Role>('reporter')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setUserId(''); setRole('reporter'); setError(null)
    onClose()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const uid = parseInt(userId, 10)
    if (isNaN(uid)) { setError('请输入有效的用户 ID（整数）'); return }
    setSubmitting(true)
    setError(null)
    try {
      await addGroupMember(groupId, uid, role)
      handleClose()
      onAdded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="添加成员" width="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">用户 ID *</label>
          <input
            type="number"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="如：42"
            disabled={submitting}
            required
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">角色</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            disabled={submitting}
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
        {error && (
          <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button type="submit" disabled={!userId || submitting}>
            {submitting ? '添加中…' : '添加'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── GroupDetailPage ───────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { gid } = useParams<{ gid: string }>()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_admin ?? false

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [removingUid, setRemovingUid] = useState<number | null>(null)

  const groupId = gid ?? ''

  const refresh = async () => {
    if (!groupId) return
    setLoading(true)
    setError(null)
    try {
      const [g, m] = await Promise.all([getGroup(groupId), listGroupMembers(groupId)])
      setGroup(g)
      setMembers(m)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [groupId])

  const onChangeRole = async (uid: number, role: Role) => {
    if (!groupId) return
    try {
      await changeGroupMemberRole(groupId, uid, role)
      setMembers(prev => prev.map(m => m.user_id === uid ? { ...m, role } : m))
    } catch (e) {
      alert(`修改角色失败：${(e as Error).message}`)
    }
  }

  const onRemoveMember = async (uid: number, username: string) => {
    if (!confirm(`确定将「${username}」从组中移除？`)) return
    setRemovingUid(uid)
    try {
      await removeGroupMember(groupId, uid)
      setMembers(prev => prev.filter(m => m.user_id !== uid))
    } catch (e) {
      alert(`移除失败：${(e as Error).message}`)
    } finally {
      setRemovingUid(null)
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 text-center text-muted-foreground text-sm">加载中…</div>
    )
  }

  if (error || !group) {
    return (
      <div className="px-6 py-8">
        <div className="px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error ?? '组不存在'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* 返回 + 标题 */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/settings/groups')}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          返回组列表
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{group.name}</h1>
            {group.description && (
              <p className="mt-1 text-[14px] text-muted-foreground">{group.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              <span>ID：<code className="font-mono">{group.id}</code></span>
              {group.parent_group_id && (
                <span>父组：<code className="font-mono">{group.parent_group_id}</code></span>
              )}
              <span>创建：{formatTime(group.created_at)}</span>
            </div>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              编辑
            </Button>
          )}
        </div>
      </div>

      {/* 成员列表 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            成员（{members.length}）
          </h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddMemberOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              添加成员
            </Button>
          )}
        </div>

        <div className="border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_140px_60px] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
            <div>用户名</div>
            <div>角色</div>
            <div>加入时间</div>
            <div></div>
          </div>
          {members.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">暂无成员</div>
          ) : (
            members.map(m => (
              <div
                key={m.user_id}
                className="grid grid-cols-[1fr_120px_140px_60px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
              >
                <div>
                  <div className="font-medium">{m.username}</div>
                  <div className="text-[12px] text-muted-foreground">ID: {m.user_id}</div>
                </div>
                <div>
                  {isAdmin ? (
                    <select
                      value={m.role}
                      onChange={e => onChangeRole(m.user_id, e.target.value as Role)}
                      className="px-2 py-1 text-[13px] bg-background border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">{ROLE_LABEL[m.role]}</span>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground">{formatTime(m.added_at)}</div>
                <div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(m.user_id, m.username)}
                      disabled={removingUid === m.user_id}
                      className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      aria-label="移除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Modals */}
      <EditGroupModal
        open={editOpen}
        group={group}
        onClose={() => setEditOpen(false)}
        onUpdated={updated => setGroup(updated)}
      />
      <AddMemberModal
        open={addMemberOpen}
        groupId={groupId}
        onClose={() => setAddMemberOpen(false)}
        onAdded={() => void refresh()}
      />
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}
