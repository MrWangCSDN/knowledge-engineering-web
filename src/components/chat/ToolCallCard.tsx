/**
 * src/components/chat/ToolCallCard.tsx
 *
 * v1.3 ReAct 模式下，LLM 调工具时显示的卡片。
 *
 * 一对 SSE 事件：'starting' / 'complete' 共用同一张卡片（用 props.complete 切换状态）。
 *
 * UI：
 *   ┌──────────────────────────────────────┐
 *   │ 🔧 ke_callees                ⏳ 运行中 │
 *   │ entity_id: method//M1                │
 *   │ max_nodes: 5                          │
 *   └──────────────────────────────────────┘
 *
 *   complete 后：
 *   ┌──────────────────────────────────────┐
 *   │ 🔧 ke_callees                ✓ 完成   │
 *   │ entity_id: method//M1                │
 *   │ ─────────────── 展开结果 ─▾          │
 *   └──────────────────────────────────────┘
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import type { ToolCallPayload } from '@/types/chat'


interface Props {
  /** starting 事件；任何一对调用必有；用来取 name + arguments。 */
  starting: ToolCallPayload
  /** complete 事件；可选；存在 = 已完成，可展开 result_preview。 */
  complete?: ToolCallPayload
}


export function ToolCallCard({ starting, complete }: Props) {
  // 折叠 / 展开状态；默认折叠（result 内容多时不刷屏）
  const [expanded, setExpanded] = useState(false)
  const isComplete = complete !== undefined

  return (
    <div
      className="
        my-2 rounded-lg border bg-card/50
        text-[13px]
      "
    >
      {/* 头：工具名 + 状态 */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-1.5 text-foreground">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          <code className="font-mono text-[12.5px] font-medium">{starting.name}</code>
        </div>
        <div
          data-testid="tool-call-status"
          className={`text-[11.5px] font-medium ${
            isComplete
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400 animate-pulse'
          }`}
        >
          {isComplete ? '✓ 完成' : '⏳ 运行中…'}
        </div>
      </div>

      {/* arguments：始终展示（信息量小，对调试有用）*/}
      {starting.arguments && Object.keys(starting.arguments).length > 0 && (
        <div className="px-3 py-2 text-[12px] font-mono text-muted-foreground">
          {Object.entries(starting.arguments).map(([k, v]) => (
            <div key={k}>
              <span className="text-foreground/70">{k}:</span>{' '}
              <span className="text-foreground/85">{JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )}

      {/* result_preview：仅 complete 时存在，默认折叠 */}
      {isComplete && complete.result_preview && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-label={expanded ? '收起结果' : '展开结果'}
            className="
              w-full px-3 py-1.5 text-[11.5px] text-muted-foreground
              hover:bg-muted/50 transition-colors
              flex items-center gap-1 border-t border-border/40
            "
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? '收起' : '查看结果'}
          </button>
          {expanded && (
            <pre
              className="
                px-3 py-2 text-[11.5px] font-mono text-foreground/80
                whitespace-pre-wrap break-all
                bg-muted/30 max-h-60 overflow-y-auto
              "
            >
              {complete.result_preview}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
