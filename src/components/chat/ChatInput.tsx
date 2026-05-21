/**
 * src/components/chat/ChatInput.tsx
 *
 * 胶囊形输入框 — GPT 风格。
 *
 * 视觉：
 *  - 整体圆角胶囊（rounded-3xl），白底 + 微阴影 + 微边框
 *  - 左侧 + 按钮（v2 文件附件占位）
 *  - 中间多行 textarea（占满）
 *  - 右侧操作组：语音占位 + 发送按钮（有内容才显示，无内容时显示麦克风）
 *  - 焦点态加深阴影
 *
 * 交互：
 *  - Enter 发送；Shift+Enter 换行
 *  - 中文 IME composition 期间不触发提交
 *  - 多行自适应（最多 6 行）
 *  - loading 时按钮变 ⏸ 停止
 *
 * 设计文档：[[首页设计]] §3.8
 */
import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { ArrowUp, Plus, Square, Mic } from 'lucide-react'

import { ModelSwitcher } from './ModelSwitcher'

interface Props {
  onSend: (text: string) => void
  loading?: boolean
  onAbort?: () => void
  placeholder?: string
  /** 是否在空状态（占主区中央时为 true，会用更大的字号/padding）。 */
  large?: boolean
  /** 整体禁用（如归档 session 只读模式）。禁用时 textarea + 发送按钮全部不可用。 */
  disabled?: boolean
}

const MAX_LINES = 6
const MAX_LENGTH = 2000

export function ChatInput({
  onSend,
  loading = false,
  onAbort,
  placeholder = '有问题，尽管问',
  large = false,
  disabled = false,
}: Props) {
  const [value, setValue] = useState('')
  const [composing, setComposing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // 自适应高度
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '24', 10)
    const maxHeight = lineHeight * MAX_LINES
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  const submit = () => {
    const text = value.trim()
    if (!text || loading) return
    onSend(text)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const hasText = value.trim().length > 0

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={`
          flex items-end gap-1.5 px-3 ${large ? 'py-3' : 'py-2'}
          rounded-3xl border bg-background
          shadow-[0_2px_12px_rgba(0,0,0,0.06)]
          focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.10)]
          focus-within:border-foreground/20
          transition-shadow
        `}
      >
        {/* 左侧 + 按钮（文件附件，v2） */}
        <button
          type="button"
          aria-label="附件"
          title="附件（v1.5 上线）"
          disabled
          className="
            shrink-0 h-8 w-8 rounded-full
            text-muted-foreground hover:bg-muted disabled:opacity-50
            flex items-center justify-center
            transition-colors
          "
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* 中间 textarea */}
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={onKeyDown}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={placeholder}
          disabled={disabled || loading}
          rows={1}
          className={`
            flex-1 bg-transparent resize-none outline-none border-0
            ${large ? 'text-[16px] py-1.5 leading-6' : 'text-[15px] py-1 leading-6'}
            text-foreground
            placeholder:text-muted-foreground/70
            disabled:opacity-50
          `}
        />

        {/* 右侧操作组 */}
        <div className="shrink-0 flex items-center gap-1">
          {!hasText && !loading && (
            <button
              type="button"
              aria-label="语音输入"
              title="语音输入（v1.5 上线）"
              disabled
              className="
                h-8 w-8 rounded-full
                text-muted-foreground hover:bg-muted disabled:opacity-50
                flex items-center justify-center
                transition-colors
              "
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={loading ? onAbort : submit}
            disabled={disabled || (!loading && !hasText)}
            aria-label={loading ? '停止' : '发送'}
            className={`
              h-8 w-8 rounded-full
              flex items-center justify-center
              transition-all
              ${loading
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : hasText
                  ? 'bg-foreground text-background hover:bg-foreground/90 scale-100'
                  : 'bg-muted text-muted-foreground/50 scale-95 cursor-not-allowed'
              }
            `}
          >
            {loading
              ? <Square className="h-3 w-3 fill-current" />
              : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* 底部 footer：左 Enter 提示 + 右 ModelSwitcher（Claude Code 风布局） */}
      <div className="flex items-center justify-between mt-2 px-1">
        {/* 左侧 hint：占位用 flex-1 让 ModelSwitcher 推到最右 */}
        <p className="flex-1 text-center text-[11px] text-muted-foreground/50">
          Enter 发送 · Shift+Enter 换行
        </p>
        {/* 右侧模型切换器（绝对定位避免影响 hint 居中体感）*/}
        <ModelSwitcher />
      </div>
    </div>
  )
}
