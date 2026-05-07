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
        <Outlet />
      </main>
    </div>
  )
}
