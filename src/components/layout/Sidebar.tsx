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
    <aside className="flex h-screen w-60 flex-col border-r bg-background">
      <div className="px-4 py-5">
        <h1 className="text-lg font-semibold tracking-tight">
          knowledge-engineering
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">代码知识工程 · Web</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
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

      <div className="border-t p-3">
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
