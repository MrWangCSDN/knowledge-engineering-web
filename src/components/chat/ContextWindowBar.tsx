/**
 * src/components/chat/ContextWindowBar.tsx
 *
 * 上下文窗口用量进度条（Claude Code 风格 — 2026-05-21 改造）。
 *
 * 视觉：
 *   ┌───────────────────────────────────────────────────────┐
 *   │ Context window           320.3k / 1.0M (32%)          │
 *   │ ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
 *   └───────────────────────────────────────────────────────┘
 *
 * 数据：store.contextUsage（由 chat.ts 在 loadSession / case 'done' 时按 messages
 * 累计算出）— 切到已有会话或新一轮回复后都同步更新。
 *
 * 三态：pct≤80 蓝(ok) / 80<pct≤95 黄(warn) / pct>95 红(danger)
 *   - 触发 history_trimmed 时下方补一行"已自动压缩较早历史以继续对话"
 * 纯展示，不触发压缩（§18 后端职责）。设计：[[上下文窗口前端展示-设计]] §5.4
 */
import { useChatStore } from '@/store/chat'

// 进度条颜色 token（light/dark 双档已在 tailwind theme 配置中）
const FILL_CLASS = {
  ok: 'bg-context-ok',
  warn: 'bg-context-warn',
  danger: 'bg-context-danger',
} as const

/** 把 token 数格式化为 Claude Code 风简写：
 *   - n < 1000 → "195"
 *   - 1k ≤ n < 1M → "320.3k"（1 位小数）
 *   - n ≥ 1M → "1.0M"（1 位小数）
 * 单位临界点取整数倍便于阅读（与 Claude Code UI 完全一致）。
 */
function formatTokens(n: number): string {
  // 防御：负数/NaN 都按 0 显示
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.round(n))
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'k'
  return (n / 1_000_000).toFixed(1) + 'M'
}

export function ContextWindowBar() {
  // store.contextUsage 为 null 时不渲染（无消息的全新会话）
  const cu = useChatStore(s => s.contextUsage)
  if (cu == null) return null

  // 后端 / 累计算法都已 clamp 0–100；UI 再防御一次（脏数据不破版）
  const pct = Math.min(100, Math.max(0, cu.pct))
  // 三态门槛：ok ≤80% / warn ≤95% / danger >95%（与设计 §5.4 一致）
  const state: keyof typeof FILL_CLASS =
    pct <= 80 ? 'ok' : pct <= 95 ? 'warn' : 'danger'
  // round 防 IEEE754 浮点垃圾进 UI（如 95.1 - 0 = 95.1000000004）
  const pctText = Math.round(pct)
  const ariaNow = pctText

  return (
    <div className="max-w-3xl mx-auto w-full mb-1.5">
      {/* ─── 标题行：左 "Context window" + 右 "320.3k / 1.0M (32%)" ─── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>Context window</span>
        <span className="tabular-nums">
          {/* tabular-nums：等宽数字，避免 progress 滚动时数字宽度抖动 */}
          {formatTokens(cu.used_tokens)} / {formatTokens(cu.window_tokens)} ({pctText}%)
        </span>
      </div>

      {/* ─── 进度条本体 ─── */}
      <div
        role="progressbar"
        aria-label="上下文窗口使用量"
        aria-valuenow={ariaNow}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`${formatTokens(cu.used_tokens)} / ${formatTokens(cu.window_tokens)} tokens (${pctText}%)`}
        // bg-border：复用边框中性色作未填充轨道底（light/dark 双档已有）
        className="h-1.5 w-full rounded-full bg-border overflow-hidden"
      >
        <div
          data-fill
          className={`h-full rounded-full transition-all ${FILL_CLASS[state]}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ─── 自动压缩提示（仅在后端 SSE meta 报 history_trimmed=true 时显示） ─── */}
      {cu.history_trimmed && (
        <p className="mt-1 text-xs text-muted-foreground">
          已自动压缩较早历史以继续对话
        </p>
      )}
    </div>
  )
}
