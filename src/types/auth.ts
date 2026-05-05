/**
 * src/types/auth.ts
 *
 * 认证模块的 TypeScript 类型定义
 *
 * 本文件定义了与登录、用户、令牌相关的所有 TypeScript 接口和类型。
 * 这些类型与后端 Pydantic schemas 一一对应，确保前后端数据结构一致。
 *
 * 关于类型系统：
 *   - TypeScript 是 JavaScript 的超集，编译为 JS 前会先做静态类型检查
 *   - 类型检查让开发者在编译期而非运行时发现错误（例如"传错参数类型"）
 *   - interface / type 都用来定义自定义类型；区别见下文注释
 */

/**
 * User —— 已登录用户的信息对象
 *
 * 对应后端 src/service/auth_schemas.py::MeResponse，
 * 通常由 GET /auth/me 端点返回，代表当前已认证用户的数据。
 *
 * interface vs type 的选择：
 *   - interface 用于描述"对象的形状"（结构化数据）、类、或可扩展的约定
 *   - type 用于定义 union（联合） | primitive（原始类型）| 字面量
 *   - 这里是对象形状，所以用 interface
 *   - interface 还支持 declaration merging（声明合并），便于在多个地方扩展定义
 *
 * 字段类型说明：
 *   - 后端 Pydantic int/str/bool → TS 的 number/string/boolean
 *   - 后端 EmailStr 验证由 Pydantic 做，TS 里就是普通 string（没有原生 email 类型）
 *   - 后端 datetime → TS string (ISO 8601 格式)；要转本地时间用 new Date(created_at)
 */
export interface User {
  // 用户 ID —— 数据库自增主键，唯一标识这个用户
  id: number

  // 邮箱地址 —— 后端用 Pydantic EmailStr 校验了格式
  // 前端只需存储，不再校验；实际格式检查由后端保证
  email: string

  // 用户名 —— 登录时使用的唯一用户名，前端作为显示名或帐户识别用
  username: string

  // 是否管理员 —— 布尔值，决定前端是否显示管理员菜单/功能
  // TS 中用 boolean（不是 Boolean，大写是对象包装类不常用）
  is_admin: boolean

  // 账户创建时间 —— ISO 8601 格式字符串
  // 例如 "2026-05-04T12:34:56" 或 "2026-05-04T12:34:56Z"（含时区）
  // 前端显示时通常需转换：new Date("2026-05-04T12:34:56").toLocaleString()
  created_at: string
}

/**
 * LoginRequest —— 登录请求的请求体
 *
 * 对应后端 src/service/auth_schemas.py::LoginRequest，
 * 前端调用 POST /auth/login 时的 request body 结构。
 *
 * 字段说明：
 *   - username 和 password：后端 Pydantic 有长度与格式限制（见后端代码）
 *   - remember_me：可选的"记住我"标志，决定令牌过期时间或存储策略
 */
export interface LoginRequest {
  // 用户名 —— 用户在注册时设定的唯一标识符
  // 后端会校验长度，通常 3-20 字符
  username: string

  // 密码 —— 用户输入的密码
  // 后端接收后会用 bcrypt 或类似算法哈希比对，永不存储明文
  // 前端传输时建议走 HTTPS，浏览器会自动加密
  password: string

  // 记住我标志 —— 布尔值，用户勾选"记住我"时为 true
  // 后端根据这个值决定 refresh token 的有效期（通常是否无限期）
  // true: 签发长期 token（例如 30 天）
  // false: 签发短期 token（例如 1 小时）
  remember_me: boolean
}

/**
 * LoginResponse —— 登录成功的响应体
 *
 * 对应后端 src/service/auth_schemas.py::LoginResponse，
 * POST /auth/login 成功时（HTTP 200）返回的结构。
 *
 * token_type 的说明：
 *   - "bearer" 是 OAuth 2.0 标准，前端在后续请求头中使用格式：
 *     Authorization: Bearer {access_token}
 *   - TS 中用字符串字面量类型 'bearer'（不是普通 string）
 *   - 字符串字面量类型只接受这个确切值，拼错了编译会报错（类型安全）
 *   - 例如：token_type: 'Bearer'（大写 B）会被 TS 编译器标记为类型错误
 */
