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
