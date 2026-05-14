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
      // 字体规格（设计 §5 v2，2026-05-13）：递减式 h2 — 最大最粗 text-base + font-bold + foreground
      className="
        w-full flex items-center gap-1 px-3 pt-3 pb-1.5
        text-base font-bold text-foreground
        hover:bg-muted rounded transition-colors
      "
    >
      {/* chevron：展开 → ↓ ; 折叠 → → */}
      {recentExpanded ? (
        <ChevronDown
          data-testid="recent-chevron-down"
          className="h-3.5 w-3.5"
        />
      ) : (
        <ChevronRight
          data-testid="recent-chevron-right"
          className="h-3.5 w-3.5"
        />
      )}
      <span>最近</span>
    </button>
  )
}
