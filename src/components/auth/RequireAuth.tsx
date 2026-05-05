/**
 * src/components/auth/RequireAuth.tsx
 *
 * 受保护路由的 wrapper 组件（一种 HOC, Higher-Order Component 的写法）
 *
 * ── 什么是 HOC？ ──────────────────────────────────────────────────────────────
 * Higher-Order Component（高阶组件）：接收一个组件、返回一个"增强版"组件的函数/组件。
 * 这里的写法更现代——不是"函数接受组件返回新组件"，而是直接用 children prop 把目标组件
 * 包在里面，效果完全相同（当代 React 最常见的 HOC 模式）。
 *
 * 用法：
 *   <RequireAuth>
 *     <DashboardPage />
 *   </RequireAuth>
 *
 * ── 行为流程 ──────────────────────────────────────────────────────────────────
 * 1. 挂载时：检查内存里的 access_token 是否有效
 *      → 有效：直接放行（render children）
 * 2. 无效：用 HttpOnly cookie 中的 refresh_token 静默换新 access_token（用户无感知）
 *      → 换成功：把新 token + user 写入 store，放行
 *      → 换失败：清空 store，跳转到 /login?from=<当前 URL>（登录后可跳回来）
 * 3. 等待 refresh 期间：显示"检查登录状态..."占位 UI，避免闪 children
 *
 * ── 为什么需要"启动 refresh"？ ────────────────────────────────────────────────
 * access_token 只存内存（Zustand store），刷新页面后变量销毁，token 丢失。
 * 但 refresh_token 在 HttpOnly cookie，生存期更长（1 天 / 7 天），JS 无法读它但浏览器
 * 会自动在请求里带上。
 * 所以页面初始化时用 cookie 换一次 access_token，用户体验就是"刷新页面后仍然登录"。
 */

// useEffect：副作用 hook，组件渲染完成"之后"跑（可以包异步操作）
// useState：状态 hook，返回 [当前值, setter 函数]
import { useEffect, useState } from 'react'

// Navigate：声明式跳转组件——在 render 时被渲染就立刻跳转
//   Navigate vs useNavigate()：
//     - Navigate 是"组件"：适合在 render 流程中根据状态决定是否跳转（条件渲染）
//     - useNavigate() 是"hook"：返回 navigate 函数，适合在事件处理函数/副作用里手动调用
//     - 这里用 Navigate 更自然，因为跳转就是 render 的结果（"状态是 reject 就渲染一个跳转"）
// useLocation：返回当前路由的 location 对象（pathname, search, hash, state, key）
import { Navigate, useLocation } from 'react-router-dom'

// refresh（命名导入时重命名为 apiRefresh）：用 cookie 换新 access_token 的 API 函数
// fetchMe：用 access_token 拿当前用户信息的 API 函数
import { refresh as apiRefresh, fetchMe } from '@/api/auth'

// useAuthStore：Zustand store hook，读取和修改认证全局状态
// accessTokenIsValid：判断内存里的 access_token 是否还有效（剩余 > 60 秒）
import { useAuthStore, accessTokenIsValid } from '@/store/auth'

// ─────────────────────────────────────────────────────────────────────────────
// Props 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props interface —— 描述 RequireAuth 组件接受的 props
 *
 * children 是 React 内置的特殊 prop，类型为 React.ReactNode。
 * React.ReactNode 是一个 union 类型，涵盖了 React 能渲染的所有值：
 *   - ReactElement（即 JSX 产生的对象）
 *   - string / number / boolean / null / undefined
 *   - ReactNode[]（数组）
 * 用 ReactNode 而不是 ReactElement，是因为 children 可以是多个子节点或字符串。
 *
 * React 19 的变化：
 *   React 18 及之前，FC（Function Component）默认隐含 children 在 props 里。
 *   React 19 起建议显式声明 children，代码意图更清晰。
 */
