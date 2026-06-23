/**
 * src/components/connect/IndexingProgress.tsx
 *
 * 索引进度屏（屏5）——轮询后端 index-status 接口，以状态机方式展示
 * 各阶段进展（cloning → building_graph → ... → interpreting → done/failed）。
 *
 * 设计要点：
 *   - 每 3 秒轮询一次 getIndexStatus；done/failed 时停止轮询
 *   - 状态机：已过=✓完成、当前=高亮转圈、未到=灰；done=全完成；queued=全未开始；failed=当前标红
 *   - 进度条宽度 = percent（done 视作 100）
 *   - 「重新索引」按钮调 reindex()，提交中禁用，成功后继续轮询
 *   - 所有颜色走 design token，light + dark 均可读
 */

// useState：管理本地 status 状态；useEffect：副作用（轮询/cleanup）；useCallback：稳定化函数引用；useRef：跨 render 持久化值（不触发重渲染）
import { useState, useEffect, useCallback, useRef } from 'react'
// pollKey 不直接用于渲染，仅作为 useEffect 依赖项——每次 increment 都会触发 effect 重跑，从而重建 setInterval
// Loader2 / CheckCircle / XCircle / Clock：lucide 图标，统一 16px 使用
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
// getIndexStatus：GET /projects/{id}/index-status；reindex：POST /projects/{id}/reindex
import { getIndexStatus, reindex } from '@/api/scm'
// IndexStatus：{ job_id, status, progress: {phase, percent}|null, error }
import type { IndexStatus } from '@/types/scm'

// ── 阶段排序（后端 status 的运行中取值，按流程顺序） ───────────────────────
// as const：让数组元素的类型收窄为字面量联合，而不是 string[]
const PHASE_ORDER = [
  'cloning',
  'building_graph',
  'cross_service',
  'embedding',
  'interpreting',
] as const

// PHASE_ORDER 元素的联合类型（'cloning' | 'building_graph' | ...）
type Phase = (typeof PHASE_ORDER)[number]

// ── UI 标签映射（后端 status → 中文展示） ──────────────────────────────────
// Record<string, string>：key/value 都是字符串的对象类型
const PHASE_LABELS: Record<string, string> = {
  queued: '排队中',
  cloning: '克隆代码',
  building_graph: '构建调用图',
  cross_service: '跨服务边解析',
  embedding: '向量化',
  interpreting: 'LLM 业务解读',
}

// 轮询间隔 3 秒
const POLL_MS = 3000

// ── Props 接口 ─────────────────────────────────────────────────────────────
interface IndexingProgressProps {
  /** 工程 ID，用于调用 getIndexStatus / reindex */
  projectId: string
}

/**
 * 索引进度状态机组件。
 *
 * @param projectId 工程 ID
 */
