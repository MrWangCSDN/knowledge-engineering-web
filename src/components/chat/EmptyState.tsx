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
// Link：react-router-dom 声明式链接组件，避免整页刷新
import { Link } from 'react-router-dom'
// feature flag：工程状态指示总开关；关时本组件除"措辞修复"外完全等于现状
import { isProjectStatusEnabled } from '@/config/features'
// gating 纯函数：决定是否禁用提问 + 禁用占位文案
import { isQAGated, gatedPlaceholder } from '@/lib/projectGating'
// IndexingProgress：索引进度状态机屏（屏5），仅 indexing 状态下展示
import { IndexingProgress } from '@/components/connect/IndexingProgress'

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
  // flag 关时 flagOn=false → gated 永远 false → 行为完全等于现状（除措辞修复）
  const flagOn = isProjectStatusEnabled()
  // gated：仅 flag 开 + 状态为 indexing/failed 时禁用提问
  const gated = flagOn && isQAGated(project.status)

  return (
    // 跟随 GPT 风格：内容靠上而不是垂直居中
    // pt-[22vh] 让欢迎语 + 输入框落在屏幕上 1/3 处
    <div className="h-full flex flex-col items-center px-4 pt-[22vh]">
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* 欢迎语：3xl + medium，跟 GPT 同档；gated 时改提示"暂未就绪" */}
        <h1 className="text-[28px] md:text-[32px] font-medium tracking-tight text-foreground text-center mb-7 leading-tight">
          {gated ? `[${project.name}] 暂未就绪` : '准备好了，随时问我'}
        </h1>

        {/* 居中输入框 */}
        <div className="w-full">
          <ChatInput
            onSend={onSend}
            loading={loading}
            onAbort={onAbort}
            disabled={gated}
            placeholder={
              gated
                ? gatedPlaceholder(project.status)
                : `关于 [${project.name}] 你想了解什么？`
            }
            large
          />
        </div>

        {/* 索引进度屏：flag 开 + status=indexing 时显示，取代/置于统计行上方。
            project.id 用于轮询 getIndexStatus；ready 时不显示（维持现有行为）。
            IndexingProgress 内部自己轮询，EmptyState 只负责决定是否渲染。 */}
        {flagOn && project.status === 'indexing' && (
          <div className="w-full mt-4">
            <IndexingProgress projectId={project.id} />
          </div>
        )}

        {/* 工程统计：极小一行（不抢眼）。
            措辞修复：删掉无条件的"正在分析"与"解读 X%"后缀（后者在 backend 填真值前恒为脏 0%、有误导）；
            解读进度仅在 flag 开 + partial 时作为失真警示显示 */}
        <p className="mt-4 text-[13px] text-muted-foreground/80 text-center">
          <span className="font-medium text-foreground/80">{project.name}</span>
          {' · '}
          {project.stats.methods_count} 方法
        </p>

        {/* 低调小链接：引导用户连接更多仓库。
            text-muted-foreground/60 确保不抢眼（辅助信息），
            hover:text-muted-foreground 悬停时略微加深，token 化、light+dark 均可读。 */}
        <p className="mt-1.5 text-[12px] text-center">
          <Link
            to="/settings/connections"
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            连接更多仓库 →
          </Link>
        </p>

        {/* partial 失真警示：仅 flag 开 + 解读未完成时显示，橙色提醒回答可能不完整。
            使用 --color-status-progress token（index.css 中 light=#oklch(0.75 0.15 85) /
            dark=oklch(0.82 0.14 85)），与 IndexingProgress 的 --color-status-done 用法一致，
            不硬编码 text-orange-600 / dark:text-orange-400 裸色值。 */}
        {flagOn && project.status === 'partial' && (
          <p className="mt-1 text-[13px] text-[color:var(--color-status-progress)] text-center">
            解读 {project.stats.interpretation_progress}%（进行中，回答可能不完整）
          </p>
        )}

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
