/** agent 推理灰字（仿 Claude）：流式中展开实时显示，done 后折叠成可点开的小条。 */
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

export function ThinkingBlock({ thinking, streaming }: { thinking?: string; streaming: boolean }) {
  // 流式中默认展开；done 后默认折叠
  const [open, setOpen] = useState(streaming)
  if (!thinking) return null
  // streaming 中始终展开（跟随实时输出）
  const expanded = streaming || open
  return (
    <div className="mb-3 text-[13px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 hover:text-foreground/80 transition-colors"
        aria-label="思考过程"
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span>思考过程{streaming ? '…' : ''}</span>
      </button>
      {expanded && (
        <div className="mt-1 pl-4 border-l-2 border-muted whitespace-pre-wrap leading-[1.6]">
          {thinking}
        </div>
      )}
    </div>
  )
}
