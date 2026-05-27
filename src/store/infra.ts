/**
 * src/store/infra.ts
 *
 * useInfraStore：基础设施健康状态 zustand store。
 * 设计：[[基础设施健康检查与产品不可用-设计]] §4.1
 *
 * 触发条件（→ set healthy）：
 *  1. App mount 时 useInfraHealthBootstrap → fetchHealth()
 *  2. axios interceptor 抓 503 INFRA_UNHEALTHY → markUnhealthy()
 *  3. SSE error 抓 503 INFRA_UNHEALTHY → markUnhealthy()
 *  4. 用户点 "重试连接" → fetchHealth()
 */

// create 是 Zustand 的核心工厂函数，用来创建一个全局 store
// 与 React useState 不同，Zustand store 不需要 Provider 包裹，任意组件都可直接导入使用
import { create } from 'zustand'

// apiClient 是项目统一的 axios 实例（baseURL='/api'），附带认证拦截器
import { apiClient } from '@/api/client'

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 单个依赖的健康状态（与后端 DepStatus 对齐）。
 *
 * TypeScript interface：只描述"形状"，不产生任何运行时代码。
 * 编译后 interface 会被完全移除，只留下 JS 对象。
 */
export interface DepStatus {
  /** 是否健康。 */
  ok: boolean
  /** 不健康时的错误摘要（后端裁剪过，不含堆栈）。 */
  error?: string  // ? 表示可选字段，即 ok=true 时可以没有 error
}

/**
 * 5 个 critical 依赖的整体状态（admin 才看得到）。
 *
 * 字段名与后端 /health 返回的 deps key 保持一致，方便直接映射。
 */
export interface InfraDeps {
  mysql: DepStatus
  neo4j: DepStatus
  weaviate: DepStatus
  dashscope: DepStatus
  ollama: DepStatus
}

/**
 * InfraState：store 的完整"形状" —— state 字段 + action 方法。
 *
 * Zustand 惯例：state 和 action 写在同一个 interface 里，
 * 不像 Redux 那样 state / reducers / actions 分开定义。
 */
interface InfraState {
  /** 总体健康状态；初值 true（乐观，避免 fetch 前阻断 UI）。 */
  healthy: boolean

  /**
   * 5 个依赖详情，admin 用户才有；普通用户为 undefined。
   * InfraDeps | undefined 写法：| 是 TypeScript 联合类型（union type）符号
   */
  deps?: InfraDeps

  /**
   * 最后一次检查的时间戳（Date.now() 毫秒数），用于横幅显示"最后检查 14:23"。
   * null 表示还没检查过（初始态）。
   */
  lastCheck: number | null

  /** fetch 进行中标志，用于"重试"按钮 disabled 状态。 */
  fetching: boolean

  /**
   * 主动检查健康：调 /health endpoint，更新状态。
   * 返回 Promise<void>：void 表示调用方不需要关心返回值。
   */
  fetchHealth: () => Promise<void>

  /**
   * 被动标记不健康（catch 到 503 INFRA_UNHEALTHY 后立即调用）。
   * _reason 参数暂时不持久化到 store，但方便后续接 Sentry / 埋点。
   */
  markUnhealthy: (reason: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store 实例
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useInfraStore：全局基础设施健康 store。
 *
 * 用法（在 React 组件里）：
 *   const healthy = useInfraStore(s => s.healthy)        // 只订阅 healthy 字段
 *   const fetchHealth = useInfraStore(s => s.fetchHealth) // 只取 action 引用
 *
 * 用法（在组件外，如 axios interceptor）：
 *   useInfraStore.getState().markUnhealthy('503 from /api/chat')
 *
 * create<InfraState> 的泛型参数告诉 TypeScript store 的形状，获得完整类型推断。
 */
export const useInfraStore = create<InfraState>((set) => ({
  // ─── 初始 state ────────────────────────────────────────────────────────────

  // 初值 true（乐观假设）：防止 App 刚挂载时、首次 fetchHealth 完成前就显示错误横幅
  healthy: true,

  // deps 初值为 undefined：admin 检查后才有值，普通用户永远 undefined
  deps: undefined,

  // null 表示"从未检查过"，与 0（1970 epoch）语义更清晰
  lastCheck: null,

  // fetch 初值 false；开始 fetch 立刻置 true，完成/失败后置 false
  fetching: false,

  // ─── actions ───────────────────────────────────────────────────────────────

  /**
   * fetchHealth：调后端 /health，把结果写入 store。
   *
   * async/await 是 ES2017 语法，让异步代码写起来像同步代码：
   *   - await 会暂停当前函数，等 Promise resolve 后继续
   *   - try/catch 捕获 reject（网络错误、超时等）
   */
  fetchHealth: async () => {
    // 开始 fetch 前把 fetching 置 true，让 UI 显示加载态
    // set() 是 Zustand 提供的状态更新函数，类似 React 的 setState
    // 传入一个对象会做 shallow merge（浅合并），只更新指定字段
    set({ fetching: true })

    try {
      // apiClient.get('/health') 实际请求路径：
      //   开发环境：Vite proxy /api/health → http://localhost:8000/health
      //   生产环境：nginx /api/health → :8000/health
      // axios 把响应体放在 r.data 里
      const r = await apiClient.get('/health')

      // 后端返回格式：{ healthy: bool, ts: iso, deps?: {...} }
      // r.data.deps 普通用户时不存在（undefined），admin 时有完整的 InfraDeps 对象
      set({
        healthy: r.data.healthy,
        deps: r.data.deps,          // undefined → store 里也是 undefined，符合预期
        lastCheck: Date.now(),      // Date.now() 返回当前 Unix 毫秒时间戳（number 类型）
        fetching: false,
      })
    } catch (_e) {
      // /health 自身失败 = 后端完全连不上（TCP 超时 / DNS 失败 / nginx 挂了）
      // 此时等同于 unhealthy，直接 set healthy=false
      // _e 前缀 _ 是惯例：表示"我知道这个变量存在但不用它"，避免 TS 报 unused variable
      set({ healthy: false, lastCheck: Date.now(), fetching: false })
    }
  },

  /**
   * markUnhealthy：被动标记，由拦截器 / SSE 错误路径调用。
   *
   * 设计上不调 /health（避免循环：503 → fetchHealth → 又 503 → …），
   * 直接把 healthy 置 false 让横幅立刻出现。
   *
   * _reason 参数暂未持久化，可后续扩展为 store 字段供 UI 展示。
   */
  markUnhealthy: (_reason: string) => {
    set({ healthy: false, lastCheck: Date.now() })
  },
}))
