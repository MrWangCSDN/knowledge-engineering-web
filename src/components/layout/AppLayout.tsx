import { useEffect, lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'
import { MainHeader } from '@/components/layout/MainHeader'
import { useProjectStore } from '@/store/projects'
import { useCodeViewerStore } from '@/store/codeViewer'   // 代码查看器开关：决定右侧分屏栏是否挂载

// 代码片段查看器（分屏右栏）懒加载：Monaco 体积大（~2MB），仅在用户首次打开（open=true）时下载对应 chunk。
// .then(m => ({ default: m.CodeViewerDrawer })) 把具名导出适配为 React.lazy 要求的 default 导出。
const CodeViewerDrawer = lazy(() =>
  import('@/components/code/CodeViewerDrawer').then(m => ({ default: m.CodeViewerDrawer }))
)

/**
 * 应用整体布局：左右两栏。
 *
 * 不再有全局 TopBar —— 改成 ChatGPT 风格：
 *  - Sidebar 全高，自己头部放 logo + 折叠按钮
 *  - Main 全高，自己头部放工程选择器 (左) + 用户菜单 (右)
 *  - 两栏各自管自己的滚动
 *
 * 挂载时拉工程列表（Main header 选择器要用）。
 * InfraBanner + useInfraHealthBootstrap 已提升到 App.tsx 顶层，
 * 让登录页也能看到「系统不可用」横幅（设计 §4.4 修正：覆盖未登录场景）。
 */
export function AppLayout() {
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  // 订阅代码查看器打开态：true 时在根 flex 行挂载分屏右栏（懒加载 Monaco）
  const codeViewerOpen = useCodeViewerStore(s => s.open)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <MainHeader />
        {/*
          Outlet wrapper: flex-1 让子页面占剩余高度，min-h-0 允许 flex-col 内部缩小。
          没这层包装的话，子页面（如 ChatPage）用 h-full 会等于 main 全高度
          （忽略 MainHeader 占的 48px），消息多触发 overflow 后 MainHeader 会被
          挤出屏幕看不到（bug 复现于 2026-05-15「工程切换器跟着消息滚走了」）。
        */}
        <div className="flex-1 min-h-0 flex flex-col">
          <Outlet />
        </div>
      </main>

      {/*
        代码片段查看器（分屏右栏）：作为根 flex 行的兄弟节点，与 <main> 并排。
        open=true 时挂载 → 主区(flex-1 min-w-0)自然收窄、右栏按 store.width 占位，
        中间分隔条可左右拖拽调宽度（真分屏，非 fixed 浮层）。
        组件内部返回「分隔条 + aside」两个 flex 子节点；懒加载 + 仅 open 时挂载
        → 未打开既不下载 Monaco chunk、也不占布局空间。
      */}
      {codeViewerOpen && (
        <Suspense fallback={null}>
          <CodeViewerDrawer />
        </Suspense>
      )}
    </div>
  )
}
