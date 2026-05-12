/**
 * src/pages/settings/AuditLogPage.tsx
 *
 * 审计日志页（/settings/audit-logs，admin only）：
 *   - 列表（时间 / 操作者 / action / resource）
 *   - 筛选：actor 输入框 / resource_type 下拉 / 时间范围
 *   - metadata JSON 折叠（点击展开）
 *   - 翻页（前一页 / 下一页，page=1 起）
 *
 * 设计文档：[[audit-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */
import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { listAdminAuditLogs } from '@/api/auditLogs'
import type { AuditLogEntry } from '@/types/audit'

const RESOURCE_TYPES = [
  '', 'credential', 'group', 'project_member', 'user', 'project', 'session',
]
const RESOURCE_TYPE_LABEL: Record<string, string> = {
  '': '全部类型',
  credential: '凭证',
  group: '用户组',
  project_member: '工程成员',
  user: '用户',
  project: '工程',
  session: '会话',
}

const PAGE_LIMIT = 20

// ─── MetadataCell ──────────────────────────────────────────────────────────────

function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const keys = Object.keys(metadata)
  if (keys.length === 0) return <span className="text-muted-foreground/50 text-[12px]">—</span>

  const preview = keys.slice(0, 2).map(k => `${k}:…`).join(' ')

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? '收起' : preview}
      </button>
      {expanded && (
        <pre className="mt-1 p-2 bg-muted/50 rounded text-[11px] font-mono overflow-x-auto max-w-[300px] text-muted-foreground">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ─── AuditLogPage ──────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 筛选状态
  const [actorInput, setActorInput] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  // 当前生效的筛选条件（提交后才生效）
  const [appliedActor, setAppliedActor] = useState('')
  const [appliedResourceType, setAppliedResourceType] = useState('')
  const [appliedSince, setAppliedSince] = useState('')
  const [appliedUntil, setAppliedUntil] = useState('')

  const fetchData = async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const actorId = appliedActor ? parseInt(appliedActor, 10) : undefined
      const resp = await listAdminAuditLogs({
        page: p,
        limit: PAGE_LIMIT,
        actor_user_id: actorId && !isNaN(actorId) ? actorId : undefined,
        resource_type: appliedResourceType || undefined,
        since: appliedSince ? new Date(appliedSince).toISOString() : undefined,
        until: appliedUntil ? new Date(appliedUntil).toISOString() : undefined,
      })
      setEntries(resp.entries)
      setTotal(resp.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData(page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedActor, appliedResourceType, appliedSince, appliedUntil])

  const applyFilter = () => {
    setAppliedActor(actorInput)
    setAppliedResourceType(resourceType)
    setAppliedSince(since)
    setAppliedUntil(until)
    setPage(1)
  }

  const resetFilter = () => {
    setActorInput(''); setResourceType(''); setSince(''); setUntil('')
    setAppliedActor(''); setAppliedResourceType(''); setAppliedSince(''); setAppliedUntil('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_LIMIT)
  const hasFilter = appliedActor || appliedResourceType || appliedSince || appliedUntil

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">审计日志</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          记录系统内所有敏感操作（凭证管理、成员变更、工程配置等）。
        </p>
      </header>

      {/* 筛选栏 */}
      <div className="mb-5 p-4 border rounded-xl bg-card space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">操作人 ID</label>
            <input
              type="number"
              value={actorInput}
              onChange={e => setActorInput(e.target.value)}
              placeholder="用户 ID"
              className="w-[120px] px-3 py-1.5 text-[13px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">资源类型</label>
            <select
              value={resourceType}
              onChange={e => setResourceType(e.target.value)}
              className="w-[140px] px-3 py-1.5 text-[13px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {RESOURCE_TYPES.map(rt => (
                <option key={rt} value={rt}>{RESOURCE_TYPE_LABEL[rt] ?? rt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">开始时间</label>
            <input
              type="datetime-local"
              value={since}
              onChange={e => setSince(e.target.value)}
              className="px-3 py-1.5 text-[13px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1">结束时间</label>
            <input
              type="datetime-local"
              value={until}
              onChange={e => setUntil(e.target.value)}
              className="px-3 py-1.5 text-[13px] bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilter}>
              <Search className="h-3.5 w-3.5 mr-1" />
              筛选
            </Button>
            {hasFilter && (
              <Button size="sm" variant="ghost" onClick={resetFilter}>重置</Button>
            )}
          </div>
        </div>
        {hasFilter && (
          <p className="text-[12px] text-muted-foreground">
            已应用筛选条件，共 {total} 条记录
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          加载失败：{error}
        </div>
      )}

      {/* 日志表格 */}
      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[160px_100px_160px_140px_1fr] gap-4 px-4 py-3 bg-muted/30 border-b text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>时间</div>
          <div>操作人</div>
          <div>操作（action）</div>
          <div>资源</div>
          <div>元数据</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">加载中…</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">暂无审计日志</p>
          </div>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className="grid grid-cols-[160px_100px_160px_140px_1fr] gap-4 px-4 py-3 border-b last:border-b-0 items-start text-[13px]"
            >
              <div className="text-muted-foreground text-[12px]">{formatTime(entry.created_at)}</div>
              <div>
                {entry.actor_username ? (
                  <div>
                    <div className="font-medium">{entry.actor_username}</div>
                    <div className="text-[11px] text-muted-foreground">#{entry.actor_user_id}</div>
                  </div>
                ) : (
                  <span className="text-muted-foreground/60 italic text-[12px]">系统</span>
                )}
              </div>
              <div>
                <code className="text-[12px] font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                  {entry.action}
                </code>
              </div>
              <div>
                <div className="text-[12px]">
                  <span className="text-muted-foreground">{RESOURCE_TYPE_LABEL[entry.resource_type] ?? entry.resource_type}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground truncate max-w-[130px]">
                  {entry.resource_id}
                </div>
              </div>
              <div>
                <MetadataCell metadata={entry.metadata} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* 翻页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-muted-foreground">
            第 {page} / {totalPages} 页，共 {total} 条
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
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
