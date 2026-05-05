/**
 * src/components/auth/LoginForm.tsx
 *
 * 登录表单 —— 受控表单 + 状态机驱动的错误处理
 *
 * ─── 受控 vs 非受控 input ───────────────────────────────────────────────────
 *   受控（controlled）：input 的 value 由 React state 决定，onChange 把用户输入
 *     同步回 state，React 完全掌控表单数据。
 *     好处：表单校验、提交、重置全在 React 内可控，状态永远"真相唯一"。
 *
 *   非受控（uncontrolled）：不设 value / onChange，只用 useRef 在提交时读
 *     DOM 的 input.value，React 不介入用户的每次键盘输入。
 *     好处：少 re-render，性能更好；坏处：实时校验、联动逻辑难写。
 *
 *   这里用受控（标准做法）：每个 input 都有 value={state} + onChange={setState}。
 *
 * ─── 状态机驱动 UI ───────────────────────────────────────────────────────────
 *   不用一堆 boolean（isLoading, hasError, errorType, ...）互相耦合，
 *   而是用 phase: LoginPhase 这个 union 类型做状态机。
 *   好处：状态互斥（不可能同时 loading + error），渲染逻辑 if/else 清晰。
 *   转移路径：idle → validating → success | error_*
 *             error_* → validating（用户重试）
 *
 * ─── Touched 状态模式 ────────────────────────────────────────────────────────
 *   usernameTouched / pwdTouched 在用户"失去焦点"（onBlur）后才变为 true。
 *   校验错误只在 touched=true 时显示，避免用户刚打开表单就看到一堆红字。
 *
 * ─── React Router v7 hooks ───────────────────────────────────────────────────
 *   useNavigate()：在事件处理器里做程序化跳转（非 render 时）。
 *   useSearchParams()：读取 URL 中的 ?from=/dashboard 参数，登录后回跳原页。
 */

// useState：管理本地组件状态的核心 hook；FormEvent：表单提交事件的 React 类型
import { useState, type FormEvent } from 'react'

// lucide-react 提供的图标组件，eye = 睁眼，eyeOff = 闭眼
import { Eye, EyeOff } from 'lucide-react'

// React Router v7 的两个路由 hook
//   useNavigate：返回一个 navigate(path) 函数，用于代码里主动跳转页面
//   useSearchParams：类似 useState，返回 [params, setParams]，读写 URL 的 query string
import { useNavigate, useSearchParams } from 'react-router-dom'

// axios 是 HTTP 请求库；axios.isAxiosError 是 TypeScript 的"类型守卫"（type guard）
// 类型守卫：在 if 分支里缩窄变量类型，让 TS 知道 err 具体是哪种类型
import axios from 'axios'

// 项目内 shadcn/ui 风格 Button，支持 disabled、type 等原生 button 属性
import { Button } from '@/components/ui/button'

// 认证相关 API 调用函数
//   login as apiLogin：起别名避免与组件内可能的本地变量 login 冲突
//   fetchMe：登录成功后立即拉取完整用户信息
import { login as apiLogin, fetchMe } from '@/api/auth'

// Zustand store hook；用 selector 写法只订阅需要的字段，减少不必要的 re-render
import { useAuthStore } from '@/store/auth'

// LoginPhase：union 类型，是这个状态机的所有合法状态
// import type：TypeScript 专有语法，告诉编译器这是纯类型导入，编译后完全消失
import type { LoginPhase } from '@/types/auth'

// ─────────────────────────────────────────────────────────────────────────────
// 组件主体
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LoginForm —— 登录表单组件
 *
 * 无 props：表单内部完全自给自足，登录成功后通过 navigate() 离开当前页。
 * 调用方只需把它放在页面中央：<LoginForm />
 */
