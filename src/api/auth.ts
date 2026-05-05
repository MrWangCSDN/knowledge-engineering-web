/**
 * src/api/auth.ts
 *
 * 4 个认证相关 HTTP API 的薄封装
 *
 * 这一层的职责：
 *   1. 把 endpoint 路径和方法（POST/GET）封装成 TypeScript 函数，让组件代码不直接拼 URL
 *   2. 用泛型 <T> 给响应数据加上类型，调用方拿到 data 后就有自动补全 + 类型检查
 *   3. 统一处理 withCredentials（让浏览器附带 cookie 给后端）
 *
 * 注意事项：
 *   - 这里只做"请求 → 返回 data"的转换，不处理错误（错误由 client.ts 拦截器统一处理）
 *   - 也不存 token，那是 store/auth.ts (Zustand) 的事
 *
 * 关于 async/await：
 *   - async 函数返回 Promise；async function foo() {} 等价于 function foo(): Promise<any> {}
 *   - await 只能在 async 函数里用，作用是"停下来等 Promise 完成"
 *   - const { data } = await apiClient.post(...) 先 await Promise，再用 { data } 解构响应对象
 */

import { apiClient } from '@/api/client'
import type { LoginRequest, LoginResponse, RefreshResponse, User } from '@/types/auth'

/**
 * 登录 —— 用账号密码换 access_token + refresh_token
 *
 * 后端流程：
 *   1. 校验账号 + 密码（bcrypt verify）
 *   2. 签 access_token（JWT，1h TTL）+ refresh_token（JWT，1d 或 7d TTL）
 *   3. access_token 在 response body 返回（前端存内存）
 *   4. refresh_token 通过 Set-Cookie HttpOnly 写入浏览器（前端无法读取，防 XSS）
 *
 * @param req  登录请求（用户名 + 密码 + 是否记住我）
 * @returns    LoginResponse（含 access_token + 过期秒数）
 *
 * 关于 async 和 Promise<T>：
 *   async function login(...): Promise<LoginResponse>
 *   - async：标记这是异步函数，内部可以 await；编译后返回 Promise
 *   - Promise<LoginResponse>：Promise 后面的 <...> 是泛型参数，表示 Promise 最终解决时的值类型
 *   - 调用者用 await login(...) 会得到 LoginResponse（不是 Promise）
 *
 * 关于 withCredentials: true：
 *   axios 默认 cross-origin 请求不发送 / 接收 cookies。
 *   这里因为后端的 Set-Cookie 必须能写到浏览器，所以必须开。
 *   - withCredentials: true 告诉浏览器：这个请求要带 cookie（包括跨域时）
 *   - 没有它，后端的 Set-Cookie 响应头浏览器会忽略，不写入 cookie jar
 *   - 同源请求（dev 时 vite proxy 让它看着同源）也建议显式打开，避免误解
 *
 * 关于 apiClient.post<LoginResponse>(...)：
 *   - axios 是 HTTP 库，axios.post(url, data, config) 三个参数
 *   - <LoginResponse> 是泛型参数（generic type parameter）：告诉 TypeScript 响应的 data 是什么类型
 *   - 有了它，下面 const { data } = ... 后，data.access_token 就有自动补全了
 *   - 没有泛型，data 的类型会推断成 any，失去 TS 的类型检查保护
 *
 * 关于 { data }：
 *   axios 的响应是对象 { data, status, statusText, headers, config, request }
 *   用 { data } 解构只提取 data 字段，简洁且清晰
 *   等价于：const resp = await ...; const data = resp.data; return data;
 */
export async function login(req: LoginRequest): Promise<LoginResponse> {
  // apiClient.post(url, requestBody, config)：
  //   第一个参数 '/auth/login' 是 API endpoint（相对路径，baseURL 已在 client.ts 设为 '/api'）
  //   第二个参数 req 是请求体（前端要发给后端的数据，axios 自动 JSON.stringify）
  //   第三个参数 { withCredentials: true } 是配置对象，覆盖全局配置
  const { data } = await apiClient.post<LoginResponse>('/auth/login', req, {
    // withCredentials: true 这一行很关键：
    //   - 让浏览器在这个请求中带上已有的 cookie（如果有的话）
    //   - 让浏览器接收并存储响应中的 Set-Cookie 头
    //   - 不管同源还是跨域都有效
    //   - 如果不设，Set-Cookie 响应头会被浏览器丢弃
    withCredentials: true,
  })
  // 返回响应的 data 部分，类型由泛型参数 <LoginResponse> 保证
  return data
}

