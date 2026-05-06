/**
 * src/components/chat/ChatInput.tsx
 *
 * 底部输入框：
 *   - Enter 发送，Shift+Enter 换行
 *   - 中文 IME composition 期间不触发提交
 *   - 多行自适应（最多 6 行，超出滚动）
 *   - disabled / loading 状态时按钮变样（W5 加 ⏸ 停止）
 *
 * 设计文档：[[首页设计]] §3.8
 */
import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  /** 等答案中：disabled + 按钮变 ⏸（v1 仅显示，停止逻辑 W5 接 abort）。 */
  loading?: boolean
  onAbort?: () => void
  placeholder?: string
}

const MAX_LINES = 6
const MAX_LENGTH = 2000

export function ChatInput({
  onSend,
  loading = false,
  onAbort,
  placeholder = '输入你的问题...',
}: Props) {
  const [value, setValue] = useState('')
  const [composing, setComposing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // 自适应高度：根据内容自动调整 rows
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10)
    const maxHeight = lineHeight * MAX_LINES + 24  // padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  const submit = () => {
    const text = value.trim()
    if (!text || loading) return
    onSend(text)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文输入法 composing 期间 Enter 是确认候选词，不触发提交
    if (composing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const charCount = value.length

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex gap-2 items-end">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={onKeyDown}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={placeholder}
          disabled={loading}
          rows={1}
          className="
            flex-1 px-3 py-2.5 border rounded-lg resize-none
            bg-background text-sm
            disabled:opacity-50
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
            placeholder:text-muted-foreground
          "
        />
        <button
          type="button"
          onClick={loading ? onAbort : submit}
          disabled={!loading && !value.trim()}
          aria-label={loading ? '停止' : '发送'}
          className="
            shrink-0 h-10 w-10 rounded-lg
            bg-primary text-primary-foreground
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:bg-primary/90 transition-colors
            flex items-center justify-center
          "
        >
          {loading ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
      <div className="flex justify-between items-center mt-1 px-1">
        <span className="text-xs text-muted-foreground">
          Enter 发送，Shift+Enter 换行
        </span>
        {charCount > 0 && (
          <span className={`text-xs ${charCount > MAX_LENGTH * 0.9 ? 'text-orange-500' : 'text-muted-foreground'}`}>
            {charCount}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  )
}
