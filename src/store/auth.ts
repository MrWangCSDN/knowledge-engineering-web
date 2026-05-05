/**
 * src/store/auth.ts
 *
 * 认证状态全局 store —— 用 Zustand 管理 access_token / user 状态
 *
 * 为什么用 Zustand 而不是 Redux？
 *   - Zustand 不需要 Provider / dispatch / reducers 这些 boilerplate（样板代码），
 *     几行代码就能起一个全局 store
 *   - 通过 hook 直接读 + 写状态：const token = useAuthStore(s => s.accessToken)
 *   - 适合中小型项目；大型项目（多人多模块）用 Redux Toolkit 也行
 *   - bundle size（打包体积）更小：Zustand ~1KB，Redux Toolkit ~10KB+
 *
 * 关键设计决策（敏感性分类）：
 *
 *   1. accessToken（敏感）—— 仅内存
 *      - 不存 localStorage / sessionStorage / cookie（任何持久化都扩大 XSS 攻击面）
 *      - 恶意脚本注入后可 document.cookie / localStorage.getItem 读到持久化的 token
 *      - 内存中的变量无法被外部 JS 读到，关闭 tab 即清空
 *      - 代价：刷新页面 access_token 丢失，但 RequireAuth（Task 20）会用
 *        refresh_token cookie 静默续期，用户感知不到
 *
 *   2. user 信息（不敏感）—— 持久化到 sessionStorage
 *      - 持久化原因：刷新页面时不闪一下"未登录"状态（UX 更流畅）
 *      - 即使被盗读也只是用户名 / email，不影响安全边界
 *      - sessionStorage 比 localStorage 安全——关闭浏览器自动清空
 *
 *   3. refresh_token —— 不存 store，存在 HttpOnly Cookie 里
 *      - 后端 set-cookie 时带 HttpOnly flag，JS 代码完全无法读取（防 XSS）
 *      - 浏览器在请求 /auth/refresh 时自动附带（withCredentials: true）
 *      - 这是 OAuth 2.0 的标准最佳实践
 */

// create：Zustand 最核心的工厂函数，用来创建 store
// persist：中间件，把 store 里的指定字段序列化写入浏览器存储；页面加载时反序列化读回来
// createJSONStorage：让我们选择用哪个存储后端（localStorage 还是 sessionStorage）
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 只导入类型（import type），运行时不生成任何 JS 代码
// type-only import 是 TypeScript 特有的语法，编译后会被完全移除
import type { User } from '@/types/auth'

// ─────────────────────────────────────────────────────────────────────────────
// State 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AuthState —— 描述这个 store 的"形状"（state + actions）
 *
 * Zustand 的惯例是把 state 字段和 action（方法）定义在同一个 interface 里。
 * 这样 TypeScript 就知道 store 里有哪些字段和方法，提供完整的类型检查。
 *
 * interface 和 type 的选择：
 *   - interface：描述对象形状，可扩展（declaration merging）
 *   - type：描述 union / primitive / 字面量等更复杂的类型组合
 *   - 这里用 interface 因为它是纯对象结构描述
 */
interface AuthState {
  // ─── 状态字段（state fields）─────────────────────────────────────────────

  /**
   * 当前 access_token（JWT 字符串）
   *   null = 未登录，或 token 已失效（刷新页面后初始值也是 null）
   *   这个字段被 partialize 排除，绝不写入浏览器存储
   */
  accessToken: string | null

  /**
   * access_token 过期时间（毫秒时间戳）
   *   用 Date.now() 的格式（毫秒），方便和 Date.now() 直接比较大小
   *   null = 还没设置（未登录状态）
   *   同样被 partialize 排除，仅存内存
   */
  accessTokenExpiresAt: number | null

  /**
   * 当前登录用户的基本信息（来自 GET /auth/me 或登录响应）
   *   null = 未登录
   *   这个字段会通过 persist 写入 sessionStorage，刷新页面后自动恢复
   */
  user: User | null

  // ─── Actions（修改 state 的方法）─────────────────────────────────────────

  /**
   * 保存新拿到的 access_token，同时根据过期秒数计算过期时间戳
   * @param token        JWT 字符串（后端 login / refresh 接口返回的 access_token）
   * @param expiresInSec token 有效期，单位：秒（后端 LoginResponse.expires_in）
   */
  setAccessToken: (token: string, expiresInSec: number) => void

