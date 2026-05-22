/**
 * src/components/chat/MessageList.tsx
 *
 * 消息列表 — 渲染历史消息 + 流式中的消息。
 * 自动滚动到底部（新消息进来时）。
 */
import { useEffect, useRef } from 'react'

import type { Message } from '@/types/chat'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

interface Props {
  messages: Message[]
  streaming?: Message | null
  /** v1.5：传 projectId 让 AssistantMessage 显示"导出 Word"按钮。 */
  projectId?: string
}

export function MessageList({ messages, streaming, projectId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // 新消息或流式 token 来时自动滚动到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streaming?.sections?.length, streaming?.sections?.at(-1)?.content])

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 w-full">
      {messages.map((m, idx) => {
        // 2026-05-21 关键修：后端 S6 改造后 message id=null（fs 文件名即 msg_id 但未透传到响应）；
        // 多条 m.id=null 会让 React `key={m.id}` 冲突 → 行为 undefined，常见现象就是
        // 主区"明明有 messages 但只渲染少数 / 完全不显示"。
        // 兜底：id 缺失时用 `${role}-${created_at}-${idx}` 拼 stable key（同一轮 render
        // 内 idx + created_at 保证唯一；跨 render 也稳定 — 因为 messages 数组顺序由
        // 后端 created_at + role tie-break 升序保证）。
        const key = m.id ?? `${m.role}-${m.created_at ?? ''}-${idx}`
        return m.role === 'user'
          ? <UserMessage key={key} message={m} />
          : <AssistantMessage key={key} message={m} projectId={projectId} />
      })}
      {streaming && <AssistantMessage message={streaming} streaming projectId={projectId} />}
      <div ref={bottomRef} />
    </div>
  )
}
