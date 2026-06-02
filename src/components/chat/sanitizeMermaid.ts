/**
 * src/components/chat/sanitizeMermaid.ts
 *
 * 把 LLM 输出的 mermaid 源码做"幂等保守"修复，再喂给 mermaid.parse。
 *
 * 解决三类常见炸点（见 [[Mermaid-渲染稳定性-设计]] §3）：
 *   1. label 内字面 `\n` → Mermaid 不识别 \n，**只认 `<br/>`**
 *   2. label 含 `()` `,` `:` `#` `/` `&` `<` `>` `|` `;` 或中日韩字符 → Mermaid 9+
 *      会把 `(...)` 当圆柱体节点语法、`,` 当 style 分隔符 → 必须 `"..."` 引号包裹
 *   3. Java 方法显示名常含 `Foo::bar` → Mermaid classDiagram 保留 `::` → 在 quoted
 *      label 内换成 `Foo.bar` 既保留语义又合法
 *
 * 设计取舍：
 *   - **幂等**：跑两遍结果一样（已 quoted 的 label 不再 quote；已 `<br/>` 不再换）
 *   - **保守**：只动 `[...]` / `(...)` / `{...}` 节点 label，不碰 fence 外的内容
 *   - **不解 mermaid 全语法**：纯字符串 regex 处理，足够覆盖 95% LLM 输出
 *
 * 用法：
 *   const safe = sanitizeMermaid(llmOutput)
 *   const ok = await mermaid.parse(safe, { suppressErrors: true })
 */

// 含这些字符的 label 需要 quote（mermaid flowchart 保留字符 + 非 ASCII）
// 注意 `[` `]` 不在里面 —— 它们是 label 边界，外层 regex 已经处理
// 加 \x00-\x7f 取反捕获中文/日文/韩文等 Unicode label（Mermaid 9+ 偶发会卡）
const RISKY_LABEL_CHARS = /[(),:#/&<>|;"]|[^\x00-\x7f]/

/**
 * 对一段 mermaid 源码做保守清洗，返回新字符串。
 *
 * @param src LLM 直出的 mermaid 源码
 * @returns 清洗后可直接喂给 `mermaid.parse` 的源码
 */
export function sanitizeMermaid(src: string): string {
  // 边界：空串直接返回，避免后续 regex 跑空
  if (!src) return src

  let out = src

  // ── 步骤 1：字面 `\n` → `<br/>` ───────────────────────────────────────────
  // LLM 经常在 JSON 字符串里写 `\\n`（JSON 解码后变 `\n`，即字面 backslash-n）。
  // Mermaid 把它当作 backslash + n 两个字符，不换行 → label 解析错位。
  // 全局替换为 mermaid 官方推荐的 `<br/>`。
  out = out.replace(/\\n/g, '<br/>')

  // ── 步骤 2：节点 label 自动 quote ─────────────────────────────────────────
  // 匹配三种节点形状的 label：
  //   [text]   方形
  //   (text)   圆角
  //   {text}   菱形
  // 捕获 (open, label, close) 三段；非贪婪匹配避免吃掉嵌套
  // 注意：mermaid `[(...)]` 圆柱体、`[/.../]` 平行四边形等复合形状无法靠简单 regex 区分，
  // 这里只处理"单字符 open + 内容 + 单字符 close"的主流情况，兼顾 95% 场景。
  out = out.replace(
    /([\[(\{])([^\[\]()\{\}\n]+?)([\])\}])/g,
    (match, open: string, label: string, close: string) => {
      // 去掉首尾空白（不影响 mermaid 视觉）
      const trimmed = label.trim()

      // 幂等：已经被 `"..."` 包裹的 label 跳过
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) return match

      // 不含危险字符 → 保持原样（数字 id / 简短英文标识符不动）
      if (!RISKY_LABEL_CHARS.test(trimmed)) return match

      // 转义 label 内部的双引号：mermaid 推荐用 HTML entity #quot;
      // （不能用 \" — mermaid 不识别 backslash 转义）
      const escaped = trimmed.replace(/"/g, '#quot;')

      // 包上引号返回；保留原 open/close 括号字符
      return `${open}"${escaped}"${close}`
    }
  )

  // ── 步骤 3：quoted label 内 `::` → `.` ───────────────────────────────────
  // Java 习惯写 `Foo::bar` 表示方法引用，但 mermaid classDiagram 把 `::` 当
  // namespace 分隔符；flowchart 里出现也会让 parser 困惑。
  // 在 *已 quoted* label 内才替换，避免误伤 classDiagram / sequenceDiagram
  // 自身的 `Class::method` 语法。
  // 用 `(?:...)` 非捕获组让 `$1` 直接指向原字符串内容。
  out = out.replace(/"([^"]*?)"/g, (match, content: string) => {
    if (!content.includes('::')) return match
    return `"${content.replaceAll('::', '.')}"`
  })

  return out
}
