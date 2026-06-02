/**
 * src/components/chat/remarkNormalizePunct.ts
 *
 * remark 插件：把 LLM 输出里的智能引号 normalize 成 ASCII 直引号。
 *
 * 为什么需要：LLM 在中英文混排时常吐 Unicode 弯引号（U+201C "  / U+201D " /
 * U+2018 '  / U+2019 '）。用户复制到 IDE 时这些字符会被识别为非 ASCII，
 * 在 Java/Python 字符串字面量里报语法错误（"unterminated string"）。
 *
 * 设计取舍：
 *   - 只 normalize 引号，不动 em-dash (—) / en-dash (–) / ellipsis (…)
 *     —— 后三者复制粘贴一般不出问题，且 em-dash 在中文文案里有美学意义
 *   - 用 remark visitor 自动跳过 `code` / `inlineCode` 节点（visit 只匹配 'text' 类型）
 *     —— 代码块里的引号必须保留原样
 *
 * 用法（AssistantMessage.tsx）：
 *   const MD_REMARK_PROPS = {
 *     remarkPlugins: [remarkGfm, remarkEntityRef, remarkNormalizePunct],
 *     ...
 *   }
 */
// mdast 类型：Root 是整棵语法树根节点，Text 是文本叶子节点
import type { Root, Text } from 'mdast'
// unist-util-visit：递归遍历语法树；第二个参数 'text' 让它只回调文本节点
import { visit } from 'unist-util-visit'

// 引号映射表 — Unicode codepoint → ASCII
// 键用转义 \u 写法方便看清是哪个 codepoint（直接写 " 编辑器可能跟普通引号无法区分）
const PUNCT_MAP: Record<string, string> = {
  '“': '"',  // U+201C  " LEFT DOUBLE QUOTATION MARK
  '”': '"',  // U+201D  " RIGHT DOUBLE QUOTATION MARK
  '‘': "'",  // U+2018  ' LEFT SINGLE QUOTATION MARK
  '’': "'",  // U+2019  ' RIGHT SINGLE QUOTATION MARK
}

// 正则一次匹配所有 4 个智能引号；类字符内每个就是一个 codepoint
const SMART_QUOTE_RE = /[“”‘’]/g

/**
 * remark 插件工厂 —— remark 的插件协议是 `() => (tree) => void`。
 * 第一层（外）是可配置入口；第二层（内）是真正处理树的 transformer。
 * 我们没有配置项，所以外层直接返回 transformer。
 */
export function remarkNormalizePunct() {
  return (tree: Root) => {
    // visit(tree, 'text', cb)：只回调 type==='text' 的节点
    //   → 自动跳过 'code'（块代码）/ 'inlineCode'（行内代码）
    //   → 代码里的引号保持原样
    visit(tree, 'text', (node: Text) => {
      // 先 test 一下，命中才做 replace，避免没必要的字符串重建
      if (SMART_QUOTE_RE.test(node.value)) {
        // 全局正则有 lastIndex 状态，test 之后 replace 前需要 reset，
        // 否则下次 test 可能从中间开始匹配
        SMART_QUOTE_RE.lastIndex = 0
        // replace 第二个参数用函数：从映射表查替换字符
        // ?? c 是 nullish coalescing：理论上不会走到（match 已经限定在 4 个字符里），
        // 但 TS 严格模式要求这里有兜底
        node.value = node.value.replace(SMART_QUOTE_RE, (c) => PUNCT_MAP[c] ?? c)
      }
    })
  }
}
