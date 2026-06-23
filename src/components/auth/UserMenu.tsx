/**
 * src/components/auth/UserMenu.tsx
 *
 * 侧边栏底部账号菜单（ChatGPT 风格）
 *
 * UI 逻辑：
 *   - Trigger：撑满侧栏宽度的按钮，展示头像首字母 + 用户名 + 邮箱两行文字
 *   - 点击后向上弹出 radix DropdownMenu：
 *       账号头部（用户名 + 邮箱）
 *       设置 → navigate('/settings')
 *       帮助（disabled）
 *       主题切换
 *       分隔线
 *       退出登录（红色，调 apiLogout + hard redirect）
 *
 * 关键 React / radix 知识：
 *   - DropdownMenuTrigger asChild：让 radix 把焦点管理套在我们自己的 <button> 上，
 *     而不是再包一层 radix 默认 button（避免 button 嵌套 button 的 HTML 非法结构）
 *   - DropdownMenuContent side="top"：弹出层出现在 trigger 上方，符合侧边栏底部场景
 *   - onSelect：radix DropdownMenuItem 的选中回调，选后自动关闭菜单（无需手动 setOpen）
 */

// useNavigate：react-router-dom hook，用于在不刷新页面的情况下跳转路由
import { useNavigate } from 'react-router-dom'

