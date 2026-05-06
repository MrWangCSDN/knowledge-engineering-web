import { NavLink } from 'react-router-dom'
import {
  Home,
  Search,
  FileCode,
  Network,
  Database,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/theme'
import { cn } from '@/lib/utils'
// UserMenu 已移到 TopBar；Sidebar 不再渲染（避免重复）。

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: 'browse' | 'analyze'
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: Home, group: 'browse' },
  { to: '/search', label: '全局检索', icon: Search, group: 'browse' },
  { to: '/method', label: '方法详情', icon: FileCode, group: 'browse' },
  { to: '/impact', label: '影响分析', icon: Network, group: 'analyze' },
  { to: '/table-access', label: '方法↔表', icon: Database, group: 'analyze' },
]

export function Sidebar() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  const browseItems = NAV_ITEMS.filter((it) => it.group === 'browse')
  const analyzeItems = NAV_ITEMS.filter((it) => it.group === 'analyze')

  return (
    // 不再用 h-screen — AppLayout 用 flex flex-col 控制总高，Sidebar 跟着 body 自适应
    // hidden lg:flex：窄屏隐藏（W5 会做汉堡菜单）
    <aside className="hidden lg:flex w-60 flex-col border-r bg-background overflow-hidden">
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavGroup title="浏览">
          {browseItems.map((it) => (
            <NavItemLink key={it.to} item={it} />
          ))}
        </NavGroup>

        <NavGroup title="分析">
          {analyzeItems.map((it) => (
            <NavItemLink key={it.to} item={it} />
          ))}
        </NavGroup>
      </nav>

      {/* Footer：主题切换
          UserMenu 已移到 TopBar，这里只剩主题切换。 */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span>{theme === 'dark' ? '亮色模式' : '暗色模式'}</span>
        </Button>
      </div>
    </aside>
  )
}

function NavGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-3">
      <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          )
        }
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </NavLink>
    </li>
  )
}
