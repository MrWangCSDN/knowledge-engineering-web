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
      {messages.map(m =>
        m.role === 'user'
          ? <UserMessage key={m.id} message={m} />
          : <AssistantMessage key={m.id} message={m} projectId={projectId} />,
      )}
      {streaming && <AssistantMessage message={streaming} streaming projectId={projectId} />}
      <div ref={bottomRef} />
    </div>
  )
}
