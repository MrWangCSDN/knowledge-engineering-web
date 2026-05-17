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

  // 后端已 clamp，组件再防御一次（越界/脏数据不破版；负值/超界都不外泄到文案）
  const pct = Math.min(100, Math.max(0, cu.pct))
  const state: keyof typeof FILL_CLASS =
    pct <= 80 ? 'ok' : pct <= 95 ? 'warn' : 'danger'
  // round：pct 后端带 1 位小数，100 - 95.1 在 IEEE754 下 = 4.9000…06，
  // 不 round 会把浮点垃圾渲染进文案；用整数百分比（Claude Code 极简风）
  const remaining = Math.round(Math.max(0, 100 - pct))
  const ariaNow = Math.round(pct)

  return (
    <div className="max-w-3xl mx-auto w-full mb-1.5">
      {/* bg-border：复用边框中性色作未填充轨道底（light/dark 双档已有）；
          如将来需与边框解耦可提 --context-track，本期 YAGNI 不新增（设计 §5.3） */}
      <div
        role="progressbar"
        aria-label="上下文窗口使用量"
        aria-valuenow={ariaNow}
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
          ? `${pct}%`
          : `剩余 ${remaining}% 直到自动压缩`}
        {cu.history_trimmed && ' · 已自动压缩较早历史以继续对话'}
      </p>
    </div>
  )
}
