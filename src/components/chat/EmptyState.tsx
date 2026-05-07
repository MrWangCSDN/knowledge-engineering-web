/**
 * src/components/chat/EmptyState.tsx
 *
 * 空状态：极简居中欢迎语 + 居中输入框 + 小字示例 chips。
 *
 * 视觉对标 GPT 风格 —— 整体居中，留白多，没有厚重卡片。
 *
 * 设计文档：[[首页设计]] §3.2 状态 A
 */
import type { Project } from '@/types/project'
import { ChatInput } from './ChatInput'

const SAMPLE_QUESTIONS = [
  '存款开户的设计逻辑',
  '产品工厂是怎么实现的',
  'OrderService 的调用链路',
]

interface Props {
  project: Project
  onSend: (text: string) => void
  loading?: boolean
  onAbort?: () => void
}

export function EmptyState({ project, onSend, loading, onAbort }: Props) {
  return (
    // 跟随 GPT 风格：内容靠上而不是垂直居中
    // pt-[22vh] 让欢迎语 + 输入框落在屏幕上 1/3 处
    <div className="h-full flex flex-col items-center px-4 pt-[22vh]">
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* 欢迎语：3xl + medium，跟 GPT 同档 */}
        <h1 className="text-[28px] md:text-[32px] font-medium tracking-tight text-foreground text-center mb-7 leading-tight">
          准备好了，随时问我
        </h1>

        {/* 居中输入框 */}
        <div className="w-full">
          <ChatInput
            onSend={onSend}
            loading={loading}
            onAbort={onAbort}
            placeholder={`关于 [${project.name}] 你想了解什么？`}
            large
          />
        </div>

        {/* 工程统计：极小一行（不抢眼） */}
        <p className="mt-4 text-[13px] text-muted-foreground/80 text-center">
          正在分析 <span className="font-medium text-foreground/80">{project.name}</span>
          {' · '}
          {project.stats.methods_count} 方法
          {' · '}
          解读 {project.stats.interpretation_progress}%
        </p>

        {/* 示例 chips：横向小胶囊 */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSend(q)}
              disabled={loading}
              className="
                px-3.5 py-1.5 rounded-full text-[13px]
                border bg-background
                text-foreground/70 hover:text-foreground
                hover:bg-muted hover:border-foreground/20
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
