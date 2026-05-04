import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

/**
 * P-01 项目首页 / 当前快照概览（占位实现）
 * 后续接入：聚合 stats + 4 个 Weaviate collection 计数 + 健康检查徽标
 */
export function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">代码知识工程</h1>
        <p className="mt-2 text-muted-foreground">
          代码 → 结构 → 语义 → 知识 → 解读 → 可解释检索
        </p>
      </header>

      {/* 大搜索框 —— 直通 P-03 */}
      <section
        onClick={() => navigate('/search')}
        className="group cursor-pointer rounded-lg border bg-card p-6 transition-colors hover:bg-accent/30"
      >
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
          <span className="text-muted-foreground">
            搜索方法 / 类 / 业务问题…
          </span>
        </div>
      </section>

      {/* 状态徽标占位 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">系统状态</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="节点数" value="—" />
          <StatCard label="边数" value="—" />
          <StatCard label="技术解读覆盖率" value="—" />
          <StatCard label="业务解读覆盖率" value="—" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">依赖状态</h2>
        <div className="flex flex-wrap gap-2">
          <Badge label="KnowledgeGraph" status="unknown" />
          <Badge label="Neo4j" status="unknown" />
          <Badge label="Weaviate" status="unknown" />
          <Badge label="Ollama" status="unknown" />
          <Badge label="OpenAI" status="unknown" />
          <Badge label="OWL" status="unknown" />
        </div>
      </section>

      <section className="flex gap-2">
        <Button onClick={() => navigate('/search')}>开始检索</Button>
        <Button variant="outline" onClick={() => navigate('/impact')}>
          影响分析
        </Button>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

type BadgeStatus = 'ok' | 'warn' | 'error' | 'unknown'

function Badge({ label, status }: { label: string; status: BadgeStatus }) {
  const colorMap: Record<BadgeStatus, string> = {
    ok: 'bg-green-500/15 text-green-600 dark:text-green-400',
    warn: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    error: 'bg-destructive/15 text-destructive',
    unknown: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colorMap[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
