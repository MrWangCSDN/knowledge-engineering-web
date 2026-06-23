/**
 * src/pages/settings/RepositoryListPage.tsx
 *
 * 仓库管理页 — 列出所有工程（admin 视角，含 git 配置）+ 添加 + 删除。
 *
 * 设计文档：[[仓库管理-设计]] §7
 */
import { useEffect, useState } from 'react'
import { Plus, Trash2, GitBranch, FolderClosed, GitFork } from 'lucide-react'
// useNavigate：命令式路由跳转，用于「连接 GitHub」按钮
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  listAdminProjects,
  deleteAdminProject,
} from '@/api/admin'
import type { AdminProject } from '@/types/admin'
import { AddRepositoryDialog } from './AddRepositoryDialog'

const STATUS_LABEL: Record<string, { icon: string; label: string; color: string }> = {
  configured: { icon: '⚙️', label: '已配置', color: 'text-blue-500' },
  ready:      { icon: '💚', label: '就绪',   color: 'text-emerald-500' },
  indexing:   { icon: '🟡', label: '索引中', color: 'text-amber-500' },
  partial:    { icon: '🟠', label: '部分就绪', color: 'text-orange-500' },
  failed:     { icon: '🔴', label: '失败',   color: 'text-red-500' },
}

export function RepositoryListPage() {
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  // navigate：命令式跳转，用于「连接 GitHub」按钮跳到 /settings/connections
  const navigate = useNavigate()

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listAdminProjects())
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
    if (!confirm(`确定删除工程「${name}」？\n所有相关的会话、消息也会被级联删除。`)) return
    setDeleting(id)
    try {
      await deleteAdminProject(id)
      await refresh()
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
          <h1 className="text-2xl font-semibold">仓库管理</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            连接 Git 仓库后，KE 会自动索引代码并生成业务文档（v1.1 实际索引上线）。
          </p>
        </div>
        {/* 按钮组：连接 GitHub（outline）+ 添加仓库（primary） */}
        <div className="flex items-center gap-2 shrink-0">
          {/* variant="outline"：次要操作按钮，不抢眼 */}
          <Button variant="outline" onClick={() => navigate('/settings/connections')}>
            <GitFork className="h-4 w-4 mr-1" />
            连接 GitHub
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            添加仓库
          </Button>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          ❌ {error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-[1fr_120px_140px_180px_60px] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>仓库</div>
          <div>状态</div>
          <div>分支</div>
          <div>最后同步</div>
          <div></div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">加载中…</div>
        ) : projects.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FolderClosed className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">还没有仓库</p>
            <p className="text-xs text-muted-foreground/70 mt-1">点击右上角"添加仓库"接入第一个 Git 工程</p>
          </div>
        ) : (
          projects.map(p => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.configured
            return (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_120px_140px_180px_60px] gap-4 px-4 py-3 border-b last:border-b-0 items-center text-[14px]"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-[12px] text-muted-foreground font-mono truncate">
                    {p.git_url ?? <span className="italic">（未配置）</span>}
                  </div>
                </div>
                <div className={`text-[13px] ${st.color}`}>
                  {st.icon} {st.label}
                </div>
                <div className="text-[13px] text-muted-foreground flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {p.git_branch}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {p.last_synced_at ? formatTime(p.last_synced_at) : <span className="italic">从未</span>}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => onDelete(p.id, p.name)}
                    disabled={deleting === p.id}
                    className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    aria-label="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <AddRepositoryDialog
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
