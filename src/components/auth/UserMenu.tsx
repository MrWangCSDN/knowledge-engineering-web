/**
 * src/components/auth/UserMenu.tsx
 *
 * 侧边栏底部用户菜单 —— 头像 + 用户名 + 下拉登出
 *
 * UI 逻辑：
 *   - 默认显示用户名 + 一个箭头
 *   - 点击展开 dropdown：显示完整 email + "登出"按钮
 *   - 点击 dropdown 外的任何地方自动关闭
 *
 * 关键 React 知识：
 *   - useRef：拿到 DOM 节点的引用，用来判断"点击是否在组件外"
 *   - useEffect + cleanup：订阅 document.mousedown 事件，组件卸载时反订阅
 *   - mousedown vs click：mousedown 早于 click 触发，避免 dropdown 关掉前
 *     里面的按钮已经接到 click（这样就点不到登出了）
 */

// useEffect：在组件"副作用"时机执行代码（如事件监听、网络请求），是 React 函数组件的生命周期替代方案
// useRef：创建一个可变的"盒子"，保存 DOM 节点引用；改变 ref.current 不会触发重新渲染
// useState：声明组件内的响应式状态，改变它会触发重新渲染
import { useEffect, useRef, useState } from 'react'

// useNavigate：react-router-dom 提供的 hook，返回一个函数，调用后可以编程式跳转路由
import { useNavigate } from 'react-router-dom'

// 从 lucide-react 引入三个 SVG 图标组件：向下箭头、登出图标、用户图标
// User 别名为 UserIcon，避免与项目里的 User 类型同名冲突
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react'

// Button：shadcn/ui 风格的通用按钮组件，支持 variant、size 等 prop
import { Button } from '@/components/ui/button'

// apiLogout：调用后端 /auth/logout 接口，让服务器清除 refresh_token cookie
import { logout as apiLogout } from '@/api/auth'

// useAuthStore：Zustand 全局状态 hook，存储 access_token 和登录用户信息
import { useAuthStore } from '@/store/auth'

