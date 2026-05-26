/** agent 引用高亮上下文（message 级）：点一个 EntityRef/EntityChip 高亮全部同 entityId 的引用。
 * 单独成文件（不与组件同文件导出）以满足 react-refresh/only-export-components（HMR 不被打断）。 */
import { createContext } from 'react'

export const HighlightCtx = createContext<{
  active: string | null
  setActive: (id: string | null) => void
}>({ active: null, setActive: () => {} })
