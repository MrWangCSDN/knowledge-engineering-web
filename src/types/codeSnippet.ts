// src/types/codeSnippet.ts
// 代码片段查看器：后端 GET /code-snippet 的响应类型。设计 [[代码片段查看器-设计]] §3。

/** 调用点（callee）：方法体内一次方法调用 + 其位置。line/col 可能为 null。 */
export interface CalleeRef {
  entity_id: string          // 目标方法的持久 key（可回传 openEntity 实现跳转）
  name: string               // 目标方法短名（用于装饰范围 + 展示）
  line: number | null        // 调用点所在**文件绝对行**（1-indexed）；null 表示无行号
  col: number | null         // 调用点列号（**0-indexed**）；null 表示无列号
}

/** 调用者（caller）：谁调用了当前实体（反向导航，无位置）。 */
export interface CallerRef {
  entity_id: string
  name: string
}

/** GET /code-snippet 的完整响应。 */
export interface CodeSnippet {
  entity_id: string
  qualified_name: string
  kind: string
  file_path: string
  language: string
  start_line: number
  end_line: number
  /**
   * 方法**片段**源码（start_line ~ end_line 范围）。
   * 作为整文件视角的 fallback：超大文件 / 文件读不到时前端会回退显示这个字段。
   */
  code: string
  /**
   * v1.13（2026-06-02）：整个**文件**源码（如果可读且 < 200KB）。
   * 前端优先用 file_content 渲染整文件 + revealLineInCenter(start_line) 滚到方法 + decoration 高亮方法范围。
   * 为 null 时表示：超大文件 / 文件读不到 / 权限不足 → 前端 fallback 到 code 字段（方法片段）。
   */
  file_content: string | null
  /**
   * v1.13：源文件字节数。即使 file_content 为 null 也会返回（让前端展示"超大文件 X KB"提示）。
   */
  file_size_bytes: number
  callees: CalleeRef[]
  callers: CallerRef[]
}
