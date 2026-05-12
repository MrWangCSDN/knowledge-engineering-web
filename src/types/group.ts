/**
 * src/types/group.ts
 *
 * 用户组（Group）相关 TypeScript 类型定义。
 *
 * 对应后端 v2 group_models.py / group_router.py。
 * 用户组用于批量授权：把一批用户加入 Group，再把 Group 绑定到 Project，
 * 组内成员自动继承该 Project 的访问权限。
 *
 * 设计文档：[[groups-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */

// ─── Group ────────────────────────────────────────────────────────────────────

/**
 * 用户组实体（GET /groups、GET /groups/{gid} 的响应主体）。
 *
 * 字段说明：
 *   - parent_group_id：支持嵌套组（子组），null 表示顶层组
 *   - created_at：ISO 8601 格式字符串，例如 "2026-05-12T08:00:00Z"
 */
export interface Group {
  /** 组的唯一标识符（UUID 或可读 slug） */
  id: string
  /** 组显示名称，例如 "后端开发团队" */
  name: string
  /** 可选描述文字，null 表示未填写 */
  description: string | null
  /** 父组 ID，null 表示这是顶层组（无上级） */
  parent_group_id: string | null
  /** 创建时间，ISO 8601 格式字符串 */
  created_at: string
}

/**
 * 创建组的请求体（POST /groups）。
 *
 * 与 Group 的区别：
 *   - id 是必填的（由调用方提供，而非后端自动生成）
 *   - description / parent_group_id 是可选的（? 表示可省略，省略 ≠ null）
 *   - 不含 created_at（由后端填充）
 */
export interface GroupCreateRequest {
  /** 指定组 ID（业务可读，例如 'backend-team'） */
  id: string
  /** 组显示名称 */
  name: string
  /** 可选：组描述 */
  description?: string
  /** 可选：父组 ID，用于构建层级组织架构 */
  parent_group_id?: string
}

// ─── Role ─────────────────────────────────────────────────────────────────────

/**
 * RBAC 角色类型。
 *
 * 三个角色的权限从低到高：
 *   - reporter：只读，可查看资源
 *   - maintainer：可读写，可管理配置
 *   - owner：最高权限，可删除资源、管理成员
 *
 * 使用联合类型（union type）而非 enum，原因：
 *   1. 编译后不生成额外运行时代码（enum 会生成对象）
 *   2. 与后端 JSON 字符串值直接对应，无需转换
 *   3. switch/if 语句中有穷举检查支持
 */
export type Role = 'reporter' | 'maintainer' | 'owner'

// ─── GroupMember ──────────────────────────────────────────────────────────────

/**
 * 组成员信息（GET /groups/{gid}/members 的列表元素）。
 *
 * 注意：user_id 是数字（对应数据库自增主键），
 * 而 Group.id 是字符串（业务可读 slug）。两者都是唯一标识，使用场景不同。
 */
export interface GroupMember {
  /** 用户数据库主键 ID（整数） */
  user_id: number
  /** 用户名，用于 UI 展示 */
  username: string
  /** 该成员在此组中的角色 */
  role: Role
  /** 被加入组的时间，ISO 8601 格式 */
  added_at: string
}
