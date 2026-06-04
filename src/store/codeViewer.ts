// src/store/codeViewer.ts
// 代码片段查看器状态：持有当前 projectId + 打开的 tabs + 激活实体。设计 [[代码片段查看器-设计]] §5/§6。
// 设计选择：tab 即导航模型——openEntity 复用/新建 tab 并激活；点击片段内调用点 = openEntity(callee)。
import { create } from 'zustand'                          // create 是 Zustand 的核心函数，用于创建 store
import { getCodeSnippet } from '@/api/codeSnippets'       // 路径别名 @/ 指向 src/
import type { CodeSnippet } from '@/types/codeSnippet'    // 只导入类型，编译后不产生运行时代码

/** 一个已打开的实体片段 tab。snippet=null 表示加载中/失败。 */
export interface ViewerTab {
  entityId: string               // 实体持久 key，唯一标识该 tab
  snippet: CodeSnippet | null    // null = 正在加载 或 加载失败
  loading: boolean               // 是否正在请求中
  error: string | null           // 错误消息；null 表示无错误
}

// store 状态 + actions 的完整类型定义
interface CodeViewerState {
  projectId: string | null                       // 当前工程 id，由 ChatPage 注入
  open: boolean                                  // 抽屉是否打开
  tabs: ViewerTab[]                              // 已打开的所有 tab
  activeEntityId: string | null                  // 当前激活的实体 id
  setProject: (projectId: string) => void        // 设置工程上下文（ChatPage 调用）
  openEntity: (entityId: string) => Promise<void> // 打开/激活一个实体 tab
  switchTab: (entityId: string) => void          // 手动切换 tab
  closeTab: (entityId: string) => void           // 关闭单个 tab
  close: () => void                              // 收起抽屉（不销毁 tabs）
  width: number                                  // 代码面板宽度（px）：可拖拽分隔条调整 + 持久化
  setWidth: (width: number) => void              // 设置面板宽度（夹紧到 [MIN,MAX] 并写 localStorage）
}

// ── 面板宽度：常量 + 夹紧 + localStorage 持久化 ─────────────────────────────
// 分隔条拖拽调节代码查看器宽度；持久化到 localStorage，下次打开沿用上次宽度。
const WIDTH_MIN = 320                             // 最小宽度（px）：再窄 Monaco 不好用
const WIDTH_MAX = 1400                            // 最大宽度（px）：绝对上限；运行时拖拽还会按视口再夹一道
const WIDTH_DEFAULT = 560                         // 默认宽度（px）：未持久化时的初值
const WIDTH_KEY = 'ke.codeViewer.width'           // localStorage 键名

/** 把任意数值夹紧到 [WIDTH_MIN, WIDTH_MAX]；非法值（NaN/Infinity）回落默认值。 */
function clampWidth(w: number): number {
  // Number.isFinite 排除 NaN / Infinity（拖拽计算偶发非法值时兜底）
  if (!Number.isFinite(w)) return WIDTH_DEFAULT
  // Math.max(min, Math.min(max, w)) 是「夹紧」惯用法：先压上限、再托下限
  return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, w))
}

/** 从 localStorage 读上次保存的宽度；读不到 / 无 localStorage 时返回默认值。 */
function loadWidth(): number {
  // typeof window 守卫：SSR / 部分测试环境无 window，避免抛 ReferenceError
  if (typeof window === 'undefined') return WIDTH_DEFAULT
  // try/catch：隐私模式 / 禁用 localStorage 时 getItem 可能抛 SecurityError
  try {
    const raw = window.localStorage.getItem(WIDTH_KEY)   // 读字符串，可能为 null
    // 没存过（null）直接返回默认；否则转数字后夹紧（防被篡改成非法值）
    return raw == null ? WIDTH_DEFAULT : clampWidth(Number(raw))
  } catch {
    return WIDTH_DEFAULT
  }
}

/** 把宽度写入 localStorage（best-effort，失败静默忽略）。 */
function saveWidth(w: number): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WIDTH_KEY, String(w))    // localStorage 只能存字符串
  } catch {
    // 隐私模式 / 配额满：忽略，宽度仅本次会话有效
  }
}

/**
 * 从实体 id 取「文件 key」——用于 IDEA 式「一个文件一个 tab」去重。
 *
 * 设计：实体 id 形如 `com.x.AlipayServiceImpl::pay#(String)`。
 *   - split('::')[0] → 取 `::` 前的类全限定名（去掉方法名与参数签名）
 *   - split('$')[0]  → 去掉内部类后缀（`Outer$Inner` → `Outer`），归并到同一物理文件
 * 同一文件的不同方法 fileKey 相同 → 复用同一 tab（点不同方法只在该 tab 内滚动定位），
 * 不同文件 fileKey 不同 → 各自独立 tab。
 *
 * @param entityId 实体持久 key
 * @returns 文件级 key（类全限定名、去内部类后缀）
 */