/**
 * 刷新 access_token —— 用 cookie 中的 refresh_token 换新的 access_token
 *
 * 工作流程：
 *   1. 前端检测到 access_token 快过期（或已过期），调用这个函数
 *   2. 浏览器自动在请求中带上 refresh_token（它是 HttpOnly cookie，无法从 JS 读取）
 *   3. 后端验证 refresh_token，签发新的 access_token
 *   4. 新 access_token 在 response body 返回，前端存到内存或 store 中
 *
 * @returns RefreshResponse（含新的 access_token + 过期秒数）
 *
 * 关于请求体为 null：
 *   这个端点不需要请求体（不需要前端传数据给后端）。
 *   refresh_token 自动从 cookie 来（浏览器自动附带）。
 *   所以 apiClient.post(..., null, ...) 第二个参数传 null。
 *
 * 关于错误处理：
 *   如果 refresh_token 过期、无效或被删除，后端会返回 401 错。
 *   axios 会 throw error（调用方需 try/catch）。
 *   通常的做法：catch 到 error 后清空 store，跳转到 /login 页面重新登录。
 */
export async function refresh(): Promise<RefreshResponse> {
  // 第二个参数是 null（无请求体）
  const { data } = await apiClient.post<RefreshResponse>('/auth/refresh', null, {
    withCredentials: true,
  })
  return data
}

/**
 * 取当前用户信息 —— 从 access_token 解出 user_id 后查 DB
 *
 * 工作流程：
 *   1. 前端发 GET 请求到 /auth/me
 *   2. 在 Authorization 请求头中带上 access_token（格式：Authorization: Bearer <token>）
 *   3. 后端验证 token，从 token 解出 user_id，查库返回用户信息
 *   4. 前端拿到 User 对象，通常存到 zustand store 中供全应用使用
 *
 * @returns User（当前已认证用户的信息对象）
 *
 * 关于为什么不用 withCredentials：
 *   这个端点用 Bearer token（Authorization header）认证，不依赖 cookie。
 *   所以不需要 withCredentials: true。
 *   实际上，Authorization header 是由 client.ts 的请求拦截器自动注入的（见 Task 18）。
 *   流程是：
 *     store 里存的 access_token → client.ts 拦截器读它 → 自动加到 Authorization header
 *     这里不用手动写 headers，完全由拦截器处理，解耦很干净
 *
 * 关于 GET 请求：
 *   GET 请求通常不有请求体，所以 apiClient.get<User>(url) 只需一个参数
 *   vs POST：apiClient.post<T>(url, body, config) 可以有请求体
 */
export async function fetchMe(): Promise<User> {
  // apiClient.get<User>('/auth/me')：
  //   GET 请求，获取当前用户信息
  //   Authorization header 由 client.ts 拦截器自动加（不用手动传）
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}

/**
 * 登出 —— 后端清 refresh_token cookie
 *
 * 工作流程：
 *   1. 前端调用这个函数（通常在点击"登出"按钮时）
 *   2. 浏览器发 POST 请求到 /auth/logout，自动带上 refresh_token cookie
 *   3. 后端接收请求，删除或标记 refresh_token 失效（可能存到黑名单 DB 中）
 *   4. 返回成功响应（通常是 {ok: true} 或类似）
 *   5. 前端收到响应后，自己清掉内存里的 access_token（调用 store 的 clear() 方法）
 *
 * 为什么还要前端清 access_token：
 *   - refresh_token 是 HttpOnly cookie，后端删了浏览器就拿不到
 *   - access_token 是前端存的（内存或 localStorage），后端无法删除
 *   - 所以登出是"两步"：后端清 cookie，前端清 token
 *
 * @returns Promise<void>（无返回值）
 *
 * 关于 Promise<void>：
 *   后端返回的登出响应（例如 {ok: true}）前端其实不关心。
 *   所以函数签名改为 Promise<void>，表示"不关心返回值"。
 *   在 axios.post(...) 之后直接 await，不去解构 { data }。
 *
 * 关于为什么 await 但不 return：
 *   - await apiClient.post(...) 等待请求完成
 *   - 如果成功，什么都不做（Promise 解决）
 *   - 如果失败（网络错或后端 error），throw error 给调用方 catch
 *   - 不 return，所以函数隐式返回 undefined（对应 Promise<void>）
 */
export async function logout(): Promise<void> {
  // 无请求体，但仍需第二个参数位置（传 null），第三个参数是 config
  await apiClient.post('/auth/logout', null, { withCredentials: true })
  // 不 return，函数自动返回 Promise<void>
}
