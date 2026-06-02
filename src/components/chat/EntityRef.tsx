/** 引用渲染基元：内联 EntityRef（正文 [entity_id|文本]）+ 底部 EntityChip（cited_entities）。
 * v2（代码片段查看器）：点击 → 打开代码片段查看器（openEntity）+ 保留高亮联动；
 *   去掉 MVP 阶段的剪贴板复制行为。 */
import { useContext } from 'react'
import type { ReactNode } from 'react'
import { HighlightCtx } from './HighlightCtx'
// 导入代码片段查看器 Zustand store；点击实体时调用 openEntity 触发抽屉打开
import { useCodeViewerStore } from '@/store/codeViewer'

function shortLabel(entityId: string): string {
  const tail = entityId.split('://')[1] ?? entityId
  // 末段兜底到 tail，再兜底到完整 entityId，避免 'method://' 这类畸形 id 渲染成空 label
  return tail.split(/[.#/]/).pop() || tail || entityId
}

export function EntityRef({ entityId, children }: { entityId: string; children?: ReactNode }) {
  // useContext：从最近的 HighlightCtx.Provider 读取 active（当前高亮的实体）和 setActive（更新函数）
  const { active, setActive } = useContext(HighlightCtx)
  // 计算当前实体是否处于高亮状态，用于切换高亮背景
  const on = active === entityId
  // useCodeViewerStore(s => s.openEntity)：从 Zustand store 选取 openEntity action
  // openEntity 是一个 async 函数，调用后会打开代码片段抽屉并加载代码
  const openEntity = useCodeViewerStore(s => s.openEntity)
  return (
    <button
      type="button"
      // 点击：① 切换高亮（点同一实体再次点击取消高亮）② 打开代码片段查看器
      // void 处理 openEntity 返回的 Promise（避免 lint 报 unhandled Promise warning）
      onClick={() => { setActive(on ? null : entityId); void openEntity(entityId) }}
      title={entityId}
      aria-label={`引用实体 ${entityId}`}
      className={`inline px-1 rounded text-[var(--ref-accent)] underline-offset-2 hover:underline cursor-pointer ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {children}
    </button>
  )
}

// label 可选：底部 section 引用有后端给的人类可读 display_text（如 'Xxx.method()'），
// 优先展示它；缺省（如 message 级 cited_entities 只有 id）才回退 shortLabel(entityId)。
export function EntityChip({ entityId, label }: { entityId: string; label?: string }) {
  // 同 EntityRef：读取高亮上下文 + 代码查看器 openEntity action
  const { active, setActive } = useContext(HighlightCtx)
  // 判断该 chip 当前是否高亮
  const on = active === entityId
  // 从 codeViewer store 取 openEntity action；点击时调用，触发抽屉打开
  const openEntity = useCodeViewerStore(s => s.openEntity)
  return (
    <button
      type="button"
      // 点击：① 切换高亮 ② 打开代码片段查看器（与 EntityRef 行为一致）
      onClick={() => { setActive(on ? null : entityId); void openEntity(entityId) }}
      title={entityId}
      aria-label={`引用实体 ${entityId}`}
      className={`px-2 py-0.5 rounded-full border text-[12px] cursor-pointer transition-colors text-[var(--ref-accent)] border-[var(--ref-accent)]/40 hover:bg-[var(--ref-accent)]/10 ${on ? 'bg-[var(--ref-accent)]/15' : ''}`}
    >
      {label ?? shortLabel(entityId)}
    </button>
  )
}