interface Props {
  children: React.ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// RequireAuth 组件
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RequireAuth —— 受保护路由的 HOC wrapper
 *
 * 函数参数里的 { children }: Props：
 *   - 解构（destructuring）：直接从 props 对象里取 children，避免写 props.children
 *   - : Props 是类型注解：告诉 TS 这个参数的形状是 Props interface
 *
 * 函数组件 = 接受 props、返回 JSX 的普通函数（React 会调用它来渲染 UI）
 */
export function RequireAuth({ children }: Props) {
  // useLocation：获取当前路由信息
  //   location.pathname：如 "/dashboard"（不含 search/hash）
  //   location.search：如 "?tab=settings"（含问号）
  //   用途：跳 /login 时把当前完整路径作为 from 参数，登录成功后跳回来
  const location = useLocation()

  // 从 Zustand store 里取三个 action（用 selector 写法，每个取一个字段）
  //   为什么分开取？selector 让 Zustand 做精准订阅：
  //   只有对应字段变化时才重新渲染，而不是 store 里任何值变化都重渲染。
  //   Zustand action（函数）的引用是稳定的（不会每次渲染都变），
  //   所以用它们做 useEffect 依赖数组很安全。
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)

  /**
   * phase —— 组件的"验证状态机"
   *
   * useState<'init' | 'ok' | 'reject'>('init')：
   *   - 泛型参数 <'init' | 'ok' | 'reject'> 是 union 类型（联合类型）
   *     表示这个变量只能是这三个字符串字面量之一
   *   - '('init')' 是初始值：组件刚挂载时处于 init 状态（还不知道验证结果）
   *   - setPhase 是 setter 函数：调用 setPhase('ok') 触发重渲染，phase 变成 'ok'
   *
   * 状态机说明（React 里常用 useState 实现简单状态机）：
   *   init ──(token 有效 / refresh 成功)──▶ ok
   *   init ──(refresh 失败)──────────────▶ reject
   *   ok / reject 都是终态，不再变化
   *
   * 为什么用 union 类型而不是 boolean？
   *   两个布尔值（isLoading, isAuthed）的四种组合里有两种无意义状态（加载中且已验证等）。
   *   用三值枚举更精确，杜绝歧义，TS 类型检查也更严格。
   */
  const [phase, setPhase] = useState<'init' | 'ok' | 'reject'>('init')

