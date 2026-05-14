/**
 * src/components/session/SessionMenu.tsx
 *
 * Session 行 hover 出现的「⋯」下拉菜单，含「归档」+「删除」两项。
 *
 * 复用项目已有的 dropdown-menu primitive（基于 @radix-ui/react-dropdown-menu）。
 *
 * 设计：[[会话归档-设计]] §8.1。
 */
import { MoreHorizontal, Archive, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface Props {
  onArchive: () => void
  onDelete: () => void
}

export function SessionMenu({ onArchive, onDelete }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="更多操作"
          onClick={(e) => e.stopPropagation()}  // 阻止触发外层 session 点击导航
          className="
            p-1 rounded text-muted-foreground
            opacity-0 group-hover:opacity-100
            hover:bg-muted hover:text-foreground
            transition-opacity transition-colors
            focus:opacity-100
          "
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          onSelect={(e) => {
            // 阻止 radix 默认关闭后还把焦点带出（避免触发外层 onClick）
            e.preventDefault()
            onArchive()
          }}
          className="cursor-pointer"
        >
          <Archive className="h-4 w-4 mr-2" />
          <span>归档</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onDelete()
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          <span>删除</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
