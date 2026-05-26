/** 引用渲染基元：内联 EntityRef（正文 [entity_id|文本]）+ 底部 EntityChip（cited_entities）。
 * MVP：轻量交互——点击高亮同 entityId 的其它引用 + 复制 id（不跳实体详情页）。 */
import { useContext } from 'react'
import type { ReactNode } from 'react'
import { HighlightCtx } from './HighlightCtx'

function shortLabel(entityId: string): string {
  const tail = entityId.split('://')[1] ?? entityId
  // 末段兜底到 tail，再兜底到完整 entityId，避免 'method://' 这类畸形 id 渲染成空 label
  return tail.split(/[.#/]/).pop() || tail || entityId
}

export function EntityRef({ entityId, children }: { entityId: string; children?: ReactNode }) {
  const { active, setActive } = useContext(HighlightCtx)
  const on = active === entityId
  return (
    <button
      type="button"
      onClick={() => { setActive(on ? null : entityId); void navigator.clipboard?.writeText(entityId) }}
      title={entityId}
      aria-label={`引用实体 ${entityId}`}
      className={`inline px-1 rounded text-[var(--ref-accent)] underline-offset-2 hover:underline cursor-pointer ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {children}
    </button>
  )
}

export function EntityChip({ entityId }: { entityId: string }) {
  const { active, setActive } = useContext(HighlightCtx)
  const on = active === entityId
  return (
    <button
      type="button"
      onClick={() => { setActive(on ? null : entityId); void navigator.clipboard?.writeText(entityId) }}
      title={entityId}
      aria-label={`引用实体 ${entityId}`}
      className={`px-2 py-0.5 rounded-full border text-[12px] cursor-pointer transition-colors text-[var(--ref-accent)] border-[var(--ref-accent)]/40 hover:bg-[var(--ref-accent)]/10 ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {shortLabel(entityId)}
    </button>
  )
}
