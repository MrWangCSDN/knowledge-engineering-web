/**
 * P-09 方法 ↔ 表映射（占位）
 * 后续接入：MethodTableAccessService 双向追溯
 */
export function MethodTablePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">方法 ↔ 表映射</h1>
      <p className="text-muted-foreground">
        方法查表（read/write 分组 + SQL 片段）/ 表查方法（含上游入口）（占位）
      </p>
    </div>
  )
}
