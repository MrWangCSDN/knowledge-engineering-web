import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'

/**
 * 应用整体布局：左侧导航 + 右侧路由内容。
 */
export function AppLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
