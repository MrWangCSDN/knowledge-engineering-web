/**
 * remark 插件：把正文里的 [entity_id|显示文本] 标记转成 mdast link 节点
 * （url = 'entity:' + entityId）。后端 AGENT_SYSTEM_PROMPT 用这种标记标实体引用。
 * 渲染侧由 AssistantMessage 的 `a` 组件识别 entity: 前缀 → EntityRef。
 */
import type { Root, Text, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'

// entity_id 形如 method://... / class://... / table://... / doc://...；显示文本不含 ']' 和 '|'
const ENTITY_RE = /\[([a-z]+:\/\/[^|\]]+)\|([^\]]+)\]/g

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
        const [, entityId, display] = m
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
