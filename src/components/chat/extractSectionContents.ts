/**
 * src/components/chat/extractSectionContents.ts
 *
 * 从流式 raw_stream（可能是半截 JSON）中实时提取 section.content 字符串数组。
 *
 * 为什么不用 JSON.parse：流式过程中 JSON 不完整，标准 parse 会抛错。
 * 这里用宽松正则匹配 `"content"\s*:\s*"<value>"` —— 只要 value 闭合双引号了就算"完整的一段"。
 *
 * 限制：
 *   - content 内可能含转义字符 \" \n \\，需要正确处理（regex 用懒匹配 + 解释转义）
 *   - 不严格校验 JSON 结构（性能 + 容错优先）
 */


// 这个正则的关键设计：
//   "content"        ← 字面匹配字段名
//   \s*:\s*          ← 冒号前后允许空格
//   "                ← 起始引号
//   ((?:\\.|[^"\\])*)  ← 捕获组：要么是任意转义字符 \\. 要么是非"非\的字符；尽可能多
//   "                ← 结束引号（**没有 ?，所以必须出现，未闭合就不匹配**）
// `/g` 全局：找所有匹配
//
// 注意：`/.../g` 的 lastIndex 状态在 exec 循环里很重要，所以每次新调用都重置
const CONTENT_RE = /"content"\s*:\s*"((?:\\.|[^"\\])*)"/g

/**
 * 把 JSON 字符串里的转义序列解还原成实际字符。
 * 我们只 cover JSON 标准的几个常见 escape：\n \r \t \\ \" \/。
 */
function unescapeJsonString(s: string): string {
  return s.replace(/\\(.)/g, (_, c) => {
    switch (c) {
      case 'n': return '\n'
      case 'r': return '\r'
      case 't': return '\t'
      case 'b': return '\b'
      case 'f': return '\f'
      case '"': return '"'
      case '\\': return '\\'
      case '/': return '/'
      default: return c  // 其它情况保留原字符（容错）
    }
  })
}


/**
 * 防御性 safeguard：如果一段 content 里出现了奇数个 ``` fence 标记，
 * 说明 LLM 在这段里开了 fence 但忘了闭合（或被截断），自动补一个 ``` 收尾。
 *
 * 为什么必须做：调用方会把多段 content 用 `\n\n---\n\n` join 起来传给 ReactMarkdown，
 * 如果某段 fence 没闭合，分隔符 `---` 会被当成 fence 内的源码渲染，
 * 整段往下的 markdown 全部破坏（表格 / 标题 / 列表全失效）。
 *
 * 算法：数 ``` 出现次数；奇数补一行 ``` 到末尾。
 * （不识别"行内的三反引号" —— 几乎不会有人在文档里写三个 backtick；权衡过容错收益足够）
 */
function ensureClosedFences(s: string): string {
  // matchAll 比 match(/.../g).length 更显式，且对空字符串安全
  const fences = s.match(/```/g)
  if (fences && fences.length % 2 !== 0) {
    // 末尾不一定有换行，补 \n``` 保证 fence 单独成行被 remark-gfm 识别
    return s + '\n```'
  }
  return s
}


/**
 * 提取流式 raw_stream 里所有"已完整"的 section.content。
 *
 * @param raw 流式累积的原始文本（可能含 ```json fence + 半截 JSON）
 * @returns 已抽出的 content 数组；顺序与 LLM 输出一致
 */
export function extractSectionContents(raw: string): string[] {
  // 没出现 ```json 标志说明还没开始 JSON 输出
  // 严格要求 fence 让"普通对话"不触发这条折叠逻辑
  if (!raw || !raw.includes('```json')) {
    return []
  }

  const results: string[] = []
  // exec 在 /g 模式下需要循环；每次返回下一个匹配
  let match: RegExpExecArray | null
  CONTENT_RE.lastIndex = 0
  while ((match = CONTENT_RE.exec(raw)) !== null) {
    // match[1] 是捕获组里的内容（带转义）
    // 先 unescape JSON → 再 ensureClosedFences 防止半截 fence 把后续 `---` 分隔符吞掉
    results.push(ensureClosedFences(unescapeJsonString(match[1])))
  }
  return results
}


