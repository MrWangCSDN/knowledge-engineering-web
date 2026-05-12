/**
 * src/pages/settings/CredentialListPage.tsx
 *
 * 凭证管理页（v2 user-scoped）— 列出当前用户自己的凭证 + 新增 + 删除。
 * Admin 用户底部额外有"所有凭证审计"Tab（listAllCredentials 视图）。
 *
 * 设计文档：[[仓库管理-设计]] §7 / [[credentials-设计]]
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, Key, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  listMyCredentials,
  deleteMyCredential,
  listAllCredentials,
  deleteAnyCredential,
} from '@/api/credentials'
import type { MyCredential } from '@/types/credential'
import { useAuthStore } from '@/store/auth'
import { AddCredentialDialog } from './AddCredentialDialog'

type TabId = 'mine' | 'all'

export function CredentialListPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.is_admin ?? false

  const [tab, setTab] = useState<TabId>('mine')
  const [credentials, setCredentials] = useState<MyCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = tab === 'all' ? await listAllCredentials() : await listMyCredentials()
      setCredentials(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const onDelete = async (id: string, name: string) => {
    const msg =
      tab === 'all'
        ? `确定强制删除凭证「${name}」？\n（Admin 操作：关联工程将无法同步）`
        : `确定删除凭证「${name}」？\n关联工程会变成"无凭证"状态，私有仓将无法同步。`
    if (!confirm(msg)) return
    setDeleting(id)
    try {
      if (tab === 'all') {
        await deleteAnyCredential(id)
      } else {
        await deleteMyCredential(id)
      }
      await refresh()
    } catch (e) {
      alert(`删除失败：${(e as Error).message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">我的凭证</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            管理 Git Personal Access Token；明文 token 用 Fernet 加密存储，UI 只展示末 4 位。
          </p>
        </div>
        {tab === 'mine' && (
          <Button onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            新增凭证
          </Button>
        )}
      </header>

      {/* Admin 用户显示 Tab 切换 */}
      {isAdmin && (
        <div className="flex gap-1 mb-5 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              tab === 'mine'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            我的凭证
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              tab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            所有凭证审计
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          加载失败：{error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-[1fr_120px_140px_180px_60px] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>名称</div>
          <div>类型</div>
          <div>末 4 位</div>
          <div>创建时间</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">加载中…</div>
        ) : credentials.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === 'all' ? '系统暂无凭证' : '还没有凭证'}
            </p>
            {tab === 'mine' && (
              <p className="text-xs text-muted-foreground/70 mt-1">点击右上角"新增凭证"添加 Git PAT</p>
            )}
          </div>
        ) : (
          credentials.map(c => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_120px_140px_180px_60px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-[12px] text-muted-foreground">{c.id}</div>
              </div>
              <div className="text-muted-foreground uppercase text-[12px]">{c.type}</div>
              <div className="font-mono text-[13px] text-muted-foreground">{c.token_hint}</div>
              <div className="text-[13px] text-muted-foreground">{formatTime(c.created_at)}</div>
              <div>
                <button
                  type="button"
                  onClick={() => onDelete(c.id, c.name)}
                  disabled={deleting === c.id}
                  className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AddCredentialDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          setAddOpen(false)
          void refresh()
        }}
      />
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}