  /**
   * 保存用户信息（登录成功后调用 fetchMe() 拿到数据再调这个）
   * @param user  User 对象，或 null（清空用户信息时传 null）
   */
  setUser: (user: User | null) => void

  /**
   * 清空所有认证状态（登出时调用）
   * 将 accessToken / accessTokenExpiresAt / user 全部重置为 null
   */
  clear: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store 创建
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useAuthStore —— 导出的 Zustand store hook
 *
 * 用法（在 React 组件里）：
 *   // 读某个字段（推荐用 selector 避免不必要的重渲染）
 *   const token = useAuthStore(s => s.accessToken)
 *   const user  = useAuthStore(s => s.user)
 *
 *   // 读 action
 *   const setUser = useAuthStore(s => s.setUser)
 *
 * 用法（在非组件代码里，如拦截器 / 工具函数）：
 *   useAuthStore.getState().setAccessToken(token, 3600)
 *   const user = useAuthStore.getState().user
 *
 * 为什么用 selector (s => s.x) 而不是直接 useAuthStore()？
 *   - 不用 selector：每次 store 里任意字段变化，组件都重渲染（浪费）
 *   - 用 selector：React 只在 s => s.x 返回值变化时才触发重渲染（精准）
 *
 * create<AuthState>()()  ——  双括号解释：
 *   - 第一层括号 create<AuthState>()：把泛型传给 create，让 TS 知道 state 的类型
 *   - 第二层括号 (persist(...))：把中间件工厂函数传给 create，实际创建 store
 *   - 这是 Zustand v4 的 curried（柯里化）写法，是为了让 TypeScript 泛型推导更好用
 */
export const useAuthStore = create<AuthState>()(
  // persist 中间件：让 store 的指定部分自动读写浏览器存储
  // 第一个参数是"store creator 函数"；第二个参数是 persist 的配置
  persist(
    // store creator 函数：接收 set 和 get，返回初始 state 对象
    // set：更新 state 的函数，Zustand 会做浅合并（shallow merge）
    //   传入 partial 对象：set({ user: newUser }) 只更新 user，其他字段不变
    //   传入函数：set(prev => ({ count: prev.count + 1 })) 可以读旧 state 再更新
    // get：读取当前 state（这里暂时用不到，占位符可省略）
    (set) => ({
      // ─── 初始 state ──────────────────────────────────────────────────────
      // persist 中间件会在 store 初始化后，把 sessionStorage 里的数据覆盖到
      // 被 partialize 包含的字段（即 user）；accessToken 相关字段不受影响

      // access_token：初始为 null，页面刷新后不会从 storage 恢复（设计如此）
      accessToken: null,

      // 过期时间戳：初始为 null，随 accessToken 一起更新
      accessTokenExpiresAt: null,

      // user：初始为 null，但 persist 会从 sessionStorage 读回上次存的值
      user: null,

      // ─── Actions ─────────────────────────────────────────────────────────

      // setAccessToken：保存 access_token 和它的过期时间
      // 参数 token 是 JWT 字符串；expiresInSec 是过期秒数（后端 LoginResponse.expires_in）
      setAccessToken: (token, expiresInSec) =>
        // set() 接受 partial state 对象，Zustand 做浅合并
        set({
          accessToken: token,
          // Date.now() 返回当前时刻的毫秒时间戳
          // + expiresInSec * 1000：把秒数转成毫秒，加到当前时间上，得到过期时刻
          // 例如：现在是 1000000ms，expiresInSec = 3600（1h）
          //       过期时刻 = 1000000 + 3600 * 1000 = 4600000ms
          accessTokenExpiresAt: Date.now() + expiresInSec * 1000,
        }),

      // setUser：更新用户信息（登录成功后调用，登出时传 null）
      // (user) => set({ user }) 是 (user) => set({ user: user }) 的简写
      // 这是 ES6 的"属性名简写"语法：当键名和变量名相同时可以只写一次
      setUser: (user) => set({ user }),

      // clear：登出时一键清空所有认证状态
      // 把三个字段都重置为 null；persist 也会把 sessionStorage 里的 user 清掉
      clear: () =>
        set({
          accessToken: null,
          accessTokenExpiresAt: null,
          user: null,
        }),
    }),

    // ─── persist 配置对象 ───────────────────────────────────────────────────
    {
      // name：写入浏览器存储的 key 名（整个 store 序列化为一个 JSON 字符串存在这个 key 下）
      // 前缀 'ke-' 和 theme store 保持一致（ke = knowledge-engineering）
      name: 'ke-auth-user',

      // storage：选择使用哪种浏览器存储
      //   createJSONStorage(() => sessionStorage)：
      //     - createJSONStorage 是 Zustand 提供的帮助函数，把任意 Storage 对象包成
      //       Zustand 期望的 { getItem, setItem, removeItem } 格式，同时处理 JSON 序列化
      //     - () => sessionStorage 是一个"惰性求值"的工厂函数（lazy getter）
      //       之所以用函数而不是直接写 sessionStorage，是因为 SSR 环境（Next.js 等）
      //       下 sessionStorage 在服务端不存在，用函数可以延迟到客户端执行时才访问
      //     - sessionStorage vs localStorage：
      //       sessionStorage：关闭 tab / 浏览器自动清空（更安全，生命周期短）
      //       localStorage：永久保存，除非手动 clear（方便，但泄露风险更高）
      storage: createJSONStorage(() => sessionStorage),

      // partialize：决定哪些字段被持久化（写入浏览器存储）
      //   接受一个函数，参数是完整 state，返回"要持久化的部分"
      //   ⚠️ 关键安全规则：accessToken / accessTokenExpiresAt 必须排除在外！
      //     - 任何持久化都让 XSS 攻击脚本有机会读到 token
      //     - 只有 user（不含密码等敏感字段）才适合持久化
      //   (s) => ({ user: s.user }) 返回一个只含 user 的对象
      //   TS 类型：partialize 期望 (state: AuthState) => Partial<AuthState>
      partialize: (s) => ({ user: s.user }),
    },
  ),
)

// ─────────────────────────────────────────────────────────────────────────────
// 独立工具函数
// ─────────────────────────────────────────────────────────────────────────────

/**
 * accessTokenIsValid —— 判断当前内存中的 access_token 是否还有效
 *
 * 为什么需要这个函数？
 *   JWT 有过期时间（expires_in），在 token 过期时继续发请求会得到 401 错误。
 *   提前检测 + 刷新（silent refresh），可以在 token 过期前悄悄换新的，用户无感知。
 *
 * 为什么要提前 60 秒视为过期（proactive expiry buffer）？
 *   假设 token 还有 5 秒过期，前端发出请求，经过网络传输到达后端时已过期，
 *   后端返回 401，前端再去 refresh，这一来一回额外增加了延迟和错误处理的复杂度。
 *   提前 60 秒 buffer：前端看到"还有不到 60 秒过期"就主动换新 token，
 *   确保 token 在整个请求生命周期内都有效。
 *
 * 注意：这是普通函数（不是 React hook），可以在任何地方调用：
 *   - axios 拦截器（非组件代码）
 *   - 组件外的工具函数
 *   - 其他 store 的 action 中
 *   读的是"调用时刻"的 store 快照（getState()），不会订阅更新。
 *
 * @returns boolean —— true = token 还有效（剩余有效期 > 60 秒），false = 需要刷新
 */
export function accessTokenIsValid(): boolean {
  // useAuthStore.getState()：读取当前 store 状态的快照，不订阅后续变化
  // 这是 Zustand 在组件外部读 store 的标准方法
  const s = useAuthStore.getState()

  // 任一字段为 null = 未登录或 token 从未设置，直接判无效
  if (!s.accessToken || !s.accessTokenExpiresAt) return false

  // s.accessTokenExpiresAt - Date.now()：距离过期还剩多少毫秒
  // 60_000 = 60000 毫秒 = 60 秒
  // 数字字面量分隔符（Numeric Separator）：TS/JS 里可以用 _ 分隔数字，只是视觉辅助
  // 60_000 和 60000 在运行时完全相同，_  不影响值，提高可读性（尤其是大数字）
  // 剩余时间 > 60 秒 = 还有效；否则视为即将过期，需要刷新
  return s.accessTokenExpiresAt - Date.now() > 60_000
}