export function LoginForm() {
  // ─── Router hooks ───────────────────────────────────────────────────────────

  // useNavigate：programmatic navigation hook
  //   返回值是一个函数：navigate(to, options?)
  //     to：字符串路径（'/home'）或数字（-1 = 后退）
  //     options.replace：true = 替换当前历史记录（不能后退回登录页），这里登录后用这个
  //   注意：useNavigate 只能在组件内（render 阶段）调用 hook，
  //         但 navigate() 函数可以在任何地方调（事件处理器、setTimeout 等）
  const navigate = useNavigate()

  // useSearchParams：读写 URL 的 query string（?key=value）
  //   类似 useState，返回 [params, setParams] 元组（tuple）
  //   params 是 URLSearchParams 对象：params.get('from') 读 ?from= 的值
  //   这里只需要读，所以只解构第一个元素（用 _ 忽略 setParams）
  const [params] = useSearchParams()

  // ─── Zustand store：用 selector 函数订阅需要的字段 ─────────────────────────
  //   useAuthStore(s => s.setAccessToken)：selector 函数
  //   作用：只有当 setAccessToken 这个函数引用变化时才触发 re-render
  //         （action 函数引用通常不变，所以这个组件不会因为其他 store 字段变化而重渲染）
  //   相反，useAuthStore() 不传 selector 会订阅整个 store，任何字段变化都重渲染（浪费）
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)

  // ─── 受控表单字段 state ──────────────────────────────────────────────────────
  //   useState<类型>(初始值) 返回 [当前值, setter函数] 元组
  //   当 setter 被调用时，React 会触发组件重新渲染（re-render）
  //   每次 re-render，input 的 value={username} 会更新为最新值，完成"受控"循环

  // 邮箱或用户名输入框的值，初始为空字符串
  const [username, setUsername] = useState('')
  // 密码输入框的值，初始为空字符串
  const [password, setPassword] = useState('')
  // 是否以明文显示密码（控制 input type = 'text' 还是 'password'）
  const [showPwd, setShowPwd] = useState(false)
  // "记住我"复选框状态，决定传给后端的 remember_me 字段
  const [rememberMe, setRememberMe] = useState(false)

  // ─── Touched 标志：决定何时显示校验错误消息 ─────────────────────────────────
  //   Touched 状态模式（touched state pattern）：
  //     用户刚打开表单时，usernameTouched = false，校验错误不显示。
  //     用户在 username input 里输入后离开（onBlur），setUsernameTouched(true)。
  //     之后只要 username 不合法，校验错误就会出现。
  //   这样避免了"用户刚打开表单就看到一堆红字"的糟糕体验。

  // 用户是否曾 blur（离开焦点）过 username 输入框
  const [usernameTouched, setUsernameTouched] = useState(false)
  // 用户是否曾 blur 过 password 输入框
  const [pwdTouched, setPwdTouched] = useState(false)

  // ─── 状态机 phase + 错误消息 ──────────────────────────────────────────────
  //   useState<LoginPhase> 告诉 TypeScript：这个 state 只能是 LoginPhase 联合类型里的值
  //   好处：如果拼错了 setPhase('validatng')，TypeScript 编译器会报错

  // 当前登录流程所处的阶段，初始为 'idle'（空闲，用户还没提交）
  const [phase, setPhase] = useState<LoginPhase>('idle')
  // 当前的错误消息文本（空字符串 = 无错误），用于 error banner 显示
  const [errMsg, setErrMsg] = useState<string>('')

  // ─── 派生校验状态（derived state，不存 state，每次 render 重算）──────────────
  //   "派生"的意思：这些值完全由其他 state 决定，不需要再单独 setState。
  //   React 推荐：能从现有 state 算出来的值，就不要再 useState 存一份
  //   （存两份可能出现不一致，是 bug 的温床）。
  //
  //   三元表达式语法：条件 ? 真值 : 假值
  //     usernameTouched && username.trim().length < 3 ? '至少 3 个字符' : ''
  //     当 usernameTouched 为 false 时，由于短路求值，整个表达式是 ''（无错误显示）
  //     当 usernameTouched 为 true 且 username 过短时，表达式是错误提示字符串

  // username 的内联错误消息：只在 touched 后且长度不足时非空
  const usernameError =
    usernameTouched && username.trim().length < 3 ? '至少 3 个字符' : ''

  // password 的内联错误消息：只在 touched 后且长度不足时非空
  const pwdError = pwdTouched && password.length < 8 ? '至少 8 个字符' : ''

  // 表单整体是否合法（同时满足：username 有效 + password 有效 + 不在提交中）
  //   用这个值控制按钮的 disabled 状态，避免用户提交无效表单
  //   phase !== 'validating' 防止请求飞行中重复提交
  const formValid =
    username.trim().length >= 3 && password.length >= 8 && phase !== 'validating'

  // ─── 提交 handler ────────────────────────────────────────────────────────────
  //
  //   FormEvent：React 包装过的 DOM SubmitEvent，带有 preventDefault 等方法。
  //   类型注解 (e: FormEvent)：告诉 TypeScript 这个参数的类型，让编译器检查 e 的用法。
  //
  //   async：标记函数为异步函数，内部可以使用 await 等待 Promise。
  //   async 函数返回 Promise<void>（即使不写 return）。
  //
  async function onSubmit(e: FormEvent) {
    // e.preventDefault()：阻止浏览器的默认表单提交行为。
    //   默认行为：把表单数据序列化成 query string 或 request body，
    //             然后跳转到 <form action="xxx"> 指定的 URL，导致页面刷新。
    //   我们用 axios 手动 POST，完全不需要浏览器的默认行为，所以必须阻止。
    e.preventDefault()

    // 双重保险：按钮 disabled 已经挡掉不合法的点击，这里再检查一次
    // 防止极端情况下（如 JS 操控 DOM）绕过按钮 disabled 的提交
    if (!formValid) return

    // 进入"请求飞行中"状态：禁用表单、改变按钮文字
    setPhase('validating')
    // 清除上一次的错误消息（比如用户改了密码后重试）
    setErrMsg('')

    // try/catch：try 块里的代码如果抛出错误，会跳到 catch 块处理
    //   await 的 Promise 如果 reject，相当于抛出 error，也会触发 catch
    try {
      // 调用登录 API，await 等待 Promise 完成，拿到 access_token 和过期秒数
      //   username.trim()：去掉用户不小心输入的首尾空格（常见用户操作失误）
      //   解构赋值：const { access_token, expires_in } = await apiLogin(...)
      //     等价于：const resp = await apiLogin(...); const access_token = resp.access_token; ...
      const { access_token, expires_in } = await apiLogin({
        username: username.trim(),
        password,
        remember_me: rememberMe,
      })

      // 把 access_token 存入 Zustand store（内存中，不持久化）
      // setAccessToken 同时计算过期时间戳：Date.now() + expires_in * 1000
      setAccessToken(access_token, expires_in)

      // 立即拉取用户信息（这样侧边栏、头部等可以立刻显示用户名/头像）
      // 用内层 try/catch 包裹：fetchMe 失败不阻塞登录流程（极少见）
      try {
        const me = await fetchMe()
        // setUser 更新 Zustand store 里的 user 字段（并持久化到 sessionStorage）
        setUser(me)
      } catch {
        // fetchMe 失败时静默处理，不抛错给外层 try
        // 用户仍然能进入系统，只是用户信息暂时为 null，下次刷新会重试
      }

      // 登录成功，切换到 success 状态
      setPhase('success')

      // 读取 URL 中的 ?from=xxx 参数
      //   场景：用户访问 /dashboard，但 RequireAuth 检测到未登录，
      //         把用户重定向到 /login?from=/dashboard，
      //         登录成功后应该跳回 /dashboard 而不是首页
      const from = params.get('from')

      // navigate(path, { replace: true })：跳转到目标页，同时替换当前历史记录
      //   replace: true 的作用：让"后退"键无法回到登录页（已完成登录，回去没意义）
      navigate(from || '/', { replace: true })
    } catch (err) {
      // ─── 错误处理：把 HTTP 状态码映射到对应的 phase + 错误消息 ──────────────
      //
      //   axios.isAxiosError(err)：TypeScript 类型守卫（type guard）
      //     类型守卫：一个返回 boolean 的特殊函数，格式为 `value is Type`。
      //     在 if (axios.isAxiosError(err)) { ... } 块内，
      //     TypeScript 知道 err 是 AxiosError 类型，有 .response / .request / .config 等字段。
      //     在 if 块外，err 仍然是 unknown 类型（TypeScript 的默认 catch 类型）。
      //
      //   err.response?.status：可选链（optional chaining）运算符 ?.
      //     如果 err.response 是 undefined/null，不会抛错，直接返回 undefined。
      //     等价于：err.response ? err.response.status : undefined
      //     用在可能为 null 的中间节点时非常方便。

      // 提取 HTTP 状态码：如果 err 是 AxiosError 且有 response，就读 status；否则 undefined
      const status = axios.isAxiosError(err) ? err.response?.status : undefined

      if (status === 401) {
        // 401 Unauthorized：用户名或密码不正确
        setPhase('error_invalid')
        setErrMsg('用户名或密码不正确')
      } else if (status === 423) {
        // 423 Locked：账号被锁定（通常因为连续多次登录失败）
        // 后端可能在 response.data.detail 里写了锁定时长等信息
        //   (err.response?.data as { detail?: string })?.detail
        //     1. err.response?.data：可选链读取响应体（可能是任意 JSON）
        //     2. as { detail?: string }：类型断言，告诉 TS 把它当成这个形状的对象
        //        注意：as 不做运行时检查，只是告诉 TS"相信我，它是这个类型"
        //     3. ?.detail：再次可选链读取 detail 字段
        //     4. || '账号已锁定'：如果 detail 为 undefined，回退到默认消息
        const detail =
          (axios.isAxiosError(err) &&
            (err.response?.data as { detail?: string })?.detail) ||
          '账号已锁定，请联系管理员'
        setPhase('error_locked')
        setErrMsg(detail)
      } else if (status === 429) {
        // 429 Too Many Requests：触发了后端的请求速率限制
        setPhase('error_rate_limit')
        setErrMsg('请求过于频繁，请稍后再试')
      } else if (status !== undefined && status >= 500) {
        // 5xx：服务器内部错误（500 Internal Server Error、502 Bad Gateway、503 等）
        setPhase('error_server')
        setErrMsg('服务器错误，请联系管理员或稍后再试')
      } else {
        // status 为 undefined：没有收到 HTTP 响应
        //   常见原因：网络断开、DNS 解析失败、CORS 预检被拒、请求超时
        setPhase('error_network')
        setErrMsg('网络错误，请检查网络连接后重试')
      }
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────
  //   JSX（JavaScript XML）：让我们在 JS/TS 里写类 HTML 语法。
  //   编译器把 JSX 转换成 React.createElement(...) 调用。
  //   每次 re-render，React 对比新旧"虚拟 DOM"，只更新真正变化的 DOM 节点（diff 算法）。

  return (
    // <form> 元素：把所有表单控件包起来
    //   onSubmit：提交事件 handler（点击 type="submit" 按钮或按 Enter 键触发）
    //   noValidate：禁用浏览器原生的 HTML5 校验（required、minLength 等），
    //               改用我们自己写的校验逻辑（更灵活、UI 风格统一）
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[360px] space-y-5"
      noValidate
    >
      {/* 标题区域 */}
      <div>
        {/* text-2xl：字体大小约 1.5rem；font-semibold：字重 600；tracking-tight：字间距收紧 */}
        <h1 className="text-2xl font-semibold tracking-tight">欢迎回来</h1>
        {/* text-muted-foreground：Tailwind 主题 token，浅灰文字色，light/dark 下自动切换 */}
        <p className="mt-1 text-sm text-muted-foreground">请使用账号登录</p>
      </div>

      {/* ── 错误 banner ─────────────────────────────────────────────────────── */}
      {/* JSX 条件渲染：{condition && <JSX>} 当 condition 为 falsy 时不渲染任何东西 */}
      {/* errMsg 为空字符串（falsy）时，banner 不渲染；有错误时才出现 */}
      {errMsg && (
        <div
          // bg-destructive/10：destructive 色（红色系）10% 不透明度的背景
          // border-destructive/30：destructive 色 30% 不透明度的边框
          // text-destructive：主题 token，深红文字，dark 模式下自动调整
          // role="alert"：ARIA 语义，告诉屏幕阅读器这是一个动态弹出的警告信息
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errMsg}
        </div>
      )}

      {/* ── username 字段 ──────────────────────────────────────────────────── */}
      <div className="space-y-1">
        {/* htmlFor="username"：关联 label 与 id="username" 的 input
              点击 label 文字时，对应 input 自动获取焦点（可访问性 & 易用性） */}
        <label htmlFor="username" className="text-sm font-medium">
          邮箱 / 用户名
        </label>

        {/* 受控 input：
              value={username}：由 React state 驱动，这是"受控"的核心
              onChange={(e) => setUsername(e.target.value)}：
                e 的类型是 React.ChangeEvent<HTMLInputElement>（TS 自动推断）
                e.target.value：用户输入的当前值（DOM 中读取）
                setUsername(...)：更新 state，触发 re-render，input 显示新值
              onBlur：当 input 失去焦点时触发，设置 touched=true，允许显示校验错误
              autoComplete="username"：让浏览器密码管理器识别这是登录表单的用户名字段
              disabled={phase === 'validating'}：请求飞行中禁用，防止用户修改后重复提交 */}
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => setUsernameTouched(true)}
          disabled={phase === 'validating'}
          // border-input：主题 token，边框色（light: gray-200，dark: gray-700 等）
          // bg-background：主题 token，背景色（light: white，dark: gray-950 等）
          // focus:ring-ring：聚焦时出现 ring 色边框，ring token 也跟随主题
          // disabled:opacity-50：禁用时降低不透明度，给用户"不可交互"的视觉反馈
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                     placeholder:text-muted-foreground
                     focus:outline-none focus:ring-2 focus:ring-ring
                     disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* 内联校验错误：usernameError 不为空时才显示
              text-destructive：红色文字，主题 token，dark 下自动变亮 */}
        {usernameError && (
          <p className="text-xs text-destructive">{usernameError}</p>
        )}
      </div>

      {/* ── password 字段 + 明文 toggle ────────────────────────────────────── */}
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>

        {/* relative 容器：让眼睛按钮可以用 absolute 定位 */}
        <div className="relative">
          {/* 受控 password input
                type={showPwd ? 'text' : 'password'}：
                  'password' 类型让浏览器把字符显示为黑点（●）
                  'text' 类型正常显示明文
                  showPwd state 控制切换
                autoComplete="current-password"：告诉密码管理器这是密码字段（与 username 对应） */}
          <input
            id="password"
            name="password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPwdTouched(true)}
            disabled={phase === 'validating'}
            // pr-10：右边内边距留给眼睛按钮，防止文字和按钮重叠
            className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm
                       placeholder:text-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-ring
                       disabled:cursor-not-allowed disabled:opacity-50"
          />

          {/* 眼睛 toggle 按钮：点击切换密码明文/掩码显示
                type="button"：⚠️ 非常重要！
                  form 内的按钮，默认 type="submit"，会触发表单提交。
                  显式写 type="button" 才能只执行 onClick 而不提交表单。
                -translate-y-1/2 + top-1/2：垂直居中的经典 CSS 技巧
                  top-1/2 把按钮顶边移到父容器中心，
                  -translate-y-1/2 再向上偏移自身高度的一半，实现精确居中
                aria-label：屏幕阅读器（无障碍）会朗读这个标签，描述按钮功能
                  图标按钮没有文字，aria-label 是必要的无障碍属性 */}
          <button
            type="button"
            onClick={() => setShowPwd((prev) => !prev)}
            // (prev) => !prev：函数式更新写法
            //   使用上一个 state 值算新值时，建议传函数（而不是 !showPwd）
            //   原因：React 的 state 更新是异步批处理的，直接读外层 showPwd
            //         在某些情况下可能读到旧值；传函数则保证用的是最新值
            disabled={phase === 'validating'}
            aria-label={showPwd ? '隐藏密码' : '显示密码'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1
                       text-muted-foreground hover:text-foreground
                       focus:outline-none focus:ring-2 focus:ring-ring focus:rounded
                       disabled:pointer-events-none"
          >
            {/* 条件渲染：根据 showPwd 决定显示哪个图标
                  showPwd=true（密码明文）→ 显示 EyeOff（点击可隐藏）
                  showPwd=false（密码隐藏）→ 显示 Eye（点击可显示） */}
            {showPwd ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* 密码内联校验错误 */}
        {pwdError && (
          <p className="text-xs text-destructive">{pwdError}</p>
        )}
      </div>

      {/* ── 记住我 checkbox ─────────────────────────────────────────────────── */}
      {/* 将 input + span 包在 label 里：点击文字也能切换 checkbox（可访问性更好）
            onChange={(e) => setRememberMe(e.target.checked)}：
              checkbox 的 checked 属性（布尔值）通过 e.target.checked 读取
              注意不是 e.target.value（value 是 string，checked 才是 boolean） */}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          disabled={phase === 'validating'}
          className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
        />
        <span>记住我（7 天）</span>
      </label>

      {/* ── 提交按钮 ─────────────────────────────────────────────────────────── */}
      {/* Button 是项目 shadcn/ui 风格组件，内部用了 cva 处理 variant/size
            type="submit"：点击触发 form 的 onSubmit 事件
            disabled={!formValid}：
              !formValid = 表单无效（username 太短 | password 太短 | 请求飞行中）
              disabled 时按钮视觉变暗、pointer-events-none（鼠标穿透），无法点击 */}
      <Button
        type="submit"
        disabled={!formValid}
        className="w-full"
      >
        {/* 状态机驱动的按钮文字：validating 中显示"登录中…"，否则显示"登 录" */}
        {phase === 'validating' ? '登录中…' : '登 录'}
      </Button>

      {/* ── 忘记密码提示 ─────────────────────────────────────────────────────── */}
      {/* text-center：文字居中；text-muted-foreground：浅灰色，不喧宾夺主 */}
      <p className="text-center text-xs text-muted-foreground">
        忘记密码？联系管理员
      </p>
    </form>
  )
}
