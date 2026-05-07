/**
 * src/components/chat/UserMessage.tsx
 *
 * 用户消息 — 右对齐，柔和灰底胶囊。
 * 不像 AI 消息那样占满宽度。
 */
import type { Message } from '@/types/chat'

export function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end my-3">
      <div className="max-w-[75%] rounded-3xl bg-muted px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}
