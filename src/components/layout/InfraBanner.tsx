/**
 * InfraBanner：基础设施不可用时顶部固定红色横幅 + 重试按钮。
 * 设计：[[基础设施健康检查与产品不可用-设计]] §4.3
 *
 * 主题适配（用户 CLAUDE.md 强制 light+dark 双主题）：
 *  - 用 bg-destructive / text-destructive-foreground CSS token
 *  - 不写硬编码颜色
 *  - dark 主题下背景会自动从 light 的深红切到亮一档（按 token 定义）
 */
import { useInfraStore } from '@/store/infra'

export function InfraBanner() {
  // 用 selector 让组件只在相关字段变化时 re-render
  const healthy = useInfraStore(s => s.healthy)
  const fetching = useInfraStore(s => s.fetching)
  const lastCheck = useInfraStore(s => s.lastCheck)
  const fetchHealth = useInfraStore(s => s.fetchHealth)

  // healthy → 横幅不显示
  if (healthy) return null

  return (
    <div
      role="alert"
      className="
        sticky top-0 z-50
        bg-destructive text-destructive-foreground
        px-4 py-2
        flex items-center justify-between gap-3
        text-sm
        shadow-sm
      "
    >
      <div className="flex items-center gap-2">
        <span className="font-medium">系统暂时不可用，请联系管理员</span>
        {lastCheck != null && (
          <span className="text-xs opacity-80">
            最后检查 {new Date(lastCheck).toLocaleTimeString()}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void fetchHealth()}
        disabled={fetching}
        className="
          px-3 py-1 rounded
          bg-destructive-foreground/10 hover:bg-destructive-foreground/20
          transition disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {fetching ? '检查中…' : '重试连接'}
      </button>
    </div>
  )
}
