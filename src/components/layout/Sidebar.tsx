import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { SessionHistory } from '@/components/session/SessionHistory'

/**
 * 左侧栏 = 会话历史 + 底部主题切换。
 *
 * v1：W5 起把原本的导航 (浏览/分析) 替换为 SessionHistory。
 *     导航类页面 (/search, /method, /impact, /table-access)
 *     v1 不在 sidebar 直接暴露，可通过实体链接跳转。
 *
 * UserMenu 已移到 TopBar；Sidebar 不再渲染。
 */
export function Sidebar() {
  const theme = useThemeStore(s => s.theme)
  const toggleTheme = useThemeStore(s => s.toggleTheme)

  return (
    // hidden lg:flex：窄屏隐藏（W5+ 加汉堡菜单按需展开）
    <aside className="hidden lg:flex w-[280px] flex-col border-r bg-background overflow-hidden shrink-0">
      <div className="flex-1 overflow-hidden">
        <SessionHistory />
      </div>

      {/* Footer：主题切换 */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{theme === 'dark' ? '亮色模式' : '暗色模式'}</span>
        </Button>
      </div>
    </aside>
  )
}
