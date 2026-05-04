/**
 * P-03 全局检索（占位）
 * 后续接入：name + vectordb-code + vectordb-interpret + vectordb-business + lexical_rerank
 */
export function SearchPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">全局检索</h1>
      <p className="text-muted-foreground">
        名称 / 代码语义 / 业务问句三种模式（占位，待接入 FastAPI 路由）
      </p>
    </div>
  )
}
