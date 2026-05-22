/**
 * src/components/chat/UserMessage.tsx
 *
 * 用户消息 — 右对齐，柔和灰底胶囊。
 * 不像 AI 消息那样占满宽度。
 *
 * 2026-05-22：hover 显示「复制」按钮（ChatGPT 同款交互），
 * 点击把 message.content 拷到系统剪贴板 + 短暂"已复制"反馈。
 */
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

import type { Message } from '@/types/chat'

export function UserMessage({ message }: { message: Message }) {
  // 'idle' = 默认 / 'copied' = 短暂显示成功反馈（1.5s 后回到 idle）
  const [status, setStatus] = useState<'idle' | 'copied'>('idle')

  /** 复制 message.content 到剪贴板；失败静默（拒绝权限 / 不安全上下文等） */
  const handleCopy = async () => {
    try {
      // navigator.clipboard.writeText 是现代浏览器异步剪贴板 API
      // 在 https / localhost 上下文可用；http 公网会失败 — 全局 silent fallback
      await navigator.clipboard.writeText(message.content)
      setStatus('copied')
      // 1.5s 后切回 idle 让按钮恢复"复制"图标
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      // clipboard 拒绝 / 不可用 — 体验上不报错，用户重试或手选文本即可
    }
  }

  return (
    // group 类：让子元素能用 group-hover:* 响应父 div 的 hover 状态
    <div className="group flex justify-end my-3 flex-col items-end">
      <div className="max-w-[75%] rounded-3xl bg-muted px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>

      {/* hover 时浮现的"复制"按钮 — 默认 opacity-0 不占视觉，hover 整组显示 */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="复制消息"
        title={status === 'copied' ? '已复制 ✓' : '复制消息'}
        className="
          mt-1 flex items-center gap-1 px-2 py-1 rounded-md
          text-xs text-muted-foreground hover:text-foreground hover:bg-muted
          opacity-0 group-hover:opacity-100 transition-opacity
          focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        {status === 'copied' ? (
          <>
            <Check className="h-3 w-3" />
            <span>已复制</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            <span>复制</span>
          </>
        )}
      </button>
    </div>
  )
}
