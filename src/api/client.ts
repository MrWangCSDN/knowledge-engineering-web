/**
 * src/api/client.ts
 *
 * 全局 axios 客户端 + 自动认证拦截器
 *
 * 拦截器 (interceptor) 是 axios 的核心特性：每个请求/响应都会经过拦截器链。
 * 写在这里的逻辑对 ALL apiClient 调用都生效，组件代码不用关心 token / 401 处理。
 *
 * 本文件做两件事：
 *   1. 请求拦截：每个请求自动加 Authorization: Bearer <access_token>
 *   2. 响应拦截：401 时自动刷新 token + 重试一次；再失败跳 /login
 *
 * 关于 baseURL='/api'：
 *   开发环境 vite proxy 把 /api/* 转发到 http://localhost:8000/*
 *   生产环境 nginx 反代 /api/* 到 :8000/*
 *   组件代码统一调用 apiClient.get('/search')，实际打到 :8000/search
 */

// axios 是主库；AxiosError 是 axios 对错误的专用类型；AxiosRequestConfig 是请求配置的 TS 类型
import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
// 从 Zustand 全局状态模块引入 useAuthStore，用于读写 token
import { useAuthStore } from '@/store/auth'

// ─────────── 创建 axios 实例 ───────────

// axios.create() 返回一个独立的 axios 实例（有自己的拦截器链 + 默认配置）
// 与直接使用 axios.get/post 的区别：不污染全局 axios，也不相互影响
export const apiClient = axios.create({
  // baseURL：所有请求的 URL 前缀；组件写 '/auth/login' 实际发到 '/api/auth/login'
  baseURL: '/api',
  // 超时 30s；默认值是 0（永不超时），生产环境不能用 0
  timeout: 30_000,
  // withCredentials：让浏览器发送跨域 cookie（refresh_token 用 HttpOnly cookie 保存，必须开）
  withCredentials: true,
  // Content-Type 默认 json，省得每个请求手动设
  headers: { 'Content-Type': 'application/json' },
})

// ─────────── 请求拦截器：注入 Authorization ───────────

/**
 * apiClient.interceptors.request.use(onFulfilled, onRejected)
 *
 * onFulfilled：请求被"发送前"的钩子，接收 config（请求配置对象），必须返回 config
 * onRejected：请求配置本身出错时的钩子（极少触发）
 *
 * 设计思路：
 *   - token 是动态的（登录后才有），不能写死在 axios.create() 的 headers 里
 *   - 拦截器在每次请求时实时从 store 读，永远拿到最新值
 *   - 这样组件代码完全不用管 Authorization header，写 apiClient.get('/xxx') 就够了
 */
apiClient.interceptors.request.use((config) => {
  // useAuthStore.getState() 是 Zustand 提供的"在 React 组件外读 store"的方式
  // （在组件里要用 useAuthStore((s) => s.accessToken) hook；这里是拦截器，不是组件，用 getState()）
  const token = useAuthStore.getState().accessToken

  // 有 token + 调用方没有手动设置 Authorization 时，才注入
  // 不覆盖手动设置的场景：极少见，但兜底保证调用方行为优先
  if (token && !config.headers.Authorization) {
    // Bearer Token 是 OAuth 2.0 规范的标准认证方式
    // 格式固定：Authorization: Bearer <token>（Bearer 首字母大写，token 与 Bearer 之间有一个空格）
    config.headers.Authorization = `Bearer ${token}`
  }

  // 必须返回 config，否则请求会被"吃掉"永远不发出
  return config
})

// ─────────── Promise 单例：防止并发 401 重复刷新 ───────────

/**
 * 并发 401 场景：
 *   页面一次性发了 5 个 API 请求，access_token 恰好过期 → 5 个请求全部返回 401
 *   如果每个 401 都独立触发 refresh，就会同时发 5 个 POST /auth/refresh
 *   问题：服务端通常对 refresh_token 有使用次数限制（jti），多次 refresh 会导致 token 失效
 *
 * 解决：Promise 单例模式
 *   模块级变量 _refreshing 存"当前正在飞行的 refresh Promise"
 *   第一个 401 触发 refresh，把 Promise 存到 _refreshing
 *   后续 401 看到 _refreshing 不为 null，直接 return 同一个 Promise（共享结果）
 *   refresh 结束（成功或失败），finally 把 _refreshing 重置为 null
 *
 * 为什么用模块级变量而不是 useRef/useState？
 *   拦截器不是 React 组件，没有 React 生命周期；模块级变量在整个应用生命周期内持续存在
 *
 * 类型：Promise<string | null>
 *   string：refresh 成功，返回新的 access_token
 *   null：refresh 失败（cookie 过期/被撤销）
 */
let _refreshing: Promise<string | null> | null = null

/**
 * refreshAccessTokenOnce
 *
 * 调用 /auth/refresh 端点，用 HttpOnly refresh_token cookie 换新的 access_token。
 * 内置去重：并发调用只发一个 HTTP 请求。
 *
 * @returns 新的 access_token 字符串；失败时返回 null
 */
