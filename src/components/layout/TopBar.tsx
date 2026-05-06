/**
 * src/components/layout/TopBar.tsx
 *
 * 顶栏：logo · 工程选择器 · 通知 · 用户菜单
 *
 * 设计文档：[[首页设计]] §3.1
 */
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'

import { ProjectSwitcher } from '@/components/project/ProjectSwitcher'
import { UserMenu } from '@/components/auth/UserMenu'

export function TopBar() {
  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
      {/* logo + 品牌名 */}
      <Link to="/" className="flex items-center gap-2 shrink-0">
        <span className="text-lg">💎</span>
        <span className="font-semibold text-sm">KE</span>
      </Link>

      {/* 分割线 */}
      <div className="h-6 w-px bg-border" />

      {/* 工程选择器 */}
      <ProjectSwitcher />

      {/* 右侧：通知 + 用户菜单 */}
      <div className="ml-auto flex items-center gap-1">
        <button
          className="p-2 rounded hover:bg-muted text-muted-foreground transition-colors"
          aria-label="通知"
          title="通知（v1.5 上线）"
          disabled
        >
          <Bell className="h-4 w-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
