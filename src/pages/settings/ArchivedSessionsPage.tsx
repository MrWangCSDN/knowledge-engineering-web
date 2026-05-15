/**
 * src/pages/settings/ArchivedSessionsPage.tsx
 *
 * Settings 二级菜单「已归档对话」页面。
 *
 * 跨工程汇总归档 session（按工程分组），每条可「恢复」或「彻底删除」。
 *
 * 设计：[[会话归档-设计]] §8.2。
 */
import { useEffect, useState } from 'react'
import { Archive } from 'lucide-react'

import { useArchivedSessionStore } from '@/store/archivedSessions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function ArchivedSessionsPage() {
  const byProject = useArchivedSessionStore(s => s.byProject)
  const isLoading = useArchivedSessionStore(s => s.isLoading)
  const error = useArchivedSessionStore(s => s.error)
  const fetchAll = useArchivedSessionStore(s => s.fetchAll)
  const restore = useArchivedSessionStore(s => s.restore)
  const permanentDelete = useArchivedSessionStore(s => s.permanentDelete)

  // 待彻底删除的项；非 null 时打开 ConfirmDialog
  const [pendingDelete, setPendingDelete] = useState<{ projectId: string; sessionId: string } | null>(null)

  // 挂载即拉一次
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // 防御过滤：丢掉 sessions 为空的分组（store helper 行为偶尔保留空分组）
  const visibleGroups = byProject.filter(g => g.sessions.length > 0)

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    permanentDelete(pendingDelete.projectId, pendingDelete.sessionId)
    setPendingDelete(null)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">已归档对话</h1>
        <p className="text-sm text-muted-foreground mt-1">
          已归档的对话不会出现在主侧栏。在这里可以恢复或彻底删除它们。
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">加载失败：{error}</p>
      )}

      {!isLoading && !error && visibleGroups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>没有已归档对话</p>
        </div>
      )}

      {visibleGroups.map(group => (
        <section key={group.project_id} className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            {group.project_name}（{group.sessions.length}）
          </h2>
          <ul className="border rounded-lg divide-y">
            {group.sessions.map(s => (
              <li
                key={s.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.title || '(无标题)'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    归档于 {new Date(s.archived_at).toLocaleString('zh-CN')}
                    · {s.message_count} 条消息
                  </p>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => restore(group.project_id, s.id)}
                    className="px-3 py-1.5 text-sm rounded border hover:bg-muted transition-colors text-foreground"
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ projectId: group.project_id, sessionId: s.id })}
                    className="px-3 py-1.5 text-sm rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    彻底删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* 统一的彻底删除二次确认对话框（替代 window.confirm） */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="彻底删除该对话"
        message="此操作不可恢复。"
        confirmText="彻底删除"
        variant="destructive"
      />
    </div>
  )
}
