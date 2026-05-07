/**
 * src/components/chat/AssistantMessage.tsx
 *
 * AI 消息 — 平铺式（无厚重边框卡片），左对齐。
 * 段落之间用空行分隔；段标题用小字号灰色 prefix。
 *
 * v1（W5）：纯文本渲染。
 * W6：替换为 SectionRenderer + react-markdown 做 6 段式结构化渲染。
 */
import type { Message } from '@/types/chat'

const SECTION_ICONS: Record<string, string> = {
  overview: '📋',
  entry_point: '🚪',
  call_chain: '🔀',
  db_ops: '💾',
  rules: '⚠️',
  sources: '🔗',
}

const SECTION_TITLES: Record<string, string> = {
  overview: '业务概述',
  entry_point: '入口方法',
  call_chain: '调用链路',
  db_ops: '数据库操作',
  rules: '关键约束',
  sources: '引用源',
}

interface Props {
  message: Message
  streaming?: boolean
}

export function AssistantMessage({ message, streaming = false }: Props) {
  const sections = message.sections ?? []
  const hasSections = sections.length > 0

  return (
    <div className="my-6 group">
      {/* 头：极小角标 + 思考状态 */}
      <div className="flex items-center gap-1.5 mb-2 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-semibold">
          K
        </span>
        <span className="font-medium">KE</span>
        {streaming && <span className="ml-1 animate-pulse">正在思考…</span>}
      </div>

      {/* 内容区：无 border + 平铺 */}
      {hasSections ? (
        <div className="space-y-5 text-[15px] leading-[1.7]">
          {sections.map((s, i) => {
            const icon = SECTION_ICONS[s.type] ?? '📌'
            const title = s.title || SECTION_TITLES[s.type] || s.type
            return (
              <div key={i}>
                <h3 className="font-semibold text-[15px] mb-1.5 text-foreground">
                  {icon} {title}
                </h3>
                <div className="whitespace-pre-wrap text-foreground/85">
                  {s.content}
                  {streaming && i === sections.length - 1 && (
                    <span className="ml-0.5 animate-pulse">▌</span>
                  )}
                </div>
                {s.references && s.references.length > 0 && (
                  <div className="mt-2 text-[12.5px] text-muted-foreground">
                    {s.references.map((r, j) => (
                      <span key={j} className="mr-2 underline-offset-2 hover:underline cursor-pointer">
                        {r.display_text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-[15px] leading-[1.7] whitespace-pre-wrap text-foreground/85">
          {message.content || (streaming ? '…' : '(空回答)')}
          {streaming && <span className="ml-0.5 animate-pulse">▌</span>}
        </div>
      )}

      {/* metadata：极淡的小字 */}
      {!streaming && message.metadata && (message.metadata.latency_ms > 0 || message.metadata.token_usage > 0) && (
        <div className="mt-3 text-[11px] text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
          {message.metadata.latency_ms > 0 && `${(message.metadata.latency_ms / 1000).toFixed(1)}s`}
          {message.metadata.token_usage > 0 && ` · ${message.metadata.token_usage} tokens`}
        </div>
      )}
    </div>
  )
}
