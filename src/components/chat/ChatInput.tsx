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
// useInfraStore：基础设施健康状态；healthy=false 时禁用输入，防止用户发出无法处理的请求
// 设计：[[基础设施健康检查与产品不可用-设计]] §4.4
import { useInfraStore } from '@/store/infra'

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

  // healthy：false 时说明基础设施不可用，需要禁用输入框和发送按钮
  // 用 selector 细粒度订阅，避免不必要的 re-render
  // 设计：[[基础设施健康检查与产品不可用-设计]] §4.4
  const healthy = useInfraStore(s => s.healthy)

  // 自适应高度
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const lineHeight = parseInt(getComputedStyle(el).lineHeight || '24', 10)
    const maxHeight = lineHeight * MAX_LINES
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [value])

  // 自动聚焦：组件挂载 + loading 从 true→false（LLM 答完）后立刻 refocus
  //   场景：用户发完问题等 KE 答 → 流结束 → 光标自动回到输入框，可直接继续打字
  //   disabled 模式（归档 session）下不抢焦点（textarea 已被禁用，focus 无意义）
  //   ChatGPT 同款"输入框光标常驻"体验
  useEffect(() => {
    if (disabled) return
    if (loading) return
    // 用 requestAnimationFrame 等本轮 React render 结束 + DOM commit 后再 focus
    // 否则若 loading→idle 与 disabled 状态变化在同一 batch，focus 调用可能被覆盖
    const id = requestAnimationFrame(() => {
      ref.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [loading, disabled])

  const submit = () => {
    const text = value.trim()
    // !healthy：基础设施不可用时也阻止提交，与 button disabled 逻辑保持一致
    if (!text || loading || !healthy) return
    onSend(text)
    setValue('')
    // 发送后立即 refocus（用户可在 LLM 流式期间继续打下一句）
    // 注：此时 loading 即将变 true 触发上面 useEffect，但 disabled=true 时 textarea
    // 还是 enabled（disabled 由 loading 决定的 line 116），refocus 仍生效
    ref.current?.focus()
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
          // !healthy 时优先展示"系统不可用"提示；其余情况用调用方传入的 placeholder
          placeholder={!healthy ? '系统暂时不可用，请等待恢复…' : placeholder}
          // disabled 优先级：父组件 disabled（归档态）> 基础设施不可用 > loading 中
          disabled={disabled || !healthy || loading}
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
            // 停止按钮（loading 时）不受 healthy 限制——用户应能随时中止流式输出
            // 发送按钮：禁用条件 = 父组件 disabled | 基础设施不可用 | 无内容
            disabled={disabled || (!loading && (!hasText || !healthy))}
            aria-label={loading ? '停止生成' : '发送'}
            title={
              loading
                ? '停止生成（中断流式输出）'
                : !healthy
                  ? '系统暂时不可用'
                  : '发送（Enter）'
            }
            className={`
              h-8 w-8 rounded-full
              flex items-center justify-center
              transition-all
              ${loading
                ? 'bg-foreground text-background hover:bg-foreground/90 ring-2 ring-foreground/30 animate-pulse'
                : hasText
                  ? 'bg-foreground text-background hover:bg-foreground/90 scale-100'
                  : 'bg-muted text-muted-foreground/50 scale-95 cursor-not-allowed'
              }
            `}
          >
            {loading
              ? <Square className="h-3.5 w-3.5 fill-current" />
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
