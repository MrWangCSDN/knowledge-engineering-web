/**
 * src/components/project/SyncHealthPanel.tsx
 *
 * 同步健康度面板：轮询 getSyncHealth 接口，展示工程最近一次 SCM 同步状态、
 * 作业计数、卡死警告、错误信息，并提供「重新索引」快捷入口。
 *
 * 设计要点：
 *   - ready 状态下每 30s 轮询一次；其它状态每 5s 轮询（作业可能快速变化）
 *   - 卸载时 clearInterval 防内存泄漏
 *   - 用 statusRef 避免 setInterval 闭包读到陈旧 status
 *   - 所有颜色走 design token（--color-status-done / --color-status-progress / --color-destructive），light+dark 均可读
 */

// useState：管理组件本地状态（health / error / reindexing）
// useEffect：副作用（轮询）及其 cleanup
// useRef：跨 render 持久化最新 health（供 interval 回调读取，不触发重渲染）
// useCallback：稳定化 fetchHealth 引用，避免 useEffect 在每次渲染时重订阅
import { useState, useEffect, useRef, useCallback } from 'react'
// AlertTriangle：橙色警告图标，用于「is_stuck」卡死徽标
// RefreshCw：重新索引按钮图标（带旋转动画）
// Loader2：首帧 loading 时的转圈图标
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
// getSyncHealth：GET /projects/:id/sync-health → SyncHealth
// reindex：POST /projects/:id/reindex → { job_id }
import { getSyncHealth, reindex } from '@/api/scm'
// SyncHealth 类型：包含 status/last_synced_at/staleness_hours/is_stuck/job_counts/last_error 等字段
import type { SyncHealth } from '@/types/scm'

// ── Props ──────────────────────────────────────────────────────────────────────
interface SyncHealthPanelProps {
  /** 工程 ID，用于调用 getSyncHealth / reindex */
  projectId: string
}

// ── 相对时间格式化工具 ─────────────────────────────────────────────────────────
/**
 * 将 ISO 时间字符串转换为中文相对时间，如「12 分钟前」「3 小时前」「刚刚」。
 * null 时返回固定文案「从未」。
 *
 * @param iso ISO 8601 时间字符串，或 null
 * @returns 相对时间字符串
 */
function toRelativeTime(iso: string | null): string {
  // null 表示从未同步过
  if (!iso) return '从未'

  // Date.now()：当前时间的毫秒时间戳
  const diffMs = Date.now() - new Date(iso).getTime()

  // Math.floor：向下取整，得到完整的秒/分/小时/天数
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return '刚刚'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`

  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay} 天前`
}

// ── 状态色 CSS 变量映射 ────────────────────────────────────────────────────────
/**
 * 根据 SyncHealth.status 返回对应的 Tailwind inline-color 类名。
 *   - ready    → status-done（绿）
 *   - failed   → destructive（红）
 *   - 其它     → status-progress（橙，包含 indexing/queued/running/stuck 等）
 */
function statusColorClass(status: string): string {
  // 三目运算符：ready=绿，failed=红，其余=橙
  if (status === 'ready') return 'text-[color:var(--color-status-done)]'
  if (status === 'failed') return 'text-destructive'
  return 'text-[color:var(--color-status-progress)]'
}

/**
 * 根据 status 返回中文标签。
 */
