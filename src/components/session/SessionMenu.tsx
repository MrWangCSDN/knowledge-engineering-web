/**
 * src/components/session/SessionMenu.tsx
 *
 * Session 行 hover 出现的「⋯」下拉菜单，含「归档」+「删除」两项。
 *
 * 复用项目已有的 dropdown-menu primitive（基于 @radix-ui/react-dropdown-menu）。
 *
 * 设计：[[会话归档-设计]] §8.1。
 */
import { MoreHorizontal, Archive, Trash2, Pencil } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface Props {
  onArchive: () => void
  onDelete: () => void
  onRename: () => void
}

export function SessionMenu({ onArchive, onDelete, onRename }: Props) {
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
      <DropdownMenuContent
        align="end"
        className="w-32"
        // 关键修复（2026-05-16）：阻止 radix 关菜单时把焦点归还 trigger 按钮。
        // 否则「重命名」后 SessionItem 刚 mount 的 <input autoFocus> 会被
        // radix focus-scope 立刻抢走焦点 → input.onBlur → 立即退出编辑
        // → 用户「无法修改」。preventDefault 后焦点不回 trigger，
        // 归档/删除不受影响（归档跳走、删除开 ConfirmDialog 自管焦点）。
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuItem
          onSelect={() => {
            // 重命名：不 preventDefault —— 让 radix 正常关闭菜单并释放
            // focus-scope，随后 SessionItem 的 inline <input autoFocus>
            // 才能拿到并保住焦点（否则菜单仍开着会立刻把焦点抢回，
            // 触发 input.onBlur → 编辑态被关掉）。trigger 按钮自身
            // 已 stopPropagation，菜单关闭回焦不会触发外层导航。
            onRename()
          }}
          className="cursor-pointer"
        >
          <Pencil className="h-4 w-4 mr-2" />
          <span>重命名</span>
        </DropdownMenuItem>
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
          onSelect={() => {
            // 2026-05-22 修：不 preventDefault — 让 Radix Dropdown 正常关闭。
            // bug: 之前 e.preventDefault() 让 dropdown 保留 open 状态，
            //      用户点 ConfirmDialog 的"删除"按钮时，Radix 把 click 当成
            //      "outside-click 关菜单" 吞掉 → 用户感觉要点两次才删除。
            // focus 跳走的副作用已由 onCloseAutoFocus={e.preventDefault()}（line 52）防住。
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