export function fileKeyOf(entityId: string): string {
  const cls = entityId.split('::')[0]   // `::` 前 = 类全限定名（无 `::` 时返回原串，兜底）
  return cls.split('$')[0] || cls       // 去内部类后缀；'||' 防止极端空串
}

// create<T>((set, get) => ({...})) 是 Zustand 的 vanilla 范式（无 immer）
// set：更新 state（浅合并）；get：读取当前 state（用于 actions 内部）
export const useCodeViewerStore = create<CodeViewerState>((set, get) => ({
  // ── 初始状态 ──
  projectId: null,
  open: false,
  tabs: [],
  activeEntityId: null,
  width: loadWidth(),                            // 初始宽度：读 localStorage，无则默认 560

  // 设置工程 id，通常由 ChatPage 在 mount 时调用
  setProject: (projectId) => set({ projectId }),

  // 核心 action：打开实体 tab（IDEA 式：一个文件一个 tab）
  // async 函数返回 Promise<void>，调用方 await 可等待加载完成
  openEntity: async (entityId) => {
    const { projectId, tabs } = get()             // 读取当前状态快照
    if (!projectId) return                        // 防御：无工程上下文时不动作

    const key = fileKeyOf(entityId)               // 该实体所属文件的 key（类全限定名）
    // 找该「文件」是否已有 tab（不是按方法、而是按文件去重 → IDEA 式同文件单 tab）
    const existing = tabs.find(t => fileKeyOf(t.entityId) === key)

    if (existing) {
      // 同一方法（含加载中）再次打开 → 仅激活，不重复请求（幂等复用）
      if (existing.entityId === entityId) {
        set({ open: true, activeEntityId: entityId })
        return
      }
      // 同文件、不同方法 → 复用该 tab 并指向新方法：
      // 保留旧 snippet（同文件整文件内容相同）避免空白闪烁，仅置 loading，
      // 待重取片段拿到新方法的 start_line 后由 MonacoSnippet 重新 reveal 定位。
      set(s => ({
        open: true,
        activeEntityId: entityId,                 // 激活态切到新方法的 entityId
        tabs: s.tabs.map(t =>
          fileKeyOf(t.entityId) === key
            ? { ...t, entityId, loading: true, error: null }  // 复用同一 tab，指向新方法
            : t
        ),
      }))
    } else {
      // 新文件 → 新建 tab：先插 loading 占位，让抽屉立即可见、减少视觉空白
      // 函数式 set(s => ...) 读最新 tabs，防并发 openEntity 互相覆盖占位
      set(s => ({
        open: true,
        activeEntityId: entityId,
        tabs: [...s.tabs, { entityId, snippet: null, loading: true, error: null }],
      }))
    }

    // ── 共用拉取逻辑（新建 / 复用同文件换方法 都走这里）──
    try {
      const snippet = await getCodeSnippet(projectId, entityId)
      // set(fn) 接收函数形式：fn 拿到最新 state，防止并发竞态覆盖其他 tab
      // 按 entityId 精确匹配回填——快速连点不同方法时只有最后一次的结果命中（旧的因 entityId 已变而丢弃）
      set(s => ({
        tabs: s.tabs.map(t =>
          t.entityId === entityId ? { ...t, snippet, loading: false } : t
        ),
      }))
    } catch (e) {
      // 从 AxiosError 中提取 HTTP 状态码；类型断言为宽松结构避免 ts 报错
      const status = (e as { response?: { status?: number } })?.response?.status
      const msg = status === 404 ? '未找到该实体的源码' : '加载代码片段失败'
      set(s => ({
        tabs: s.tabs.map(t =>
          t.entityId === entityId ? { ...t, loading: false, error: msg } : t
        ),
      }))
    }
  },

  // 手动点击 tab 标签切换（不触发网络请求）
  switchTab: (entityId) => set({ activeEntityId: entityId }),

  // 关闭单个 tab，并处理激活态回退逻辑
  closeTab: (entityId) => set(s => {
    // filter 返回新数组（不修改原数组，符合 immutable 范式）
    const tabs = s.tabs.filter(t => t.entityId !== entityId)

    // 若关闭的是当前激活 tab：回退到最后一个 tab；无 tab 则置 null
    const activeEntityId = s.activeEntityId === entityId
      ? (tabs.length ? tabs[tabs.length - 1].entityId : null)
      : s.activeEntityId

    // 无 tab 剩余时自动关闭抽屉；否则保持抽屉原状
    return { tabs, activeEntityId, open: tabs.length > 0 ? s.open : false }
  }),

  // 收起抽屉（tabs 保留，重新 openEntity 时可直接复用）
  close: () => set({ open: false }),

  // 设置面板宽度：夹紧到 [WIDTH_MIN, WIDTH_MAX] 后更新 store + 持久化
  setWidth: (width) => {
    const w = clampWidth(width)                   // 夹紧（含 NaN 兜底）
    set({ width: w })                             // 更新 store（触发订阅组件重渲染）
    saveWidth(w)                                  // 写 localStorage，下次打开沿用
  },
}))
