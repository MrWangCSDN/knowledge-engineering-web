/**
 * remark 插件：把正文里的 [entity_id|显示文本] 标记转成 mdast link 节点
 * （url = 'entity:' + entityId）。后端 AGENT_SYSTEM_PROMPT 用这种标记标实体引用。
 * 渲染侧由 AssistantMessage 的 `a` 组件识别 entity: 前缀 → EntityRef。
 */
import type { Root, Text, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

// entity_id 形如 method://... / class://... / table://... / doc://...
// scheme 仅小写（后端 AGENT_SYSTEM_PROMPT 保证）；若后端改大写需同步放宽 [a-z]+
//
// 关于 display text 的字符约束（2026-06-02 重审）：
// - entity_id 段：`[^|\s\]]+` — 不允许 `|` / 空白 / `]`（URL 不可能有这些）
// - display 段：`(?:\\]|\\\||[^\n\]])+` — 允许 `|`（如 `Map.put(K|V)` 含 union 类型），
//                禁止换行（防止跨段误吸），允许 `\]` `\|` 反斜杠转义
//   → match 后用 `unescapeDisplay()` 还原转义
const ENTITY_RE = /\[([a-z]+:\/\/[^|\s\]]+)\|((?:\\\]|\\\||[^\n\]])+)\]/g

// 还原 display 里的反斜杠转义：\] → ]、\| → |
function unescapeDisplay(s: string): string {
  return s.replace(/\\([\]|])/g, '$1')
}

export function remarkEntityRef() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index == null) return
      const value = node.value
      ENTITY_RE.lastIndex = 0
      if (!ENTITY_RE.test(value)) return
      ENTITY_RE.lastIndex = 0

      const out: PhrasingContent[] = []
      let last = 0
      let m: RegExpExecArray | null
      while ((m = ENTITY_RE.exec(value)) !== null) {
        if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) })
        const [, entityId, displayRaw] = m
        // display 里允许的 \] / \| 反斜杠转义需要还原成真实字符
        const display = unescapeDisplay(displayRaw)
        out.push({
          type: 'link',
          url: `entity:${entityId}`,
          children: [{ type: 'text', value: display }],
        })
        last = m.index + m[0].length
      }
      if (last < value.length) out.push({ type: 'text', value: value.slice(last) })

      parent.children.splice(index, 1, ...out)
      return index + out.length  // 跳过新插入节点，避免无限递归
    })
  }
}

/**
 * 判断 url 是否像"qualified-name"实体 id：
 *   - 含 `::`（Java 类/方法分隔符约定）
 *   - 不是 http(s)/mailto 等已知 web 协议
 *   - 不是已有 entity: 前缀
 * 例：`OrderTimeOutCancelTask::cancelTimeOutOrder` / `Cls::m#(Long)` / `pkg.Cls::m`。
 * 兜底场景：agent 偶尔不按 prompt 输出 `[entity_id|文本]`，改用标准 markdown `[文本](Cls::m)`，
 * 此时 react-markdown 把 `Cls::m` 当 URL；浏览器看不懂 → about:blank#blocked。
 */
function looksLikeQualifiedName(url: string): boolean {
  if (!url.includes('::')) return false                       // 必含 ::
  if (url.startsWith('entity:')) return false                 // 已是 entity: scheme
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return false      // 已有 //-scheme（http:// / method:// 等）
  if (/^(https?|mailto|tel|xmpp):/i.test(url)) return false   // 已知 web/通讯协议
  return true
}

/**
 * react-markdown 的 urlTransform：默认只放行 https?/ircs?/mailto/xmpp，会把
 * remarkEntityRef 产出的 entity: url 清空。这里让 entity: 直接透传，其余仍走默认安全白名单。
 * AssistantMessage 的 <ReactMarkdown urlTransform={entityUrlTransform}> 必须用它，
 * 否则内联引用 href 为空、EntityRef 渲染不出来。
 *
 * 2026-06-08 加 qualified-name 兜底：agent 不按规范输出 `[文本](Cls::m)` 时，
 * 把 `Cls::m` 转 `entity:Cls::m`，让 `a` handler 的 entity: 分支接住 → EntityRef → openEntity。
 */
export function entityUrlTransform(url: string): string {
  if (url.startsWith('entity:')) return url
  // 兜底：含 :: 且非已知 scheme → 当 qualified-name 实体 id 处理
  if (looksLikeQualifiedName(url)) return `entity:${url}`
  const safeProtocol = /^(https?|ircs?|mailto|xmpp):/i
  try {
    const parsed = new URL(url)
    return safeProtocol.test(parsed.protocol) ? url : ''
  } catch {
    // 相对 URL 直接放行
    return url
  }
}
