/**
 * src/types/credential.ts
 *
 * 用户自有凭证（My Credentials）相关 TypeScript 类型定义。
 *
 * v2 新增：普通用户可以管理自己的凭证（user-scoped），
 * 与 admin.ts 中的 Credential（admin 视角）区分。
 *
 * 核心原则：
 *   - 凭证的 token（明文）只在创建时由用户提交，服务端加密存储
 *   - 所有查询接口（list/get）均不返回 token，只返回 token_hint（末4位掩码）
 *   - 这样即使 API 响应泄露，也不会暴露真实凭证
 *
 * 设计文档：[[credentials-设计]]（/Users/java/obsidian/01 Engineering/knowledge-engineering/）
 */

// ─── MyCredential ─────────────────────────────────────────────────────────────

/**
 * 用户自己的凭证（GET /credentials 的列表元素）。
 *
 * 注意 token_hint：
 *   格式类似 "****abc4"，前面若干位用 * 掩码，末尾几位明文显示，
 *   让用户可以识别是哪个 token，但不泄露完整值。
 *   null 表示后端无法生成 hint（极少见）。
 */
export interface MyCredential {
  /** 凭证唯一 ID（UUID 或业务 slug） */
  id: string
  /** 凭证显示名称，例如 "GitHub PAT - 主账号" */
  name: string
  /**
   * 凭证类型，例如 "pat"（Personal Access Token）。
   * 使用 string 而非联合类型，兼容未来新增类型（如 "ssh_key"、"oauth_token"）。
   */
  type: string
  /**
   * Token 掩码提示，格式如 "****abc4"。
   * 只用于 UI 展示，帮助用户识别凭证，不含完整 token。
   * null 表示无法生成 hint。
   */
  token_hint: string | null
  /** 凭证创建时间，ISO 8601 格式字符串 */
  created_at: string
}

// ─── CredentialCreateRequest ──────────────────────────────────────────────────

/**
 * 创建凭证请求体（POST /credentials）。
 *
 * 重要：token 字段是唯一一次提交明文 token 的机会。
 * 后端收到后会立即加密，此后查询接口不再返回明文 token。
 * 前端应确保通过 HTTPS 传输（开发/生产环境均需）。
 */
export interface CredentialCreateRequest {
  /** 凭证显示名称（用户自定义，便于识别用途） */
  name: string
  /**
   * 明文 token（如 GitHub Personal Access Token）。
   * 后端收到后会用 AES 等算法加密存储，此字段绝不持久化明文。
   * 前端在表单提交后应立即清空此值，避免 JS 内存泄露。
   */
  token: string
  /**
   * 可选：凭证类型，默认为 "pat"（Personal Access Token）。
   * ? 表示此字段可省略（undefined），省略时后端使用默认值。
   */
  type?: string
}
