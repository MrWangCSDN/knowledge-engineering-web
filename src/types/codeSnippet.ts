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
  code: string
  callees: CalleeRef[]
  callers: CallerRef[]
}
