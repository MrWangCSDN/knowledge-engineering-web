/**
 * src/pages/settings/CredentialListPage.tsx
 *
 * 凭证管理页 — 列出所有 Git PAT 凭证 + 新增 + 删除。
 *
 * 设计文档：[[仓库管理-设计]] §7
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, Key } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  listAllCredentials as listCredentials,
  deleteAnyCredential as deleteCredential,
} from '@/api/credentials'
import type { MyCredential as Credential } from '@/types/credential'
import { AddCredentialDialog } from './AddCredentialDialog'

export function CredentialListPage() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setCredentials(await listCredentials())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除凭证「${name}」？\n关联工程会变成"无凭证"状态，私有仓将无法同步。`)) return
    setDeleting(id)
    try {
      await deleteCredential(id)
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
          <h1 className="text-2xl font-semibold">凭证管理</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            管理 Git Personal Access Token；明文 token 用 Fernet 加密存储，UI 只展示末 4 位。
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          新增凭证
        </Button>
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          ❌ {error}
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
            <p className="text-sm text-muted-foreground">还没有凭证</p>
            <p className="text-xs text-muted-foreground/70 mt-1">点击右上角"新增凭证"添加 Git PAT</p>
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
