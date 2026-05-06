/**
 * src/components/chat/AssistantMessage.tsx
 *
 * AI 消息气泡（左对齐，占满宽度）。
 *
 * v1（W5）：纯文本/markdown 兜底渲染。
 * W6：替换为 <SectionRenderer> 做 6 段式结构化渲染。
 *
 * 设计文档：[[首页设计]] §5.1 + §5.2
 */
import type { Message } from '@/types/chat'

interface Props {
  message: Message
  /** 是否流式中（streamingMessage 传 true，会显示闪烁光标）。 */
  streaming?: boolean
}

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

export function AssistantMessage({ message, streaming = false }: Props) {
  const sections = message.sections ?? []
  const hasSections = sections.length > 0

  return (
    <div className="my-3 px-1">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span>🤖</span>
        <span>KE</span>
        {streaming && (
          <span className="text-primary animate-pulse">正在思考…</span>
        )}
      </div>

      {/* W5 简版：每段独立块，无 markdown 渲染（W6 接 react-markdown） */}
      {hasSections ? (
        <div className="space-y-3">
          {sections.map((s, i) => {
            const icon = SECTION_ICONS[s.type] ?? '📌'
            const title = s.title || SECTION_TITLES[s.type] || s.type
            return (
              <div key={i} className="border rounded-lg p-3 bg-card">
                <div className="font-medium text-sm mb-2">
                  {icon} {title}
                </div>
                <div className="text-sm whitespace-pre-wrap text-foreground/90">
                  {s.content}
                  {streaming && i === sections.length - 1 && (
                    <span className="ml-0.5 animate-pulse">▌</span>
                  )}
                </div>
                {s.references && s.references.length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    引用：
                    {s.references.map((r, j) => (
                      <span key={j} className="ml-1 text-primary">
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
        // 没有 sections（错误降级 / 空答案）：展示 content
        <div className="text-sm whitespace-pre-wrap">
          {message.content || (streaming ? '…' : '(空回答)')}
          {streaming && <span className="ml-0.5 animate-pulse">▌</span>}
        </div>
      )}

      {/* metadata: 新鲜度（W7 的 FreshnessBadge 会替换） */}
      {!streaming && message.metadata && (
        <div className="mt-2 text-xs text-muted-foreground">
          {message.metadata.latency_ms > 0 && `用时 ${(message.metadata.latency_ms / 1000).toFixed(1)}s`}
          {message.metadata.token_usage > 0 && ` · ${message.metadata.token_usage} tokens`}
        </div>
      )}
    </div>
  )
}
