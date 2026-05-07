/**
 * src/components/project/ProjectSwitcher.tsx
 *
 * 顶栏的工程选择器（核心组件）。
 *
 * 功能：
 *  - 收起态显示当前工程名 `📁 <name> ▼`
 *  - 展开下拉显示所有工程（含状态徽章 + 统计）
 *  - 点击切换 → navigate(`/project/<id>`)
 *  - indexing / failed 状态不可选
 *
 * 设计文档：[[首页设计]] §4
 */
import { ChevronDown, FolderClosed } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/store/projects'
import { ProjectStatusBadge } from './ProjectStatusBadge'

export function ProjectSwitcher() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const projects = useProjectStore(s => s.projects)
  // 优先用 URL 里的 projectId；否则 fall back 到 store 的 currentProjectId 或第一项
  const current =
    projects.find(p => p.id === projectId) ??
    projects.find(p => p.id === useProjectStore.getState().currentProjectId) ??
    projects[0]

  // 工程列表为空：占位
  if (!current) {
    return (
      <button className="text-sm text-muted-foreground px-3 py-2 inline-flex items-center gap-1">
        <FolderClosed className="h-4 w-4" />
        选择工程
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
          text-[15px] font-medium text-foreground hover:bg-muted transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        <FolderClosed className="h-[18px] w-[18px]" />
        <span className="truncate max-w-[200px]">{current.name}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[360px]" align="start">
        {projects.map(p => {
          const disabled = p.status === 'indexing' || p.status === 'failed'
          const isCurrent = p.id === current.id
          return (
            <DropdownMenuItem
              key={p.id}
              disabled={disabled}
              onSelect={() => navigate(`/project/${p.id}`)}
              className="flex flex-col items-start gap-1 py-2 cursor-pointer data-[disabled]:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 w-full">
                {isCurrent && <span className="text-primary">✓</span>}
                <span className="font-medium">{p.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {p.stats.methods_count} 方法 · 解读 {p.stats.interpretation_progress}%
              </div>
              <ProjectStatusBadge
                status={p.status}
                progress={p.indexing_progress?.percent}
              />
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          + 添加新工程（管理员请用 CLI）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
