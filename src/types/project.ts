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

// ─── Project Members (v2) ──────────────────────────────────────────────────────

/**
 * 工程成员角色类型（v2 RBAC）。
 *
 * 与 group.ts 中的 Role 相同的三层级，但单独定义在 project 域：
 *   - reporter：只读，可查看工程内容
 *   - maintainer：可读写，可管理工程配置
 *   - owner：最高权限，可删除工程、管理成员
 *
 * 为何不复用 group.ts 的 Role？
 *   两个域的角色含义相似但上下文不同；分开定义利于将来独立演进，
 *   同时避免循环依赖。
 */
export type ProjectMemberRole = 'reporter' | 'maintainer' | 'owner'

/**
 * 工程直接成员（直接被加入该工程的用户）。
 *
 * 来源：POST /projects/{pid}/members 直接添加，
 * 返回于 GET /projects/{pid}/members 响应的 direct 数组。
 */
export interface ProjectDirectMember {
  /** 用户数据库主键 ID */
  user_id: number
  /** 用户名，UI 展示用 */
  username: string
  /** 该成员在此工程中的直接角色 */
  role: ProjectMemberRole
  /** 被加入工程的时间，ISO 8601 格式 */
  added_at: string
}

/**
 * 工程继承成员（通过 Group 继承权限的用户）。
 *
 * 当某个 Group 被绑定到 Project 后，Group 内的所有成员
 * 自动成为 Project 的继承成员，无需逐一手动添加。
 *
 * 继承成员与直接成员的区别：
 *   - 继承成员没有 added_at（不是手动添加的）
 *   - 继承成员有 inherited_from_group_id，说明权限来源
 *   - 移除继承成员需要在 Group 层面操作，不能直接删 Project 成员
 */
export interface ProjectInheritedMember {
  /** 用户数据库主键 ID */
  user_id: number
  /** 用户名，UI 展示用 */
  username: string
  /** 继承自 Group 的角色（取 Group 中该用户的角色） */
  role: ProjectMemberRole
  /** 权限来源的 Group ID */
  inherited_from_group_id: string
}

/**
 * GET /projects/{pid}/members 的响应体。
 *
 * 将直接成员和继承成员分两个数组返回，便于前端分区展示
 * （例如：直接成员可以编辑角色/删除；继承成员只读展示）。
 */
export interface ProjectMembers {
  /** 直接加入工程的成员列表 */
  direct: ProjectDirectMember[]
  /** 通过 Group 继承权限的成员列表 */
  inherited: ProjectInheritedMember[]
}

// ─── Project ───────────────────────────────────────────────────────────────────

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