// lucide-react 图标：Settings=齿轮, HelpCircle=问号圆, Sun=太阳, Moon=月亮,
//   LogOut=退出箭头, User(别名 UserIcon)=人形轮廓（用于头像无首字母时的 fallback）
import { Settings, HelpCircle, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react'

// radix DropdownMenu 封装组件（@/components/ui/dropdown-menu.tsx）
// 可用导出：DropdownMenu / Trigger / Content / Item / Label / Separator
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// apiLogout：调用后端 /auth/logout 接口，让服务器清除 HttpOnly refresh_token cookie
import { logout as apiLogout } from '@/api/auth'

// useAuthStore：Zustand 全局认证 store，s.user 存放当前登录用户信息
import { useAuthStore } from '@/store/auth'

// useThemeStore：Zustand 主题 store，提供 theme ('light'|'dark') 和 toggleTheme()
import { useThemeStore } from '@/store/theme'

// export function：具名导出，调用方用 import { UserMenu } from '...' 引入
export function UserMenu() {
  // 从 auth store 读取当前登录用户；selector 确保只订阅 user 字段的变化
  const user = useAuthStore((s) => s.user)

  // 从 theme store 读取当前主题字符串和切换方法
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  // useNavigate：返回一个函数，调用时执行客户端路由跳转（不重刷页面）
  const navigate = useNavigate()

  // 未登录时不渲染任何内容（防止 user.username 报错）
  if (!user) return null

  // onLogout：登出处理函数
  //   async 关键字：声明这是异步函数，内部可以用 await 等待 Promise
  //   顺序：① 调后端清 cookie → ② hard redirect（整页跳转，清空内存 store）
  async function onLogout() {
    try {
      // await：等待 apiLogout() 的 Promise 完成（后端清 HttpOnly refresh_token cookie）
      await apiLogout()
    } catch {
      // 后端 cookie 清除失败（网络异常等）—— 静默忽略，hard redirect 仍可把前端登出
    }
    // replace 而非 href：不在 history 留下当前页，按"后退"不会回到登出前的工程页
    window.location.replace('/login')
  }

  return (
    // DropdownMenu：radix 菜单根组件，管理开关状态和键盘交互
    <DropdownMenu>

      {/* DropdownMenuTrigger asChild：
            asChild 告诉 radix "把你的 Trigger 行为（焦点管理/aria 属性）合并到子元素上"
            而不是再包一个 <button>；我们用自己的 <button> 以便控制样式 */}
      <DropdownMenuTrigger asChild>
        <button
          // aria-label：供屏幕阅读器读出按钮用途
          aria-label="用户菜单"
          // Tailwind 说明：
          //   flex items-center gap-2：横排子元素，间距 8px
          //   w-full：撑满父容器（侧栏）宽度
          //   rounded-md px-2 py-2：圆角 + 内边距
          //   text-left：文字左对齐（button 默认居中）
          //   hover:bg-accent hover:text-accent-foreground：悬停态跟随 design token，light/dark 自动适配
          //   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring：键盘聚焦时显示焦点环（可访问性）
          className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-left
                     hover:bg-accent hover:text-accent-foreground
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* 头像圆圈：取用户名首字母大写 */}
          {/* h-8 w-8 rounded-full：正圆形；grid place-items-center：内容居中 */}
          {/* bg-muted：主题 muted 背景色，light 浅灰 / dark 深灰，自动跟随主题 */}
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-medium shrink-0"
            aria-hidden="true"  // 头像是装饰，屏幕阅读器跳过
          >
            {/* user.username[0]?.toUpperCase()：取首字母大写；?. 可选链防空字符串 */}
            {/* || <UserIcon />：首字母不存在时 fallback 到图标 */}
            {user.username[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
          </span>

          {/* 两行文字区：min-w-0 + 父 flex 必须加，否则 truncate 不生效 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* 第一行：用户名 */}
            {/* truncate：overflow:hidden + text-overflow:ellipsis，超长显示省略号 */}
            <span className="truncate text-sm font-medium">{user.username}</span>
            {/* 第二行：邮箱（较小字号 + muted 色） */}
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </button>
      </DropdownMenuTrigger>

      {/* DropdownMenuContent：弹出层容器
            side="top"：在 trigger 上方弹出（侧边栏底部场景）
            align="start"：与 trigger 左侧对齐
            className w-[--radix-dropdown-menu-trigger-width]：
              CSS 变量，radix 自动注入 trigger 的宽度，弹出层与 trigger 等宽
            min-w-[220px]：最小宽度保证内容可读 */}
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-[--radix-dropdown-menu-trigger-width] min-w-[220px]"
      >
        {/* ── 账号头部：展示用户名 + 邮箱 ── */}
        {/* DropdownMenuLabel：radix 菜单标签，渲染为 div，不可交互、不会被 onSelect 触发 */}
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {/* font-medium：中等字重，视觉上主信息 */}
          <span className="font-medium">{user.username}</span>
          {/* 邮箱用小字 muted 色 */}
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>

        {/* DropdownMenuSeparator：水平分隔线（bg-border，自动跟主题） */}
        <DropdownMenuSeparator />

        {/* ── 设置 ── */}
        {/* DropdownMenuItem onSelect：用户选中（点击或 Enter）后自动关菜单，然后执行回调 */}
        {/* onSelect 内用 () => navigate(...)：() => 是箭头函数，延迟执行（不是立刻调用） */}
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          {/* Settings 图标（gear）；aria-hidden 对屏幕阅读器隐藏装饰图标 */}
          <Settings aria-hidden="true" />
          设置
        </DropdownMenuItem>

        {/* ── 帮助（disabled，v1.5 上线）── */}
        {/* disabled prop：radix 会加 data-disabled 属性并阻止交互，样式走 opacity-50 */}
        <DropdownMenuItem disabled>
          <HelpCircle aria-hidden="true" />
          帮助
        </DropdownMenuItem>

        {/* ── 主题切换 ── */}
        {/* 三元表达式：theme === 'dark' ? <Sun/> : <Moon/>
              - 暗色模式下显示"太阳"图标，文案"亮色模式"（切回亮色）
              - 亮色模式下显示"月亮"图标，文案"暗色模式"（切到暗色）
            onSelect={() => toggleTheme()：选中后调用 theme store 的 toggle 方法 */}
        <DropdownMenuItem onSelect={() => toggleTheme()}>
          {theme === 'dark'
            ? <Sun aria-hidden="true" />
            : <Moon aria-hidden="true" />
          }
          {theme === 'dark' ? '亮色模式' : '暗色模式'}
        </DropdownMenuItem>

        {/* ── 分隔线 ── */}
        <DropdownMenuSeparator />

        {/* ── 退出登录（destructive 危险色）── */}
        {/* variant="destructive"：radix DropdownMenuItem 内置 variant，
              用 data-[variant=destructive] CSS 选择器渲染红色文字 + 聚焦红色背景 */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={onLogout}
        >
          <LogOut aria-hidden="true" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