export interface LoginResponse {
  // 访问令牌 —— JWT（JSON Web Token）字符串
  // 前端存储在内存或 localStorage，随后所有 API 请求都要在 Authorization 头中带它
  // 格式：Authorization: Bearer <access_token>
  access_token: string

  // 令牌类型 —— 字符串字面量类型，必须是这个确切的值 'bearer'
  // 字符串字面量类型 ('bearer') 比 string 更严格：
  //   - string 接受任何字符串值
  //   - 'bearer' 只接受这个精确值，防止拼错
  // 这是 TS 特性，有助于编译时发现错误
  token_type: 'bearer'

  // 令牌有效期 —— 整数，单位为秒
  // 例如 3600 表示 1 小时（60 * 60），7200 表示 2 小时
  // 前端可用 Date.now() + (expires_in * 1000) 计算过期时刻的毫秒级时间戳
  expires_in: number
}

/**
 * RefreshResponse —— 刷新令牌（refresh token）后的响应体
 *
 * 对应后端 src/service/auth_schemas.py::RefreshResponse，
 * POST /auth/refresh 成功时（HTTP 200）返回的结构。
 *
 * 当 access_token 过期时，前端调用 /auth/refresh 端点用 refresh_token 换新的 access_token。
 * 这个响应就是返回新的 access_token 和其有效期。
 */
export interface RefreshResponse {
  // 新的访问令牌 —— 用 refresh_token 换来的新 JWT
  // 格式与原 access_token 相同
  access_token: string

  // 新令牌的有效期 —— 整数，单位为秒
  expires_in: number
}

/**
 * LoginPhase —— 登录页面的状态机
 *
 * union 类型的用途：
 *   在 TS 中，union 类型 (A | B | C) 用来表示"这个值必须是这些选项之一"。
 *   常用来实现状态机、枚举类型等受限的取值范围。
 *   优势：
 *     - 编译期穷举检查：switch(phase) 漏一个 case TS 编译器会报错
 *     - 不生成运行时代码：纯类型，编译后消失，无性能开销
 *   vs enum：union 更简洁，不会在运行时生成对象
 *
 * 状态含义与转移流程：
 *   idle
 *     → 用户还未点击"登录"按钮
 *     → 表现：输入框无禁用，按钮可点
 *
 *   validating
 *     → 用户点击"登录"后，请求正在飞行中（未收到响应）
 *     → 表现：输入框禁用，按钮禁用 + 转圈加载动画，防止重复提交
 *
 *   success
 *     → 登录成功，服务器返回 access_token
 *     → 表现：通常短暂显示，立即调用 navigate() 跳转到首页
 *
 *   error_invalid
 *     → 用户名或密码错误（HTTP 401 Unauthorized）
 *     → 表现：显示"用户名或密码不正确"红色提示，输入框恢复可编辑
 *
 *   error_locked
 *     → 账号被锁定，例如因为多次登录失败（HTTP 423 Locked）
 *     → 表现：显示"账号已锁定，请稍后再试"或"请联系管理员"，输入框禁用
 *
 *   error_network
 *     → 网络错误：请求未能发出、超时、网络中断等（无 HTTP 响应）
 *     → 表现：显示"网络连接失败"提示，建议重试
 *
 *   error_server
 *     → 服务器内部错误（HTTP 5xx：500 Internal Server Error、502 Bad Gateway 等）
 *     → 表现：显示"服务器错误，请稍后重试"
 *
 *   error_rate_limit
 *     → 请求过频，触发了后端的速率限制（HTTP 429 Too Many Requests）
 *     → 表现：显示"请求过频，请稍后再试"，可能禁用一段时间
 *
 * 实现建议：
 *   在 React 组件中用 useState 管理状态，根据不同 phase 值渲染不同 UI
 *   例如：
 *     const [phase, setPhase] = useState<LoginPhase>('idle')
 *     if (phase === 'validating') 显示加载中
 *     if (phase === 'error_invalid') 显示错误提示
 */
export type LoginPhase =
  | 'idle'              // 初始状态，用户未操作
  | 'validating'        // 请求飞行中，等待服务器响应
  | 'success'           // 登录成功，短暂状态（立即跳页）
  | 'error_invalid'     // 401：用户名或密码错
  | 'error_locked'      // 423：账号被锁定
  | 'error_network'     // 网络错误（无响应）
  | 'error_server'      // 5xx：服务器内部错误
  | 'error_rate_limit'  // 429：请求过频
