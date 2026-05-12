/**
 * src/pages/settings/UserListPage.tsx
 *
 * 用户管理页（admin only，/settings/users）：
 *   - 用户列表（email / username / is_admin / is_active）
 *   - toggle is_admin / is_active
 *   - 改密码（modal）
 *   - 新建用户（modal）
 *   - 删用户
 *
 * 设计文档：[[admin-users-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, UserCog } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
} from '@/api/users'
import type { AdminUser } from '@/types/user'

// ─── CreateUserModal ───────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setUsername(''); setEmail(''); setPassword(''); setIsAdmin(false); setError(null)
    onClose()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || password.length < 6) return
    setSubmitting(true)
    setError(null)
    try {
      await createAdminUser({ username: username.trim(), email: email.trim(), password, is_admin: isAdmin })
      handleClose()
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="新建用户" width="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">用户名 *</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={submitting}
            required
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">邮箱 *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={submitting}
            required
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[13px] font-medium block mb-1.5">初始密码 *（≥ 6 位）</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={submitting}
            minLength={6}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={e => setIsAdmin(e.target.checked)}
            disabled={submitting}
            className="rounded"
          />
          <span className="text-[14px]">赋予管理员权限</span>
        </label>

        {error && (
          <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button type="submit" disabled={!username || !email || password.length < 6 || submitting}>
            {submitting ? '创建中…' : '创建'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── ChangePasswordModal ────────────────────────────────────────────────────────

function ChangePasswordModal({
  open,
  user,
  onClose,
  onChanged,
}: {
  open: boolean
  user: AdminUser | null
  onClose: () => void
  onChanged: () => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => { setPassword(''); setError(null); onClose() }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || password.length < 6) return
    setSubmitting(true)
    setError(null)
    try {
      // 通过 PATCH 传 password 字段重置密码（后端接受但 TS 类型未列出此字段，故用 unknown 转换）
      await updateAdminUser(user.id, { password } as unknown as Parameters<typeof updateAdminUser>[1])
      handleClose()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={`修改密码 — ${user?.username ?? ''}`} width="sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[13px] font-medium block mb-1.5">新密码 *（≥ 6 位）</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={submitting}
            minLength={6}
            required
            autoComplete="new-password"
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
          <Button type="submit" disabled={password.length < 6 || submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Toggle chip ───────────────────────────────────────────────────────────────

function ToggleChip({
  value,
  onText,
  offText,
  onChange,
}: {
  value: boolean
  onText: string
  offText: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`px-2 py-0.5 rounded text-[12px] font-medium transition-colors ${
        value
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
          : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {value ? onText : offText}
    </button>
  )
}

// ─── UserListPage ──────────────────────────────────────────────────────────────

export function UserListPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listAdminUsers())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const toggleField = async (user: AdminUser, field: 'is_admin' | 'is_active') => {
    try {
      const updated = await updateAdminUser(user.id, { [field]: !user[field] })
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
    } catch (e) {
      alert(`操作失败：${(e as Error).message}`)
    }
  }

  const onDelete = async (user: AdminUser) => {
    if (!confirm(`确定删除用户「${user.username}」？此操作不可恢复。`)) return
    setDeleting(user.id)
    try {
      await deleteAdminUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
    } catch (e) {
      alert(`删除失败：${(e as Error).message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">用户管理</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            管理系统内所有用户账号、权限与状态。
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          新建用户
        </Button>
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          加载失败：{error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_80px_80px_120px_60px] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>用户</div>
          <div>邮箱</div>
          <div>管理员</div>
          <div>状态</div>
          <div>注册时间</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">加载中…</div>
        ) : users.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <UserCog className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">暂无用户</p>
          </div>
        ) : (
          users.map(u => (
            <div
              key={u.id}
              className="grid grid-cols-[1fr_160px_80px_80px_120px_60px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
            >
              <div>
                <div className="font-medium">{u.username}</div>
                <div className="text-[12px] text-muted-foreground">ID: {u.id}</div>
              </div>
              <div className="text-[13px] text-muted-foreground truncate">{u.email}</div>
              <div>
                <ToggleChip
                  value={u.is_admin}
                  onText="管理员"
                  offText="普通"
                  onChange={() => toggleField(u, 'is_admin')}
                />
              </div>
              <div>
                <ToggleChip
                  value={u.is_active}
                  onText="启用"
                  offText="停用"
                  onChange={() => toggleField(u, 'is_active')}
                />
              </div>
              <div className="text-[13px] text-muted-foreground">{formatTime(u.created_at)}</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPwdUser(u)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="修改密码"
                  title="修改密码"
                >
                  <UserCog className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(u)}
                  disabled={deleting === u.id}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void refresh() }}
      />
      <ChangePasswordModal
        open={pwdUser !== null}
        user={pwdUser}
        onClose={() => setPwdUser(null)}
        onChanged={() => setPwdUser(null)}
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
