/**
 * src/components/chat/ModelSwitcher.tsx
 *
 * 模型选择下拉（Claude Code 风简化版）— 显示在 ChatInput 右下角。
 *
 * 视觉：
 *   [Qwen-Plus · DashScope ▾]   ← 按钮态
 *   ┌──────────────────────┐    ← 点开后下拉
 *   │ ✓ Qwen-Plus  DashScope│
 *   │   MiniMax-M2 MiniMax  │
 *   └──────────────────────┘
 *
 * 数据流：
 *   - 当前选中：useAuthStore.user.preferred_model（缺省 → DEFAULT_MODEL_ID）
 *   - 点选时：updatePreferredModel API → setUser(updated_user) 同步 store
 *   - 失败：保留旧值（不乐观更新），抛 toast 由调用方处理（当前 console.error）
 *
 * 设计参考：用户截图（Claude Code 的 Models 选择器）+ Tailwind 语义 token
 */
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/auth'
import { updatePreferredModel } from '@/api/auth'
import { SUPPORTED_MODELS, DEFAULT_MODEL_ID, type ModelOption } from '@/types/auth'

export function ModelSwitcher() {
  // 从 auth store 读取当前用户的偏好模型 id
  // user 可能为 null（未登录态）：那种情况下 ChatInput 不该挂载，但仍兜底
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  // 受控开关（点选后自动关）
  const [open, setOpen] = useState(false)
  // 切换中（防双击 race）
  const [updating, setUpdating] = useState(false)

  // 派生：当前选中的 ModelOption 对象
  // user.preferred_model 可能是 null / 未知值 → fallback 到 SUPPORTED_MODELS[0]
  const currentId = user?.preferred_model || DEFAULT_MODEL_ID
  // .find 找不到返 undefined → 用 || 兜底（旧值已删除等极端场景）
  const current: ModelOption = SUPPORTED_MODELS.find(m => m.id === currentId) ?? SUPPORTED_MODELS[0]

  /** 点选某 model 项时调 API 持久化 + 同步 store */
  const handleSelect = async (m: ModelOption) => {
    setOpen(false)
    // 已选中的不发请求
    if (m.id === current.id || updating) return
    setUpdating(true)
    try {
      // PATCH /auth/me/model 返回更新后的完整 User
      const updated = await updatePreferredModel(m.id)
      // 同步到 store：authStore.setUser 会触发所有订阅 user 的组件 re-render
      setUser(updated)
    } catch (err) {
      // 失败时不修改 store；旧值保留
      console.error('[ModelSwitcher] 切换模型失败:', err)
      // 后续可加 toast；当前阶段 ergonomic 足够
    } finally {
      setUpdating(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        // disabled 时阻止 dropdown 打开（updating 期间）
        disabled={updating}
        className="
          inline-flex items-center gap-1 px-2 py-1 rounded-md
          text-[11px] text-muted-foreground hover:text-foreground
          hover:bg-muted transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {/* 当前模型 label；vendor 副标语稍淡 */}
        <span className="font-medium">{current.label}</span>
        <span className="opacity-60">· {current.vendor}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[220px] p-1"
        // sideOffset：dropdown 距 trigger 的间距；4 = tight
        sideOffset={4}
      >
        {/* 列出所有 SUPPORTED_MODELS；选中项前置 check icon */}
        {SUPPORTED_MODELS.map((m) => {
          const isActive = m.id === current.id
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => handleSelect(m)}
              className={`
                flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer
                ${isActive ? 'bg-muted' : 'hover:bg-muted'}
              `}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* check icon 占位（未选中显空白 span 保对齐） */}
                {isActive ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate font-medium">{m.label}</span>
              </div>
              {/* vendor 副标签（淡色 + 小号） */}
              <span className="text-[11px] text-muted-foreground shrink-0">{m.vendor}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
