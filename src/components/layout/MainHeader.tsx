/**
 * src/components/layout/MainHeader.tsx
 *
 * Main 区顶部细头：工程选择器（左）+ 用户菜单（右）。
 * 不跨整个屏幕宽度（仅 main 列宽），跟 Sidebar 头部并排。
 */
import { Bell } from 'lucide-react'

import { ProjectSwitcher } from '@/components/project/ProjectSwitcher'
import { UserMenu } from '@/components/auth/UserMenu'

export function MainHeader() {
  return (
    <header className="h-12 flex items-center px-3 gap-2 shrink-0">
      <ProjectSwitcher />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="通知"
          title="通知（v1.5 上线）"
          disabled
          className="
            p-2 rounded text-muted-foreground hover:bg-muted
            transition-colors disabled:opacity-50
          "
        >
          <Bell className="h-4 w-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
