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
// 引入用户菜单组件：展示当前登录账号信息，并提供登出入口
import { UserMenu } from '@/components/auth/UserMenu'

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

      {/* Footer：用户菜单（账号信息 / 登出）+ 主题切换
          用 space-y-1 让两个区块之间留出一点间距，视觉上不会粘连 */}
      <div className="border-t p-2 space-y-1">
        {/* 账号在上，主题在下：
            账号信息（当前是谁登录的）层级比主题开关更重要，
            用户切换账号的频率远高于切换主题，因此放在视线更自然落到的上方。
            这是"高频 / 高优先级操作在前"的视觉层级原则。 */}
        <UserMenu />

        {/* 主题切换按钮保持原有逻辑不变，仅位置移到 UserMenu 之下 */}
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