export function IndexingProgress({ projectId }: IndexingProgressProps) {
  // IndexStatus | null：null 表示首次加载前还未拿到数据
  const [status, setStatus] = useState<IndexStatus | null>(null)
  // reindexing：「重新索引」按钮的提交中状态；提交中时禁用按钮
  const [reindexing, setReindexing] = useState(false)
  // pollKey：整数计数器，每次「重新索引」成功后 +1。
  // 将 pollKey 加入轮询 useEffect 的依赖数组，可使 effect 在 pollKey 变化时重跑：
  //   旧 effect cleanup → clearInterval 清掉终态后停掉的旧 timer → 新 effect → 重建 setInterval
  // 这样解决了「done/failed 后 clearInterval，但 effect 依赖未变导致轮询永不重建」的问题。
  const [pollKey, setPollKey] = useState(0)

  // statusRef：useRef 持久化最新 status，供 setInterval 回调读取而不产生闭包陈旧值。
  // useRef 与 useState 的区别：
  //   - useState：改值触发重渲染（显示用）
  //   - useRef：改值不触发重渲染，跨 render 持久（在 interval 回调里读最新值用）
  const statusRef = useRef<IndexStatus | null>(null)

  // ── 判断是否为终态（终态时停止轮询） ───────────────────────────────────────
  // 内联函数：接受 IndexStatus | null，返回布尔
  function isTerminal(s: IndexStatus | null): boolean {
    // done 或 failed 都是终态；null 还未加载不算终态
    return s?.status === 'done' || s?.status === 'failed'
  }

  // ── 拉取一次状态 ───────────────────────────────────────────────────────────
  // useCallback：把 fetchStatus 函数引用稳定下来，避免 useEffect 依赖每次都变
  // [projectId]：只有 projectId 变化才重新创建函数
  const fetchStatus = useCallback(async () => {
    try {
      // await：等待 Promise 完成，获取 IndexStatus
      const data = await getIndexStatus(projectId)
      // 同时更新 ref（供 interval 检查）和 state（供渲染）
      statusRef.current = data
      setStatus(data)
    } catch {
      // 网络错误时静默忽略，保持上一次已知状态，下次轮询再试
    }
  }, [projectId])

  // ── 轮询副作用 ─────────────────────────────────────────────────────────────
  // useEffect：在组件挂载/依赖变化时执行副作用；返回 cleanup 函数
  // 依赖 [fetchStatus, pollKey]：
  //   - fetchStatus 变化（projectId 切换）→ effect 重跑，重建轮询
  //   - pollKey 变化（「重新索引」成功后 +1）→ effect 重跑，重建轮询
  //     这是修复「重新索引后轮询永停」bug 的关键：旧 effect cleanup 先 clearInterval，
  //     新 effect 立即建立新 setInterval，使轮询恢复。
  useEffect(() => {
    // 立即拉一次（不等第一个 3s 间隔）
    fetchStatus()

    // setInterval：每 3 秒重复执行；返回定时器 ID（数字），用于后续 clearInterval
    const id = setInterval(() => {
      // 读 ref 而非 state：interval 回调是闭包，捕获的 state 是旧快照；
      // ref.current 始终是最新值，不受闭包限制
      if (isTerminal(statusRef.current)) {
        // 已是终态：停止轮询，不再发请求
        clearInterval(id)
        return
      }
      // 非终态：继续拉最新状态
      fetchStatus()
    }, POLL_MS)

    // cleanup：组件卸载 / fetchStatus 变化 / pollKey 变化时清定时器，避免内存泄漏
    return () => clearInterval(id)
  }, [fetchStatus, pollKey])

  // ── 重新索引 ────────────────────────────────────────────────────────────────
  async function handleReindex() {
    // 避免重复提交
    setReindexing(true)
    try {
      // await：等待 reindex POST 完成
      await reindex(projectId)
      // 成功后重置状态（让轮询可以重新跑起来），同时清 ref
      statusRef.current = null
      setStatus(null)
      // 立即拉一次最新状态（让 UI 尽快反映新 job 状态）
      await fetchStatus()
      // pollKey +1：触发轮询 useEffect 重跑，重建 setInterval。
      // 这是修复 C1 的核心：done/failed 后旧 interval 被 clearInterval，
      // 若不重跑 effect 则轮询永不恢复；pollKey 变化可强制 effect 重建。
      // 函数式更新 (k => k + 1)：避免闭包读到旧值（始终在最新值基础上 +1）
      setPollKey(k => k + 1)
    } catch {
      // 失败静默，用户可再次点击
    } finally {
      // finally：无论成功/失败都执行，恢复按钮可用
      setReindexing(false)
    }
  }

  // ── 计算当前阶段在 PHASE_ORDER 中的 index ─────────────────────────────────
  // indexOf：找不到返回 -1（queued/done/failed 时均为 -1）
  const currentPhaseIndex = status
    ? (PHASE_ORDER as readonly string[]).indexOf(status.status)
    : -1

  // 进度百分比：done 视作 100，否则取 progress.percent，默认 0
  const percent =
    status?.status === 'done'
      ? 100
      : (status?.progress?.percent ?? 0)

  // ── 渲染 ────────────────────────────────────────────────────────────────────
  return (
    // 整体容器：宽度撑满、竖向排列、间距适中
    <div className="w-full flex flex-col gap-4 py-2">

      {/* 阶段列表：遍历 PHASE_ORDER，每个阶段一行 */}
      <div className="flex flex-col gap-2">
        {/* PHASE_ORDER.map：数组遍历，返回 JSX 元素数组 */}
        {PHASE_ORDER.map((phase: Phase, idx: number) => {
          // 判断当前行处于哪种状态
          const isDone =
            status?.status === 'done' ||
            // currentPhaseIndex > idx：该阶段已被当前阶段"经过"
            (currentPhaseIndex > idx && currentPhaseIndex !== -1)
          const isCurrent =
            status?.status !== 'done' &&
            status?.status !== 'failed' &&
            currentPhaseIndex === idx
          const isFailed = status?.status === 'failed' && currentPhaseIndex === idx

          // 动态 className：根据阶段状态选择颜色
          // text-status-done：绿色（CSS token）；text-destructive：红色；text-muted-foreground：灰色
          const rowClass = isDone
            ? 'text-[color:var(--color-status-done)]'
            : isFailed
            ? 'text-destructive'
            : isCurrent
            ? 'text-foreground'
            : 'text-muted-foreground opacity-50'

          return (
            // key：React 列表渲染必须有 key，用阶段名（唯一）
            <div key={phase} className={`flex items-center gap-2 text-sm ${rowClass}`}>
              {/* 图标区：16px 固定宽度，保证各行图标对齐 */}
              <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {isDone ? (
                  // CheckCircle：已完成阶段显示绿色勾
                  <CheckCircle className="w-4 h-4" />
                ) : isFailed ? (
                  // XCircle：失败阶段显示红色叉
                  <XCircle className="w-4 h-4" />
                ) : isCurrent ? (
                  // Loader2 + animate-spin：当前运行阶段显示转圈动画
                  // animate-spin 是 Tailwind 内置的 CSS animation 类
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  // Clock：尚未开始的阶段显示时钟（灰色）
                  <Clock className="w-4 h-4" />
                )}
              </span>

              {/* 阶段标签文字 */}
              <span>{PHASE_LABELS[phase] ?? phase}</span>

              {/* 当前阶段额外显示百分比 */}
              {isCurrent && status?.progress?.percent != null && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {status.progress.percent}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 进度条容器：圆角、背景用 muted token（light/dark 自适应） */}
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        {/* 进度条填充：宽度 = percent%，颜色用 primary token */}
        {/* transition-all duration-500：宽度变化时有平滑过渡动画（500ms） */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status?.status === 'failed'
              ? 'bg-destructive'   // 失败时进度条变红
              : 'bg-primary'       // 正常时用 primary 色（light=深色/dark=浅色，token 自适应）
          }`}
          // style：内联样式设置动态宽度百分比（不能用 Tailwind 类，因为值是动态的）
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* 状态文案区 */}
      <div className="text-sm text-center">
        {status?.status === 'done' ? (
          // done：绿色「索引完成」
          <span className="text-[color:var(--color-status-done)] font-medium">
            索引完成
          </span>
        ) : status?.status === 'failed' ? (
          // failed：红色错误信息
          <span className="text-destructive">
            索引失败：{status.error ?? '未知错误'}
          </span>
        ) : status ? (
          // 运行中：显示当前阶段标签 + 提示
          <div className="flex flex-col gap-1 items-center">
            <span className="text-foreground/80 font-medium">
              {PHASE_LABELS[status.status] ?? status.status}
            </span>
            {/* 「部分完成即可开始问答」——给用户设预期，避免一直等待 */}
            <span className="text-xs text-muted-foreground">
              部分完成即可开始问答
            </span>
          </div>
        ) : (
          // null（首次加载中）：显示加载提示
          <span className="text-muted-foreground">加载中…</span>
        )}
      </div>

      {/* 「重新索引」按钮：始终展示（done/failed/运行中都可触发） */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleReindex}
          // disabled：提交中禁用按钮，避免重复提交
          disabled={reindexing}
          className="
            px-4 py-1.5 rounded-md text-sm
            border border-border
            bg-background text-foreground/70
            hover:bg-muted hover:text-foreground
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {/* 提交中显示转圈 + 文案变化 */}
          {reindexing ? (
            // flex items-center gap-1.5：图标与文字横向对齐
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              提交中…
            </span>
          ) : (
            '重新索引'
          )}
        </button>
      </div>
    </div>
  )
}
