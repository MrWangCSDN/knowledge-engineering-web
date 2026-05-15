import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { Sidebar } from '@/components/layout/Sidebar'
import { MainHeader } from '@/components/layout/MainHeader'
import { useProjectStore } from '@/store/projects'

/**
 * 应用整体布局：左右两栏。
 *
 * 不再有全局 TopBar —— 改成 ChatGPT 风格：
 *  - Sidebar 全高，自己头部放 logo + 折叠按钮
 *  - Main 全高，自己头部放工程选择器 (左) + 用户菜单 (右)
 *  - 两栏各自管自己的滚动
 *
 * 挂载时拉工程列表（Main header 选择器要用）。
 */
export function AppLayout() {
  const fetchProjects = useProjectStore(s => s.fetchProjects)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
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
    </div>
  )
}