  /**
   * useEffect —— 异步验证逻辑
   *
   * useEffect(fn, deps)：
   *   - fn：副作用函数，React 在每次渲染"完成后"（DOM 更新后）执行
   *   - deps（依赖数组）：只有数组里的值发生变化时才重新执行 fn
   *   - deps = [clear, setAccessToken, setUser]：这些 action 引用稳定，实际上只跑一次（挂载时）
   *   - ESLint 的 exhaustive-deps 规则要求所有外部引用都写进 deps，防止潜在 bug
   *
   * ── cancelled 标志 —— 防"setState on unmounted component"────────────────────
   * 场景：用户进入受保护页面触发 refresh，但在 await 期间就切走了（路由跳转 / tab 关闭）。
   * 这时候 await 之后的 setPhase(...) 会尝试更新一个已经不存在的组件。
   * React 18 不会崩溃，但会产生 warning，也可能带来隐患。
   *
   * 解决方案：
   *   let cancelled = false         ← 初始 false
   *   cleanup 返回函数里：cancelled = true    ← 组件卸载时设 true
   *   每次 await 之后：if (cancelled) return  ← 检查后才继续
   *
   * 这是 useEffect + async 的经典最佳实践（因为 useEffect 的 fn 不能直接是 async）。
   * （async 函数返回 Promise，但 useEffect 的 cleanup 必须是同步函数或 void，不能是 Promise）
   */
  useEffect(() => {
    // cancelled：闭包变量（closure variable），在 effect 和 cleanup 之间共享
    // 闭包是指函数"记住"定义时所在作用域的变量——内部的 check() 和返回的 cleanup 函数
    // 都能访问同一个 cancelled 变量
    let cancelled = false

    // check 是内部 async 函数，因为 useEffect 的 callback 不能直接是 async 函数
    // async function check() {} 等价于 function check(): Promise<void> {}
    async function check() {
      // ── 路径 1：内存里已有有效 token ──────────────────────────────────────
      // accessTokenIsValid() 是普通函数（不是 hook），判断 store 里 token 是否还有效
      // 有效条件：token 存在 && 距过期时间 > 60 秒
      if (accessTokenIsValid()) {
        // 直接放行，不需要网络请求
        setPhase('ok')
        return // return 退出 check，不执行后面的 refresh 逻辑
      }

      // ── 路径 2：token 无效，尝试用 cookie 静默 refresh ────────────────────
      // try/catch：捕获 async 函数里 await 抛出的错误
      // apiRefresh() 内部发 POST /auth/refresh，浏览器自动带 cookie（withCredentials: true）
      // 如果 cookie 里有有效的 refresh_token，后端返回新的 access_token
      // 如果没有 / 过期，后端返回 401，axios 抛出 error，进入 catch
      try {
        // await：暂停执行，等待 apiRefresh() 的 Promise 完成
        // 解构赋值：从响应对象中提取 access_token 和 expires_in 两个字段
        const { access_token, expires_in } = await apiRefresh()

        // await 之后第一件事：检查 cancelled 标志
        // 如果组件在 await 期间卸载了，cancelled 已被 cleanup 设为 true，直接 return
        if (cancelled) return

        // 把新拿到的 token 存入 Zustand store
        // setAccessToken(token, expiresInSec) 会同时算出过期时间戳
        setAccessToken(access_token, expires_in)

        // 顺便用新 token 拉一次用户信息（确保 user 数据最新）
        // 此时 store 里有了新 token，apiClient 的请求拦截器会自动在 Authorization header 里带上它
        const user = await fetchMe()

        // await 后再次检查，fetchMe 也是异步的，组件可能在此期间被卸载
        if (cancelled) return

        // 把用户信息存入 store
        setUser(user)

        // 验证通过，切换到 ok 状态，触发重渲染，渲染 children
        setPhase('ok')
      } catch {
        // refresh 或 fetchMe 失败（cookie 过期 / 网络错误 / 后端 500 等）
        // 捕获所有错误，统一处理
        // catch 块不需要错误变量时可以省略 (e) 参数（TS 4.0+ 支持）

        // 同样检查 cancelled，避免在已卸载组件上操作
        if (cancelled) return

        // 清空 store（token、user 全部置 null）——已是未登录状态
        clear()

        // 切换到 reject 状态，触发重渲染，渲染 Navigate 组件跳 /login
        setPhase('reject')
      }
    }

    // 调用 check 函数（不用 await，让它在后台跑；错误已在 check 内部 try/catch 处理）
    check()

    /**
     * cleanup 函数（useEffect 的返回值）：
     *   - React 在以下情况调用 cleanup：
     *     1. 组件从 DOM 中卸载时
     *     2. effect 依赖变化、effect 重跑前（先清理旧的再跑新的）
     *   - 这里把 cancelled 设 true，让后续 await 之后的代码感知到"已取消"
     *   - 箭头函数 () => { ... } 是 cleanup 函数的标准写法
     */
    return () => {
      // 设置标志：通知 check 函数里所有 await 之后的 if (cancelled) return 短路退出
      cancelled = true
    }
    // 依赖数组：这三个 Zustand action 的引用是稳定的，实际 effect 只跑一次（挂载时）
    // ESLint exhaustive-deps 规则要求写出来，保证 store 改动时 effect 不会遗漏更新
  }, [clear, setAccessToken, setUser])

