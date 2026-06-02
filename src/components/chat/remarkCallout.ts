/**
 * src/components/chat/remarkCallout.ts
 *
 * remark 插件：识别 GitHub 风格 callout（admonition），渲染成色块。
 *
 * 输入语法（GitHub / Obsidian 通用）：
 *   > [!NOTE]
 *   > 这里是注释内容
 *
 *   > [!WARNING]
 *   > 警告内容，可多段
 *
 * 五种类型 NOTE / TIP / IMPORTANT / WARNING / CAUTION 对齐 GitHub 规范。
 *
 * 实现要点：
 *   - 用 hName='aside' 让节点跳出默认 <blockquote>，避免被 MD_PROSE_* 的
 *     `[&_blockquote]:border-l-2 ...` Tailwind 选择器命中
 *   - 在 blockquote 头部插一段 paragraph 当 callout 标题（含 emoji + 类型名）
 *   - hProperties.className 加 `ke-callout` + `ke-callout-<type>`，
 *     具体颜色由 index.css 里的 CSS 变量驱动（不硬编码色值）
 *
 * 用法（AssistantMessage.tsx）：
 *   const MD_REMARK_PROPS = {
 *     remarkPlugins: [remarkGfm, remarkEntityRef, remarkNormalizePunct, remarkCodeMeta, remarkCallout],
 *     ...
 *   }
 */
// mdast 类型 —— Blockquote 是 `>` 块，Paragraph 是段落，Text 是文本叶子
import type { Root, Blockquote, Paragraph, Text } from 'mdast'
import { visit } from 'unist-util-visit'

// 五种类型枚举（按 GitHub 规范），as const 让 TS 推导出字符串字面量类型
const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const
type CalloutType = typeof CALLOUT_TYPES[number]

// 每种类型的 emoji 标识
const ICONS: Record<CalloutType, string> = {
  NOTE: 'ℹ️',
  TIP: '💡',
  IMPORTANT: '❗',
  WARNING: '⚠️',
  CAUTION: '🚨',
}

// 中文显示名（KE 全站中文 UI）
const LABELS: Record<CalloutType, string> = {
  NOTE: '注意',
  TIP: '提示',
  IMPORTANT: '重要',
  WARNING: '警告',
  CAUTION: '危险',
}

// 匹配 [!NOTE] 前缀（开头位置 + 可选换行/空白）
// 一并消耗后面的换行避免标题前出现空段
const CALLOUT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/

/**
 * remark 插件工厂；外层无参数，直接返回 transformer。
 */
export function remarkCallout() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      // 必须以 paragraph 开头 —— 标准 GFM 解析 > [!NOTE] 会包成 paragraph
      const firstChild = node.children[0]
      if (!firstChild || firstChild.type !== 'paragraph') return

      // paragraph 的第一个 text 节点开头必须匹配 [!TYPE]
      const firstTextNode = firstChild.children[0]
      if (!firstTextNode || firstTextNode.type !== 'text') return

      const m = firstTextNode.value.match(CALLOUT_RE)
      if (!m) return

      const type = m[1] as CalloutType

      // 去掉 [!TYPE] 前缀；后续 paragraph 内容保留
      firstTextNode.value = firstTextNode.value.slice(m[0].length)

      // 如果切完只剩空白，整个 firstTextNode 没意义了 —— 删掉
      // 进一步：如果 firstChild 段落只有这一个 text 而且也空了，整段也删
      if (!firstTextNode.value.trim()) {
        firstChild.children.shift()
        if (firstChild.children.length === 0) {
          node.children.shift()
        }
      }

      // 在最前面插一段 callout 标题段（emoji + 中文标签）
      // hProperties.className 让 CSS 能定位到这段（.ke-callout-title）
      const titleParagraph: Paragraph = {
        type: 'paragraph',
        children: [
          { type: 'text', value: `${ICONS[type]} ${LABELS[type]}` } as Text,
        ],
        data: {
          hProperties: { className: ['ke-callout-title'] },
        },
      }
      node.children.unshift(titleParagraph)

      // 让整个节点渲染为 <aside class="ke-callout ke-callout-note"> 而非 <blockquote>
      // 关键：避开 MD_PROSE_* 的 `[&_blockquote]:` 子选择器，不被默认 blockquote 样式污染
      node.data ??= {}
      const nodeData = node.data as {
        hName?: string
        hProperties?: Record<string, unknown>
      }
      nodeData.hName = 'aside'
      nodeData.hProperties = {
        className: ['ke-callout', `ke-callout-${type.toLowerCase()}`],
        'data-callout-type': type,
      }
    })
  }
}
