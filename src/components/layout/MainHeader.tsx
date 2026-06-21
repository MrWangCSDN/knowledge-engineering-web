/**
 * src/components/layout/MainHeader.tsx
 *
 * Main 区顶部头：工程树形选择器（左）+ 用户菜单（右）。
 *
 * v2 变更（Task 13）：
 *  - 原扁平 <ProjectSwitcher /> 替换为 <GroupTreeSelector />（按 Group 分组的树）
 *  - useEffect 调用 listVisibleGroups() 拉取用户可见 Group 列表
 *  - 工程列表复用 projectStore（已有）
 *  - 工程切换后 navigate(`/project/<id>`) + 关闭下拉
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bell, ChevronDown, FolderClosed } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserMenu } from '@/components/auth/UserMenu'
import { GroupTreeSelector } from '@/components/group/GroupTreeSelector'
import { CurrentProjectStatus } from '@/components/project/CurrentProjectStatus'
import { isProjectStatusEnabled } from '@/config/features'
import { useProjectStore } from '@/store/projects'
import { listVisibleGroups } from '@/api/groups'
import type { Group } from '@/types/group'

export function MainHeader() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  // 从 projectStore 读取工程列表（已由 AppLayout 拉取）
  const projects = useProjectStore(s => s.projects)

  // 当前工程：优先 URL 中的 projectId，否则 store 的 currentProjectId
  const currentProjectId =
    projectId ?? useProjectStore.getState().currentProjectId ?? undefined

  // 当前工程名，用于触发按钮展示
  const currentProject = projects.find(p => p.id === currentProjectId)

  // Group 列表：本地 state（MainHeader 管理生命周期）
  const [groups, setGroups] = useState<Group[]>([])

  // 控制 DropdownMenu 的开关状态（受控，方便选择后自动关闭）
  const [open, setOpen] = useState(false)

  // 拉取当前用户可见的 Group 列表（挂载时一次，后续由业务需要触发）
  useEffect(() => {
    listVisibleGroups()
      .then(setGroups)
      .catch(() => {
        // 拉取失败时静默（groups 保持空数组，树仍展示孤立工程）
        setGroups([])
      })
  }, [])

  // 工程切换回调：导航 + 关闭下拉 + 同步 store
  const handleSelectProject = useCallback(
    (pid: string) => {
      useProjectStore.getState().setCurrentProject(pid)
      navigate(`/project/${pid}`)
      setOpen(false)
    },
    [navigate],
  )

  return (
    <header className="h-12 flex items-center px-3 gap-2 shrink-0">
      {/* ─── 工程树形选择器 ─── */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
            text-sm font-medium text-foreground
            hover:bg-muted transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          <FolderClosed className="h-4 w-4" />
          <span className="truncate max-w-[200px]">
            {currentProject ? currentProject.name : '选择工程'}
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </DropdownMenuTrigger>

        {/* 树形选择器内容面板 */}
        <DropdownMenuContent
          className="w-[300px] max-h-[440px] overflow-y-auto p-0"
          align="start"
        >
          <GroupTreeSelector
            groups={groups}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelect={handleSelectProject}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── 右侧操作区 ─── */}
      <div className="ml-auto flex items-center gap-1">
        {/* 当前工程状态徽章：flag 关 / 无工程 / ready 时组件自身返 null */}
        <CurrentProjectStatus project={currentProject} enabled={isProjectStatusEnabled()} />
        <button
          type="button"
          aria-label="通知"
          title="通知（v1.5 上线）"
          disabled
          className="
            p-2 rounded text-muted-foreground hover:bg-muted
            transition-colors disabled:opacity-50
          "
        >
          <Bell className="h-4 w-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
