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
      // 字体规格（v3，2026-05-15）：对齐 ChatGPT 分组标签风格
      //   - text-xs (12px) + font-semibold：小号但有分量
      //   - text-sidebar-muted-foreground：灰色（不是 foreground）→ 分组属性
      //   - uppercase / 中文不变形，但 letter-spacing(tracking) 仍能加可读性
      className="
        w-full flex items-center gap-1 px-3 pt-4 pb-1
        text-xs font-semibold text-sidebar-muted-foreground tracking-wider
        hover:text-sidebar-foreground rounded transition-colors
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