async function refreshAccessTokenOnce(): Promise<string | null> {
  // 如果已有 refresh 在进行中，直接复用同一个 Promise（去重的核心）
  if (_refreshing) return _refreshing

  // (async () => { ... })() 是"立即执行的异步函数表达式"（IIFE），
  // 用来创建一个 async 函数并立刻调用它，得到一个 Promise
  // 这里把结果赋给 _refreshing（同步赋值），后续并发调用看到非 null 就不会重复发起
  _refreshing = (async () => {
    try {
      // ⚠️ 关键：这里用裸 axios.post 而不是 apiClient.post
      // 原因：apiClient.post 会经过响应拦截器；如果 refresh 本身返回 401，
      // 拦截器会再次尝试 refresh → 形成无限递归（stack overflow 或无限网络请求）
      // 用原始 axios 实例就可以跳过我们自定义的拦截器链
      const { data } = await axios.post<{ access_token: string; expires_in: number }>(
        '/api/auth/refresh',   // 注意：不经过 baseURL，要写完整路径
        null,                  // POST body 为空（token 在 HttpOnly cookie 里）
        {
          withCredentials: true,  // 带 cookie（refresh_token 就在这里）
          timeout: 10_000,        // refresh 比普通请求超时短（10s）：快速失败
        },
      )

      // refresh 成功：把新 token 写入 Zustand store
      // 下次请求拦截器从 store 读时，自然拿到新 token
      useAuthStore.getState().setAccessToken(data.access_token, data.expires_in)
      return data.access_token
    } catch {
      // refresh 失败：cookie 过期、被撤销、服务器宕机等
      // 返回 null，让调用方决定后续行为（跳登录页）
      return null
    } finally {
      // finally 块无论成功还是失败都会执行（类似 Java 的 try-finally）
      // 重置为 null：下次 401 来时可以重新发起 refresh
      _refreshing = null
    }
  })()

  return _refreshing
}

// ─────────── 响应拦截器：401 → refresh → retry ───────────

/**
 * apiClient.interceptors.response.use(onFulfilled, onRejected)
 *
 * onFulfilled：HTTP 2xx 的响应直接透传
 * onRejected：HTTP 4xx/5xx 或网络错误走这里
 *
 * 401 处理流程：
 *   1. 调用 refreshAccessTokenOnce() 获取新 token（并发安全）
 *   2. 成功：把新 token 注入原请求配置，用 apiClient 重试一次
 *   3. 失败：清空 store + 跳转 /login（携带 ?from= 方便登录后跳回）
 *
 * 防死循环机制：_retried 标志
 *   如果重试之后仍然 401（服务器 bug？权限问题？），不能再 refresh 一次
 *   原始请求配置上打 _retried = true，拦截器看到这个标志就直接 reject，不再 refresh
 */
apiClient.interceptors.response.use(
  // 成功响应直接透传，组件拿到的就是原始 axios 响应对象
  (resp) => resp,

  // 错误处理（async 函数，因为里面有 await refreshAccessTokenOnce()）
  async (err: AxiosError) => {
    // err.config 是触发这次错误的原始请求配置
    // AxiosRequestConfig 是 axios 内置类型；用 & { _retried?: boolean } 扩展一个自定义字段
    // TypeScript 的交叉类型（&）：合并两个类型的字段，类似"两个接口相加"
    const original = err.config as AxiosRequestConfig & { _retried?: boolean }

    // HTTP 状态码（200/401/403/500 等）；err.response 为 undefined 表示网络错误（没收到响应）
    const status = err.response?.status
    // ?. 是可选链操作符：err.response 可能为 undefined（网络超时没响应），用 ?. 避免 TypeError

    // 进入 refresh 分支的四个前提条件（全部满足才刷新）：
    //   ① status === 401：只有未授权错误才需要 refresh（403/500 不刷新）
    //   ② original !== undefined：config 有时为 undefined（极少见，防御性检查）
    //   ③ !original._retried：没重试过（防止 refresh 后再 401 死循环）
    //   ④ 不是 /auth/refresh 或 /auth/login 端点本身：
    //      /auth/refresh 401 = cookie 失效，refresh 自己不能 refresh 自己
    //      /auth/login 401 = 密码错，不该触发 refresh
    if (
      status === 401 &&
      original &&
      !original._retried &&
      !original.url?.endsWith('/auth/refresh') &&
      !original.url?.endsWith('/auth/login')
    ) {
      // 打标记：即使重试后又遇到 401，也不会再触发 refresh（只重试一次）
      original._retried = true

      // 发起（或复用已有的）refresh 请求
      const newToken = await refreshAccessTokenOnce()

      if (newToken) {
        // refresh 成功：把新 token 注入原请求的 Authorization header
        // original.headers 可能是 undefined（TS 要求防御），用 ?? {} 兜底
        original.headers = original.headers ?? {}
        // 强转为 Record<string, string> 是因为 AxiosHeaders 类型过于复杂，直接索引更简洁
        ;(original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`

        // 用 apiClient 重新发起原请求（会再次经过请求拦截器，但这里手动设了 Authorization 所以不覆盖）
        // 返回重试的 Promise，组件侧 await apiClient.get(...) 会拿到这次成功的响应
        return apiClient(original)
      }

      // refresh 也失败（null）：登录状态已彻底失效
      // 清空 Zustand store（accessToken、用户信息等全部清零）
      useAuthStore.getState().clear()

      // 把当前页面路径保存到 ?from= 参数，登录成功后可以跳回来
      // window.location.pathname = '/dashboard'，window.location.search = '?tab=settings'
      // encodeURIComponent 对特殊字符编码（如 '?' '&' '='），避免破坏 URL 结构
      const from = window.location.pathname + window.location.search
      window.location.href = `/login?from=${encodeURIComponent(from)}`

      // 仍然 reject：让上层 try/catch 或 .catch() 感知到失败（虽然页面马上跳走了）
      return Promise.reject(err)
    }

    // 以下情况直接 reject，不尝试 refresh：
    //   - 非 401 错误（403 Forbidden、500 Internal Server Error 等）
    //   - 已经重试过（_retried === true）
    //   - 是 /auth/refresh 或 /auth/login 端点本身
    return Promise.reject(err)
  },
)
