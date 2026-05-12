/**
 * src/types/user.ts
 *
 * 用户（User）相关 TypeScript 类型定义。
 *
 * 包含 Admin 视角的用户管理类型（v2 新增）。
 * 普通用户视角的当前登录用户类型（User）定义在 auth.ts，
 * 两者分开是为了职责清晰：auth.ts 管认证上下文，user.ts 管用户管理。
 *
 * 设计文档：[[admin-users-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */

// ─── AdminUser ─────────────────────────────────────────────────────────────────

/**
 * Admin 视角的用户记录（GET /admin/users 的列表元素）。
 *
 * 与 auth.ts 中的 User（当前登录者自身信息）的区别：
 *   - User：当前会话登录者的信息，用于前端显示头像/菜单等
 *   - AdminUser：管理员管理所有用户时看到的用户列表条目，多了 is_active 等字段
 *
 * is_admin / is_active 的用途：
 *   - is_admin：true 表示该用户有 admin 权限（可访问 /admin/* 路由）
 *   - is_active：false 表示账号被停用（已停用的用户无法登录，但记录保留）
 */
export interface AdminUser {
  /** 用户数据库主键 ID（自增整数） */
  id: number
  /** 用户邮箱地址（后端用 Pydantic EmailStr 校验格式） */
  email: string
  /** 用户名，登录时使用的唯一标识符 */
  username: string
  /** 是否拥有管理员权限 */
  is_admin: boolean
  /** 账号是否处于激活状态（false = 被停用，无法登录） */
  is_active: boolean
  /** 账号创建时间，ISO 8601 格式字符串 */
  created_at: string
}

/**
 * 创建用户请求体（POST /admin/users）。
 *
 * 注意 password 字段：
 *   后端收到后会用 bcrypt 哈希存储，永不保存明文。
 *   前端提交后应立即清空表单，避免明文在内存中滞留。
 */
export interface AdminUserCreateRequest {
  /** 用户名（唯一，后端会校验重复） */
  username: string
  /** 用户邮箱（唯一，后端会校验格式和重复） */
  email: string
  /** 初始密码（明文，提交后端后立即哈希；此后不可读取） */
  password: string
  /** 是否赋予管理员权限，默认 false */
  is_admin?: boolean
}

/**
 * 更新用户请求体（PATCH /admin/users/{uid}）。
 *
 * 所有字段均可选（? 号），PATCH 语义：只传需要修改的字段，
 * 未传的字段后端不做修改（与 PUT 的全量覆盖语义不同）。
 */
export interface AdminUserUpdateRequest {
  /** 新邮箱地址（需唯一） */
  email?: string
  /** 是否拥有管理员权限 */
  is_admin?: boolean
  /** 是否激活账号（false = 停用） */
  is_active?: boolean
}
