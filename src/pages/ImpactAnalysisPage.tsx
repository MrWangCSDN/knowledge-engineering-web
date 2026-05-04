/**
 * P-08 影响分析（占位）
 * 后续接入：impact_closure + 含/不含推断边对比 + Excel 导出
 */
export function ImpactAnalysisPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">影响分析</h1>
      <p className="text-muted-foreground">
        起点实体 + 方向 + 深度 + 是否含推断边 → 闭包表 + 类型直方图（占位）
      </p>
    </div>
  )
}