// export function：具名导出，调用方用 import { UserMenu } from '...' 引入
export function UserMenu() {
  // useNavigate 返回的 navigate 函数用于在代码里跳转页面（不依赖 <Link> 组件）
  const navigate = useNavigate()

  // 从 store 读取当前登录用户对象；selector (s => s.user) 保证只订阅 user 字段变化
  // user 类型是 User | null；未登录或登出后值为 null
  const user = useAuthStore((s) => s.user)

  // clear：Zustand action，把 accessToken / user 全部重置为 null（清空登录态）
  const clear = useAuthStore((s) => s.clear)

  // open：boolean 状态，控制 dropdown 是否展开
  // useState(false) 表示初始值为 false（关闭状态）
  const [open, setOpen] = useState(false)

  // useRef<HTMLDivElement>(null)：
  //   - 泛型 <HTMLDivElement> 告诉 TypeScript 这个 ref 将来会指向一个 div 元素
  //   - 初始值为 null，React 在 DOM 挂载后会自动把真实 DOM 节点赋给 ref.current
  //   - 与 useState 不同：修改 ref.current 不触发重新渲染，适合"只是要拿到节点"的场景
  const ref = useRef<HTMLDivElement>(null)

  // useEffect：副作用 hook，在组件挂载后执行传入的函数
  //   - 第二个参数 [] 是依赖数组，空数组表示"只在挂载时执行一次"
  //   - 返回的函数是 cleanup（清理函数），在组件卸载时自动调用
  useEffect(() => {
    // 为什么用 mousedown 而不是 click？
    //   mousedown 比 click 早触发（按下时就触发，松开才是 click）。
    //   如果用 click：用户点 dropdown 里的"登出"按钮时，
    //     先触发 click → 关闭 dropdown → 登出按钮的 click 事件已消失，点不到。
    //   用 mousedown：在按下时就判断是否在组件外，
    //     若在外面就关闭；若在里面（如登出按钮）不关闭，让 click 正常触发。
    function handleMouseDown(e: MouseEvent) {
      // ref.current 在极端情况下（如组件正在卸载）可能为 null，先判断
      // Node.contains(node)：判断目标节点是否是当前节点的后代（包括自身）
      // e.target as Node：类型断言，告诉 TS 事件目标一定是 DOM 节点（MouseEvent.target 是 EventTarget，比 Node 更宽泛）
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // 点击位置不在组件内 → 关闭 dropdown
        setOpen(false)
      }
    }

    // 在 document 上挂载全局 mousedown 监听
    // 这样无论用户点页面哪里，回调都会触发
    document.addEventListener('mousedown', handleMouseDown)

    // cleanup 函数：组件卸载时执行，移除监听器
    // 不清理会导致"内存泄漏"：组件已销毁，但监听器仍在 document 上，引用着已消亡的闭包
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, []) // 空依赖数组：只在挂载/卸载时各执行一次

  // && 短路求值（条件渲染）：
  //   左侧 !user 为 true（即 user 为 null）时，直接 return null，React 不渲染任何内容
  //   这会在以下情况发生：用户未登录、登出后 store 被 clear、页面刚加载还没拿到 user
  if (!user) return null

  // onLogout：async 函数，处理登出流程
  // async 关键字让函数内部可以使用 await（等待 Promise 完成）
  async function onLogout() {
    try {
      // await：等待 apiLogout() 返回的 Promise 完成
      // 调用后端接口清除 refresh_token cookie（HttpOnly cookie，JS 无法直接删除，必须靠后端）
      await apiLogout()
    } catch {
      // 捕获并静默忽略网络错误：即使后端接口失败，也要让用户能登出
      // 原因：本地 store 和 token 才是前端鉴权的关键，后端 cookie 失效不影响前端"登出"体验
    }
    // 清空 Zustand store：accessToken / user 全部置 null
    clear()
    // 关闭 dropdown（防止导航完成前 dropdown 短暂可见）
    setOpen(false)
    // navigate('/login', { replace: true })：
    //   replace: true 表示用新路由替换当前历史记录（而非追加），
    //   这样用户按浏览器"回退"不会回到需要登录的页面
    navigate('/login', { replace: true })
  }

  return (
    // 最外层 div：relative 定位，让内部的 absolute dropdown 相对它定位
    // ref 挂在这里，包住触发按钮和 dropdown，contains() 才能正确判断"点击在不在组件内"
    <div className="relative" ref={ref}>

      {/* 触发按钮：点击切换 dropdown 开关状态 */}
      <button
        // 函数式更新 (v) => !v：用上一次的 open 值取反，避免闭包陷阱（stale closure）
        // 闭包陷阱：直接用 setOpen(!open) 时，open 可能是旧值；函数式更新始终基于最新状态
        onClick={() => setOpen((v) => !v)}
        // aria-label：无障碍属性，供屏幕阅读器读取按钮用途（视觉用户看不见，但辅助技术依赖它）
        aria-label="用户菜单"
        // aria-expanded：告知辅助技术当前折叠面板是否展开（true/false）
        aria-expanded={open}
        // Tailwind 类名说明：
        //   flex + items-center + gap-2：横向排列子元素，间距 8px
        //   w-full：撑满父容器宽度（适配侧边栏）
        //   rounded-md：中等圆角
        //   px-2 py-2：内边距 8px（水平）/ 8px（垂直）
        //   text-left text-sm：左对齐、小字号
        //   hover:bg-accent hover:text-accent-foreground：悬停时用主题 accent 色（跟随 light/dark 主题）
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm
                   hover:bg-accent hover:text-accent-foreground"
      >
        {/* 头像圆圈：取用户名首字母大写显示 */}
        {/* grid place-items-center：让内容水平+垂直居中（比 flex 更简洁的居中写法） */}
        {/* bg-muted：主题 muted 背景色，light 下是浅灰，dark 下自动切换为深色 */}
        <span
          className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-medium"
          aria-hidden="true"  // aria-hidden：对辅助技术隐藏（头像只是装饰，用户名才是信息载体）
        >
          {/* user.username[0]：取字符串第一个字符；?.toUpperCase()：可选链，防止空字符串报错 */}
          {/* || <UserIcon />：若首字母不存在（极端情况），fallback 显示图标 */}
          {user.username[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
        </span>

        {/* 用户名文字 */}
        {/* flex-1：占据按钮剩余宽度（撑开让箭头靠右） */}
        {/* truncate：超长时显示省略号，防止撑破侧边栏布局 */}
        <span className="flex-1 truncate">{user.username}</span>

        {/* 展开/收起箭头图标 */}
        {/* transition-transform：CSS 过渡动画，让旋转有动画效果 */}
        {/* open 时 rotate-180：旋转 180 度（箭头朝上，表示"点击可收起"） */}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"  // 装饰性图标，对屏幕阅读器隐藏
        />
      </button>

      {/* dropdown 面板：仅 open 为 true 时渲染（&& 短路，false 时 React 不挂载此节点） */}
      {open && (
        // absolute top-full：绝对定位，top-full 让 dropdown 出现在触发按钮下方
        // （此组件在顶部 MainHeader 用，向下弹合理；旧版 bottom-full 是 sidebar 底部场景遗留）
        // right-0：右对齐 trigger，避免长 email 撑到屏幕外
        // min-w-[200px]：最小宽度，保证 email + 登出按钮可读
        // mt-1：与按钮之间留 4px 间距
        // border bg-popover shadow-md：主题边框色、弹出层背景色、中等阴影
        //   bg-popover 是 shadcn/ui design token，light/dark 下自动切换，不需要手动适配
        // z-50：层级高于其他 absolute 元素（如 sidebar 折叠 chevron / mermaid 图）
        <div
          className="absolute top-full right-0 mt-1 min-w-[200px] rounded-md border bg-popover shadow-md z-50"
          // role="menu" + aria-label：让屏幕阅读器知道这是一个菜单区域
          role="menu"
          aria-label="用户操作菜单"
        >
          {/* email 展示行 */}
          {/* border-b：底部边框，与下方登出按钮分隔 */}
          {/* text-muted-foreground：主题 muted 文字色，light 下灰色，dark 下自动调整 */}
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">
            {user.email}
          </div>

          {/* 登出按钮 */}
          {/* variant="ghost"：透明背景、无边框的按钮风格（悬停时才显示背景） */}
          {/* size="sm"：小尺寸（高度 / padding 更紧凑） */}
          {/* justify-start：内部内容左对齐（默认 ghost 按钮内容居中） */}
          {/* text-destructive hover:text-destructive：destructive 是主题"危险操作"色 */}
          {/*   light 下通常是红色，dark 下自动切换为更亮的红，无需手动写色值 */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 px-3 text-destructive hover:text-destructive"
            onClick={onLogout}
            role="menuitem"  // 告知辅助技术这是菜单项
          >
            {/* LogOut 图标（纯装饰，aria-hidden） */}
            <LogOut className="h-4 w-4" aria-hidden="true" />
            登出
          </Button>
        </div>
      )}
    </div>
  )
}
