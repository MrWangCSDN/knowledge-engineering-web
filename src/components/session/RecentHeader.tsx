/**
 * src/components/session/RecentHeader.tsx
 *
 * 侧栏「最近」一级折叠头。点击切换整组展开/折叠。
 *
 * 设计：[[会话历史层级化-设计]] §4, §5（字体规格）, §7
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar'

export function RecentHeader() {
  // 从 store 读折叠状态 + toggle action
  const recentExpanded = useSidebarStore(s => s.recentExpanded)
  const toggleRecent = useSidebarStore(s => s.toggleRecent)

  return (
    <button
      type="button"
      onClick={toggleRecent}
      aria-expanded={recentExpanded}
      // 字体规格（v4，2026-05-21 调层级感）：「最近」最大字号（顶层）
      //   - text-sm (14px) + font-semibold：分组主标签
      //   - text-sidebar-foreground：用主前景色（不是 muted），强化层级头地位
      //   - px-2 缩进最浅（最近 < 工程 < session 递增缩进）
      className="
        w-full flex items-center gap-1 px-2 pt-4 pb-1
        text-sm font-semibold text-sidebar-foreground tracking-wide
        hover:bg-muted rounded transition-colors
      "
    >
      {/* chevron：展开 → ↓ ; 折叠 → → */}
      {recentExpanded ? (
        <ChevronDown
          data-testid="recent-chevron-down"
          className="h-3 w-3"
        />
      ) : (
        <ChevronRight
          data-testid="recent-chevron-right"
          className="h-3 w-3"
        />
      )}
      <span>最近</span>
    </button>
  )
}
