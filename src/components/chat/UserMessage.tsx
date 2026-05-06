/**
 * src/components/chat/UserMessage.tsx
 *
 * 用户消息气泡（右对齐）。
 *
 * 设计文档：[[首页设计]] §5.1
 */
import type { Message } from '@/types/chat'

export function UserMessage({ message }: { message: Message }) {
  return (
    <div className="flex justify-end my-3">
      <div className="max-w-[70%] rounded-xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2 text-sm">
        {message.content}
      </div>
    </div>
  )
}