// 末尾"正在写、还没闭合"的那段 content（用于 overview 逐字流式渲染）。
// 与 CONTENT_RE 的唯一区别：结尾是 `$`（一路吃到字符串末尾、**没有**闭合引号），
// 而非闭合的 `"`。`.exec`（非 /g）找最左可达 `$` 的匹配——已闭合的段后面跟着 `","references"...`
// 到不了 `$` 会失败、引擎右移，最终命中末尾真正未闭合的那段。
const OPEN_CONTENT_RE = /"content"\s*:\s*"((?:\\.|[^"\\])*)$/

/**
 * 提取流式 raw_stream 末尾"正在写、未闭合"的单个 section.content。
 *
 * 用途：让第一段（overview，纯文本）在 content 闭合前就逐字流式显示（"开头就动起来"）；
 * 一旦该段闭合，调用方改用 extractSectionContents 整段渲染（后续结构化段照旧整段）。
 *
 * @param raw 流式累积原始文本（可能含 ```json fence + 半截 JSON）
 * @returns 未闭合 content 的当前已写部分；无未闭合段 / 无 json fence → null
 */
export function extractOpenContent(raw: string): string | null {
  if (!raw || !raw.includes('```json')) {
    return null
  }
  const m = OPEN_CONTENT_RE.exec(raw)
  if (!m) {
    return null
  }
  // 同 extractSectionContents：unescape + 补未闭合 fence（防 markdown 破坏）
  return ensureClosedFences(unescapeJsonString(m[1]))
}


// section 的 type 字段（按出现顺序，用于把 content 配回它所属段的类型）
const TYPE_RE = /"type"\s*:\s*"([a-zA-Z_]+)"/g

/** 流式渲染用的单段信息：类型 + 当前内容 + 是否已闭合。 */
export interface StreamSection {
  type: string | null   // overview / entry_point / call_chain / db_ops / rules / sources …
  content: string       // 已 unescape 的 content（call_chain 段是 JSON 字符串，前端会改显占位）
  complete: boolean      // content 是否已闭合（false=正在写，可逐字流）
}

/**
 * 把流式 raw_stream 解析成"按段"的 StreamSection 列表（含正在写的未闭合段）。
 *
 * 用途（方案 B）：流式时文本段逐字渲染、call_chain 段改显占位骨架；需要知道每段的 type。
 * 配对逻辑：每个 section 对象里 "type" 必在 "content" 之前出现 → 第 i 个 type 配第 i 个 content。
 *
 * @returns 段列表（顺序与 LLM 输出一致）；最后一段若 complete=false 即正在写。
 */
export function extractStreamingSections(raw: string): StreamSection[] {
  if (!raw || !raw.includes('```json')) {
    return []
  }
  // 1. 所有段的 type（按出现顺序）
  const types: string[] = []
  let tm: RegExpExecArray | null
  TYPE_RE.lastIndex = 0
  while ((tm = TYPE_RE.exec(raw)) !== null) {
    types.push(tm[1])
  }
  // 2. 已闭合 content（复用）+ 3. 末尾未闭合 content
  const closed = extractSectionContents(raw)
  const open = extractOpenContent(raw)

  const out: StreamSection[] = []
  // 已闭合段：第 i 个 content 配第 i 个 type
  closed.forEach((c, i) => out.push({ type: types[i] ?? null, content: c, complete: true }))
  // 正在写的那段（未闭合 content）：配 types[closed.length]
  if (open !== null) {
    out.push({ type: types[closed.length] ?? null, content: open, complete: false })
  } else if (types.length > closed.length) {
    // content 还没开始、但段已起头（如 call_chain 刚出 type/title）→ 占位段（content 空），
    // 让 call_chain 占位骨架尽早出现、不留空窗
    out.push({ type: types[closed.length] ?? null, content: '', complete: false })
  }
  return out
}
