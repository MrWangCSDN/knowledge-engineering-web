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
}

// create<T>((set, get) => ({...})) 是 Zustand 的 vanilla 范式（无 immer）
// set：更新 state（浅合并）；get：读取当前 state（用于 actions 内部）
export const useCodeViewerStore = create<CodeViewerState>((set, get) => ({
  // ── 初始状态 ──
  projectId: null,
  open: false,
  tabs: [],
  activeEntityId: null,

  // 设置工程 id，通常由 ChatPage 在 mount 时调用
  setProject: (projectId) => set({ projectId }),

  // 核心 action：打开实体 tab
  // async 函数返回 Promise<void>，调用方 await 可等待加载完成
  openEntity: async (entityId) => {
    const { projectId, tabs } = get()             // 读取当前状态快照
    if (!projectId) return                        // 防御：无工程上下文时不动作

    // 已有该 tab → 直接激活 + 打开抽屉，不重复请求（幂等复用）
    if (tabs.some(t => t.entityId === entityId)) {
      set({ open: true, activeEntityId: entityId })
      return
    }

    // 新 tab：先插 loading 占位，让抽屉立即可见、减少视觉空白
    // 用函数式 set(s => ...) 读最新 tabs，与下方 try/catch 一致——严格防并发 openEntity 互相覆盖占位
    set(s => ({
      open: true,
      activeEntityId: entityId,
      tabs: [...s.tabs, { entityId, snippet: null, loading: true, error: null }],
    }))

    try {
      const snippet = await getCodeSnippet(projectId, entityId)
      // set(fn) 接收函数形式：fn 拿到最新 state，防止并发竞态覆盖其他 tab
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
}))