  // ─────────────────────────────────────────────────────────────────────────────
  // 三态渲染
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 状态 1：init ——  等待中（检查 / refresh 还没完成）
   *
   * 显示占位 UI，防止在验证完成前闪一下 children（用户会看到受保护内容一闪而过）。
   * 也防止闪一下"跳 login"（如果先渲染 reject 再渲染 ok，会触发不必要的路由跳转）。
   *
   * Tailwind 类说明：
   *   flex：display: flex（弹性布局）
   *   min-h-screen：min-height: 100vh（至少撑满整个屏幕高度）
   *   items-center：align-items: center（交叉轴居中，垂直居中）
   *   justify-center：justify-content: center（主轴居中，水平居中）
   *   text-muted-foreground：使用 design token 的"静音前景色"（灰色系，不突兀）
   *   text-sm：font-size: 0.875rem（14px，比正文稍小）
   */
  if (phase === 'init') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <div className="text-sm">检查登录状态...</div>
      </div>
    )
  }

  /**
   * 状态 2：reject —— 验证失败，跳转到 /login
   *
   * ── Navigate 组件 vs useNavigate() hook ──────────────────────────────────────
   * Navigate（组件）：
   *   - 在 render 流程里，把它渲染出来就等于跳转（声明式）
   *   - 适合"如果状态是 X，就跳转"这种 render-time 条件跳转
   * useNavigate()（hook）：
   *   - 返回 navigate 函数，在事件处理 / useEffect 里调用（命令式）
   *   - 适合"按钮点击后跳转"、"某个副作用完成后跳转"
   * 这里用 Navigate 更合适——跳转就是当前 phase 决定的渲染结果。
   *
   * ── replace 属性 ──────────────────────────────────────────────────────────────
   * 浏览器历史栈（history stack）默认 push 模式：
   *   用户进 /dashboard → 没登录 → 被送到 /login
   *   如果是 push，历史栈变成：/ → /dashboard → /login
   *   用户按"后退"键 → 回到 /dashboard → 又被踢到 /login → 无限循环！
   *
   * replace 属性（replace prop）：
   *   用"替换当前历史条目"代替"新增条目"
   *   历史栈变成：/ → /login（/dashboard 被替换掉了）
   *   用户按"后退"键 → 回到 /（不会回到 /dashboard 触发循环）
   *
   * ── from 参数 ────────────────────────────────────────────────────────────────
   * location.pathname + location.search：把完整当前路径编码进 URL
   *   例如：用户想访问 /dashboard?tab=settings，被踢到 /login 后
   *   URL 变成 /login?from=%2Fdashboard%3Ftab%3Dsettings
   *   登录组件读到 from 参数，登录成功后 navigate(from) 回到原来的页面和 tab
   *
   * encodeURIComponent()：把路径里的特殊字符（/ ? = &）编码成 URL 安全的字符
   *   否则 /dashboard?tab=settings 的 ? 会和外层 URL 的 ? 冲突，破坏 URL 解析
   */
  if (phase === 'reject') {
    // 把 pathname 和 search（如果有）拼在一起作为 from 参数
    // 例如：location.pathname = "/dashboard"，location.search = "?tab=settings"
    // from = "/dashboard?tab=settings"
    const from = location.pathname + location.search

    // Navigate 组件：渲染即跳转
    //   to：目标路径（带上 from 参数，登录后可跳回来）
    //   replace：用替换历史条目，避免"后退键死循环"
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />
  }

  /**
   * 状态 3：ok —— 验证通过，渲染 children
   *
   * React Fragment（<>...</>）：
   *   - Fragment 是 React 提供的"虚容器"，在 DOM 里不产生任何真实节点（不额外加 div）
   *   - <></> 是 <React.Fragment></React.Fragment> 的简写语法（JSX 语法糖）
   *   - 为什么不直接 return children？
   *     children 类型是 React.ReactNode，直接 return 在 TS 里类型不完全兼容 JSX.Element。
   *     包在 Fragment 里，类型检查更严格，语义也更清晰（"渲染一个 Fragment 包住 children"）
   */
  return <>{children}</>
}
