/**
 * src/pages/settings/ProjectDetailPage.tsx
 *
 * 工程详情页（/settings/projects/:pid）：
 *   - 基本信息（git_url / branch / status / last_synced_at）
 *   - 继承成员（只读）+ 直接成员（可编辑）
 *   - Owner / Admin：触发重索引 / 编辑配置 / 删除工程
 *
 * 设计文档：[[multi-tenant-rbac-设计]]
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  RefreshCw,
  Pencil,
  Trash2,
  Plus,
  GitBranch,
  Users,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { listProjectMembers, addProjectMember, removeProjectMember, changeProjectMemberRole } from '@/api/projectMembers'
import { getProject } from '@/api/projects'
import { updateAdminProject, deleteAdminProject } from '@/api/admin'
import { apiClient } from '@/api/client'
import type { Project } from '@/types/project'
import type { ProjectMembers, ProjectDirectMember, ProjectInheritedMember, ProjectMemberRole } from '@/types/project'
import { useAuthStore } from '@/store/auth'

const ROLES: ProjectMemberRole[] = ['reporter', 'maintainer', 'owner']
const ROLE_LABEL: Record<ProjectMemberRole, string> = {
  reporter: '只读',
  maintainer: '维护者',
  owner: '负责人',
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ready:    { label: '就绪',   cls: 'text-emerald-600 dark:text-emerald-400' },
  indexing: { label: '索引中', cls: 'text-amber-600 dark:text-amber-400' },
  partial:  { label: '部分就绪', cls: 'text-orange-600 dark:text-orange-400' },
  failed:   { label: '失败',   cls: 'text-red-600 dark:text-red-400' },
}

// ─── EditProjectModal ──────────────────────────────────────────────────────────

function EditProjectModal({
  open,
  project,
  onClose,
  onUpdated,
}: {
  open: boolean
  project: Project
  onClose: () => void
  onUpdated: () => void
}) {
  const [name, setName] = useState(project.name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(project.name); setError(null) }
  }, [open, project])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await updateAdminProject(project.id, { name: name.trim() })
      onClose()
      onUpdated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="编辑工程配置" width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">工程名称 *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={submitting}
            required
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

// ─── AddDirectMemberModal ──────────────────────────────────────────────────────

function AddDirectMemberModal({
  open,
  projectId,
  onClose,
  onAdded,
}: {
  open: boolean
  projectId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<ProjectMemberRole>('reporter')
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
      await addProjectMember(projectId, uid, role)
      handleClose()
      onAdded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="添加直接成员" width="sm">
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
            onChange={e => setRole(e.target.value as ProjectMemberRole)}
            disabled={submitting}
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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

// ─── InheritedMembersTable ─────────────────────────────────────────────────────

function InheritedMembersTable({ members }: { members: ProjectInheritedMember[] }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold mb-3 flex items-center gap-2">
        <Users className="h-4 w-4" />
        继承成员（{members.length}）
        <span className="text-[12px] font-normal text-muted-foreground">— 通过 Group 继承，只读</span>
      </h2>
      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_160px] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>用户名</div>
          <div>角色</div>
          <div>来源组</div>
        </div>
        {members.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">暂无继承成员</div>
        ) : (
          members.map(m => (
            <div
              key={`${m.user_id}-${m.inherited_from_group_id}`}
              className="grid grid-cols-[1fr_120px_160px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
            >
              <div>
                <span className="font-medium">{m.username}</span>
                <span className="text-[12px] text-muted-foreground ml-2">#{m.user_id}</span>
              </div>
              <div className="text-[13px] text-muted-foreground">{ROLE_LABEL[m.role]}</div>
              <div className="font-mono text-[12px] text-muted-foreground">{m.inherited_from_group_id}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

// ─── ProjectDetailPage ─────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { pid } = useParams<{ pid: string }>()
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_admin ?? false

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMembers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [removingUid, setRemovingUid] = useState<number | null>(null)
  const [reindexing, setReindexing] = useState(false)

  const projectId = pid ?? ''

  const refresh = async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const [p, m] = await Promise.all([getProject(projectId), listProjectMembers(projectId)])
      setProject(p)
      setMembers(m)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [projectId])

  const onReindex = async () => {
    if (!confirm('确定触发重索引？这将重新解析整个代码库。')) return
    setReindexing(true)
    try {
      // POST /admin/projects/:id/reindex 触发重新索引（后端 pipeline 会自动启动）
      await apiClient.post(`/admin/projects/${encodeURIComponent(projectId)}/reindex`)
      await refresh()
    } catch (e) {
      alert(`触发失败：${(e as Error).message}`)
    } finally {
      setReindexing(false)
    }
  }

  const onDelete = async () => {
    if (!project) return
    if (!confirm(`确定删除工程「${project.name}」？\n所有相关的会话、消息也会被级联删除。`)) return
    try {
      await deleteAdminProject(projectId)
      navigate('/settings/repos')
    } catch (e) {
      alert(`删除失败：${(e as Error).message}`)
    }
  }

  const onChangeDirectMemberRole = async (uid: number, role: ProjectMemberRole) => {
    try {
      await changeProjectMemberRole(projectId, uid, role)
      setMembers(prev => prev
        ? { ...prev, direct: prev.direct.map(m => m.user_id === uid ? { ...m, role } : m) }
        : prev
      )
    } catch (e) {
      alert(`修改角色失败：${(e as Error).message}`)
    }
  }

  const onRemoveDirectMember = async (uid: number, username: string) => {
    if (!confirm(`确定将「${username}」从工程移除？`)) return
    setRemovingUid(uid)
    try {
      await removeProjectMember(projectId, uid)
      setMembers(prev => prev
        ? { ...prev, direct: prev.direct.filter(m => m.user_id !== uid) }
        : prev
      )
    } catch (e) {
      alert(`移除失败：${(e as Error).message}`)
    } finally {
      setRemovingUid(null)
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-center text-muted-foreground text-sm">加载中…</div>
  }

  if (error || !project) {
    return (
      <div className="px-6 py-8">
        <div className="px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error ?? '工程不存在'}
        </div>
      </div>
    )
  }

  const st = STATUS_LABEL[project.status] ?? STATUS_LABEL.ready
  const direct: ProjectDirectMember[] = members?.direct ?? []
  const inherited: ProjectInheritedMember[] = members?.inherited ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* 返回 + 标题 */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/settings/repos')}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          返回仓库列表
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <span className={`text-[13px] font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-[13px] text-muted-foreground">
              <span>ID：<code className="font-mono">{project.id}</code></span>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                分支信息（详见仓库管理）
              </span>
              {project.pipeline_at && <span>最后同步：{formatTime(project.pipeline_at)}</span>}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReindex}
                disabled={reindexing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${reindexing ? 'animate-spin' : ''}`} />
                重索引
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />
                编辑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 统计信息 */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { label: '方法数', value: project.stats.methods_count },
          { label: '类数',   value: project.stats.classes_count },
          { label: '解读进度', value: `${project.stats.interpretation_progress}%` },
        ].map(({ label, value }) => (
          <div key={label} className="border rounded-xl px-5 py-4">
            <p className="text-[12px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {/* 继承成员（只读） */}
      <InheritedMembersTable members={inherited} />

      {/* 直接成员（可编辑） */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            直接成员（{direct.length}）
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
          {direct.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-sm">暂无直接成员</div>
          ) : (
            direct.map((m: ProjectDirectMember) => (
              <div
                key={m.user_id}
                className="grid grid-cols-[1fr_120px_140px_60px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
              >
                <div>
                  <span className="font-medium">{m.username}</span>
                  <span className="text-[12px] text-muted-foreground ml-2">#{m.user_id}</span>
                </div>
                <div>
                  {isAdmin ? (
                    <select
                      value={m.role}
                      onChange={e => onChangeDirectMemberRole(m.user_id, e.target.value as ProjectMemberRole)}
                      className="px-2 py-1 text-[13px] bg-background border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
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
                      onClick={() => onRemoveDirectMember(m.user_id, m.username)}
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

      <EditProjectModal
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void refresh()}
      />
      <AddDirectMemberModal
        open={addMemberOpen}
        projectId={projectId}
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
