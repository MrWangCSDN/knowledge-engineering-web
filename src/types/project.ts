/**
 * src/types/project.ts
 *
 * 工程（多工程）相关 TypeScript 类型定义。
 *
 * 对应后端 Pydantic schemas（src/service/project_models.py）。
 * 设计文档：[[首页设计]] §6.3
 */

/**
 * 工程状态枚举（4 种，详见 spec §4.3）。
 * 决定工程在选择器里的图标/颜色 + 是否可点击进入。
 */
export type ProjectStatus =
  | 'ready'      // 💚 pipeline 跑完，全部就绪
  | 'indexing'   // 🟡 pipeline 正在跑（不可选）
  | 'partial'    // 🟠 解读未完成但已有数据（可用 + banner 提示）
  | 'failed'     // 🔴 pipeline 报错（admin 可重试）

/**
 * 工程统计信息。
 * 在选择器下拉里展示"X 方法 · 解读 Y%"。
 */
export interface ProjectStats {
  methods_count: number
  classes_count: number
  /** 0-100，整型百分比。 */
  interpretation_progress: number
}

/**
 * 索引进度（仅当 status === 'indexing' 时有值）。
 * 让 admin 看到"卡在哪一步"。
 */
export interface IndexingProgress {
  /** 当前阶段：parsing / embedding / interpreting / etc. */
  phase: string
  /** 0-100。 */
  percent: number
  /** 预计还需多少秒。 */
  eta_seconds: number
}

/**
 * 工程主类型 —— 跟后端 Pydantic Project 一致。
 */
export interface Project {
  /** 业务可读 ID，如 'deposit-system'。 */
  id: string
  /** 显示名，如 '存款系统'。 */
  name: string
  status: ProjectStatus
  stats: ProjectStats
  /** ISO 8601；indexing 时为 null。 */
  pipeline_at: string | null
  /** 仅 indexing 时存在。 */
  indexing_progress?: IndexingProgress
}
