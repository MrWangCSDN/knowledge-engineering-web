/**
 * src/components/chat/ContextWindowBar.tsx
 *
 * 上下文窗口用量进度条（Claude Code 风格极简）。读 store.contextUsage：
 *   - null → 不渲染
 *   - 三态：pct≤80 蓝(ok) / 80<pct≤95 黄(warn) / pct>95 红(danger)
 *   - 文案：ok 显 {pct}%；warn/danger 显"剩余 X% 直到自动压缩"
 *   - history_trimmed（后端 §18 已自动压缩）→ 内联提示
 * 纯展示，不触发压缩（§18 后端职责）。设计：[[上下文窗口前端展示-设计]] §5.4
 */
import { useChatStore } from '@/store/chat'

const FILL_CLASS = {
  ok: 'bg-context-ok',
  warn: 'bg-context-warn',
  danger: 'bg-context-danger',
} as const

export function ContextWindowBar() {
  const cu = useChatStore(s => s.contextUsage)
  if (cu == null) return null

  // 后端已 clamp，组件再防御一次（越界/脏数据不破版）
  const pct = Math.min(100, Math.max(0, cu.pct))
  const state: keyof typeof FILL_CLASS =
    pct <= 80 ? 'ok' : pct <= 95 ? 'warn' : 'danger'
  const remaining = Math.max(0, 100 - pct)

  return (
    <div className="max-w-3xl mx-auto w-full mb-1.5">
      <div
        role="progressbar"
        aria-label="上下文窗口使用量"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        title={`已用 ~${cu.used_tokens} / ${cu.window_tokens} tokens`}
        className="h-1.5 w-full rounded-full bg-border overflow-hidden"
      >
        <div
          data-fill
          className={`h-full rounded-full transition-all ${FILL_CLASS[state]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {state === 'ok'
          ? `${cu.pct}%`
          : `剩余 ${remaining}% 直到自动压缩`}
        {cu.history_trimmed && ' · 已自动压缩较早历史以继续对话'}
      </p>
    </div>
  )
}
