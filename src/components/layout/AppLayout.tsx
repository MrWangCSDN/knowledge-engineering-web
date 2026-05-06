import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'

import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { useProjectStore } from '@/store/projects'

/**
 * 应用整体布局：顶栏 + 左侧导航 + 右侧路由内容（3 栏结构）。
 *
 * 顶栏（56px）：logo · 工程选择器 · 通知 · 用户菜单
 * 左栏（240-280px）：现有导航（W5 会替换为会话历史）
 * 右栏：<Outlet /> 渲染当前路由页面
 *
 * 挂载时拉工程列表（顶栏选择器需要）。
 */
export function AppLayout() {
  const fetchProjects = useProjectStore(s => s.fetchProjects)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