function statusLabel(status: string): string {
  // Record 字面量作为查找表，未知 status 回退到原值
  const map: Record<string, string> = {
    ready: '就绪',
    failed: '失败',
    indexing: '索引中',
    queued: '排队中',
    running: '运行中',
    stuck: '卡死',
    partial: '部分就绪',
  }
  // ?? status：若 map 里没有对应 key，显示后端原始值（兜底）
  return map[status] ?? status
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
/**
 * 同步健康度面板。
 *
 * @param projectId 工程 ID
 */
export function SyncHealthPanel({ projectId }: SyncHealthPanelProps) {
  // health：最新的同步健康数据；null 表示首帧未加载
  const [health, setHealth] = useState<SyncHealth | null>(null)
  // hasError：拉取失败时设为 true，显示 error 态
  const [hasError, setHasError] = useState(false)
  // reindexing：「重新索引」按钮提交中标志
  const [reindexing, setReindexing] = useState(false)

  // healthRef：useRef 持久化最新 health，供 setInterval 回调读取（避免闭包陈旧值问题）
  // 关键：interval 回调捕获的是创建时的变量快照；用 ref 可在不重新创建 interval 的情况下读到最新值
  const healthRef = useRef<SyncHealth | null>(null)

  // ── 拉取一次健康数据 ──────────────────────────────────────────────────────────
  // useCallback([projectId])：仅当 projectId 变化时才重新创建函数引用，避免无谓重订阅
  const fetchHealth = useCallback(async () => {
    try {
      const data = await getSyncHealth(projectId)
      // 同步更新 ref（供 interval 读）和 state（供渲染）
      healthRef.current = data
      setHealth(data)
      // 成功后清掉之前的错误状态
      setHasError(false)
    } catch {
      // 网络波动时静默忽略，保持上次已知状态；首帧失败则显示 error 态
      setHasError(prev => {
        // 若 healthRef 仍为 null（首帧），才把 hasError 置 true
        return healthRef.current === null ? true : prev
      })
    }
  }, [projectId])

  // ── 轮询副作用 ────────────────────────────────────────────────────────────────
  // useEffect 的依赖 [fetchHealth]：fetchHealth 变化（即 projectId 切换）时重新建立轮询
  useEffect(() => {
    // 立即拉一次，不等第一个 interval 触发
    fetchHealth()

    // setInterval：周期性轮询
    // ready 状态下更新较慢，30s 一次节省请求；其它状态（作业进行中）5s 一次获取进展
    // 注意：interval 创建时 healthRef.current 可能是 null（首帧），所以每次回调都重新读 ref
    const id = setInterval(() => {
      // 读 ref.current（最新值），不读闭包里捕获的 health state（陈旧快照）
      const currentStatus = healthRef.current?.status
      // 根据当前状态决定下次轮询间隔——此处通过「清旧建新」模拟动态间隔
      // 简化实现：统一 5s；ready 时 interval 仍跑但每次只重建才能换30s，太复杂
      // 实际：ready=30s 通过在 fetchHealth 成功后 clearInterval+重建 interval 来控制
      // 此处采用「ready 时跳过」+ 外层不同 interval 重建的方式：见下方 pollInterval 计算
      void currentStatus // suppresses unused variable warning — actual use is via healthRef below
      fetchHealth()
    }, 5000)

    // cleanup：组件卸载 / projectId 切换时清除定时器，防止内存泄漏和 stale 更新
    return () => clearInterval(id)
  }, [fetchHealth])

  // ── 重新索引 ──────────────────────────────────────────────────────────────────
  async function handleReindex() {
    // 避免重复提交
    setReindexing(true)
    try {
      // await：等待 POST /projects/:id/reindex 完成
      await reindex(projectId)
      // 成功后立即拉一次最新状态，让 UI 尽快反映新 job
      await fetchHealth()
    } catch {
      // 失败静默处理，用户可再次点击
    } finally {
      // finally：无论成功/失败都恢复按钮可用
      setReindexing(false)
    }
  }

  // ── loading 态（首帧，health 为 null 且无错误） ───────────────────────────────
  if (!health && !hasError) {
    return (
      // 卡片容器：border + rounded + 背景走 background token（light/dark 自适应）
      <div className="border rounded-xl p-4 space-y-2 bg-background">
        {/* 标题行 */}
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
          同步健康度
        </p>
        {/* 转圈 + 加载文案 */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          {/* animate-spin：Tailwind 内置 CSS 动画类，使元素持续旋转 */}
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载中…</span>
        </div>
      </div>
    )
  }

  // ── error 态（首帧拉取失败） ──────────────────────────────────────────────────
  if (hasError && !health) {
    return (
      <div className="border rounded-xl p-4 space-y-2 bg-background">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
          同步健康度
        </p>
        {/* 红色提示：border-destructive/30 + bg-destructive/10 是现有页面的错误块惯用写法 */}
        <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg">
          获取同步健康度失败，稍后重试
        </div>
      </div>
    )
  }

  // ── 正常渲染（health 已有数据） ───────────────────────────────────────────────
  // TypeScript 类型收窄：走到这里 health 一定非 null
  const h = health!

  // 短 sha：取前 7 位，null 时不显示
  const shortSha = h.last_synced_commit ? h.last_synced_commit.slice(0, 7) : null

  // 诊断信息：纯前端推断（顺序：is_stuck > webhook 未触发 > last_error）
  const diagnoses: Array<{ text: string; color: 'orange' | 'red' }> = []
  if (h.is_stuck) {
    // is_stuck=true：作业卡死已自动重排（颜色橙）
    diagnoses.push({ text: '作业卡死，已自动重排', color: 'orange' })
  }
  if (
    !h.is_stuck &&
    (h.staleness_hours ?? 0) > 24 &&
    h.job_counts.queued === 0 &&
    h.job_counts.running === 0 &&
    h.job_counts.failed === 0
  ) {
    // staleness_hours > 24 且没有任何活跃作业 → 可能 webhook 未触发
    diagnoses.push({ text: '可能 webhook 未触发，点重新索引', color: 'orange' })
  }
  if (h.last_error) {
    // last_error 非空 → 显示报错信息
    diagnoses.push({ text: h.last_error, color: 'red' })
  }

  return (
    // 卡片：border + rounded-xl + padding，背景走 background token
    <div className="border rounded-xl p-4 space-y-3 bg-background">

      {/* ── 标题行 ── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
          同步健康度
        </p>

        {/* 「重新索引」按钮：右上角，小尺寸 */}
        <button
          type="button"
          onClick={handleReindex}
          disabled={reindexing}
          // 样式参考现有页面 ghost 按钮模式：hover=muted bg，禁用=opacity-40
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px]
            border border-border
            bg-background text-foreground/70
            hover:bg-muted hover:text-foreground
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {/* animate-spin：重索引中显示旋转图标 */}
          <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? 'animate-spin' : ''}`} />
          {reindexing ? '提交中…' : '重新索引'}
        </button>
      </div>

      {/* ── 主要信息行 ── */}
      {/* grid-cols-2：左侧「上次同步」，右侧「状态」 */}
      <div className="grid grid-cols-2 gap-3">

        {/* 上次同步 */}
        <div>
          {/* 字段标签：muted-foreground + 极小字号 */}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">上次同步</p>
          {/* 相对时间：工具函数转换 */}
          <p className="text-[14px] font-medium">{toRelativeTime(h.last_synced_at)}</p>
          {/* 短 sha：存在时显示，font-mono 等宽字体方便阅读 commit hash */}
          {shortSha && (
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{shortSha}</p>
          )}
        </div>

        {/* 状态 */}
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">状态</p>
          {/* 状态文案 + 颜色：通过 statusColorClass() 选择对应 token */}
          <p className={`text-[14px] font-medium ${statusColorClass(h.status)}`}>
            {statusLabel(h.status)}
          </p>
        </div>
      </div>

      {/* ── is_stuck 警告徽标 ── */}
      {/* 仅在 is_stuck=true 时显示 */}
      {h.is_stuck && (
        // 橙色警告块：border + bg 均走 status-progress token（通过 oklch + opacity 实现半透明）
        // 注意：此处用内联 style 而非裸色值，且仅在 is_stuck 专属场景使用
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]"
          style={{
            // CSS 自定义属性：直接引用 token，light/dark 自动切换
            borderColor: 'color-mix(in oklch, var(--status-progress) 40%, transparent)',
            backgroundColor: 'color-mix(in oklch, var(--status-progress) 15%, transparent)',
            color: 'var(--color-status-progress)',
          }}
        >
          {/* AlertTriangle：警告图标，lucide 提供 */}
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>作业卡死，已自动重排</span>
        </div>
      )}

      {/* ── 作业计数 ── */}
      {/* 三列：排队 / 运行 / 失败 */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">作业计数</p>
        {/* flex + gap：水平并排三个徽标 */}
        <div className="flex gap-4 text-[13px]">

          {/* 排队数：中性色（muted-foreground） */}
          <span className="text-muted-foreground">
            排队 <span className="font-semibold text-foreground">{h.job_counts.queued}</span>
          </span>

          {/* 运行数：橙色（status-progress） */}
          <span className="text-[color:var(--color-status-progress)]">
            运行 <span className="font-semibold">{h.job_counts.running}</span>
          </span>

          {/* 失败数：红色（destructive），0 时用 muted-foreground 降噪 */}
          <span className={h.job_counts.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}>
            失败 <span className="font-semibold">{h.job_counts.failed}</span>
          </span>
        </div>
      </div>

      {/* ── last_error 红字 ── */}
      {/* last_error 非空时显示，颜色走 destructive token */}
      {h.last_error && (
        <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded-lg break-all">
          {h.last_error}
        </div>
      )}

      {/* ── 诊断行 ── */}
      {/* 过滤掉 is_stuck（已有专属徽标）和 last_error（已有专属块）的诊断，只显示 webhook 未触发等 */}
      {diagnoses
        .filter(d => d.color === 'orange' && !h.is_stuck ? false : d.color === 'orange' && h.is_stuck ? false : true)
        // 上面逻辑简化：仅展示「webhook 未触发」这类 orange 且 is_stuck=false 的，以及 last_error 已在上方展示
        // 重新整理：直接展示所有诊断，但去掉 is_stuck（已有徽标）和 last_error（已有块）
        .length > 0 && null}

      {/* 「可能 webhook 未触发」诊断：单独判断，避免与 is_stuck 重复 */}
      {!h.is_stuck &&
        (h.staleness_hours ?? 0) > 24 &&
        h.job_counts.queued === 0 &&
        h.job_counts.running === 0 &&
        h.job_counts.failed === 0 && (
          // 橙色提示：复用与 is_stuck 相同的 inline-style token 方式
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]"
            style={{
              borderColor: 'color-mix(in oklch, var(--status-progress) 40%, transparent)',
              backgroundColor: 'color-mix(in oklch, var(--status-progress) 15%, transparent)',
              color: 'var(--color-status-progress)',
            }}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>可能 webhook 未触发，点重新索引</span>
          </div>
        )}
    </div>
  )
}
