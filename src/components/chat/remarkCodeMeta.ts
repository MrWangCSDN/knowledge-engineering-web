/**
 * src/components/chat/remarkCodeMeta.ts
 *
 * remark 插件：把 fenced code block 的 info string meta 部分
 * （即 ``` 后面除了语言之外的内容）透传给最终的 <code> 元素，
 * 让 react-markdown 的 components.code 钩子能读到。
 *
 * 例：
 *   ```java title="UserService.java" hl=3-5
 *   public class UserService { ... }
 *   ```
 *
 * mdast 解析后的 code 节点结构：
 *   { type: 'code', lang: 'java', meta: 'title="UserService.java" hl=3-5', value: '...' }
 *
 * 不做这个插件，meta 会被 remark-rehype 默认丢掉 —— react-markdown 拿不到。
 * 本插件把 meta 塞进 node.data.hProperties['data-meta']，remark-rehype 转 hast 时
 * 会把它渲染成 <code data-meta="...">。最终 react-markdown 的 code 钩子里
 * 可以通过 props['data-meta'] 读到。
 *
 * 用法（AssistantMessage.tsx）：
 *   const MD_REMARK_PROPS = {
 *     remarkPlugins: [remarkGfm, remarkEntityRef, remarkNormalizePunct, remarkCodeMeta],
 *     ...
 *   }
 */
// mdast 类型：Root 整棵树根，Code 是 fenced/indented code block 节点
import type { Root, Code } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * 工厂函数 —— remark 插件协议：外层返回一个 transformer。
 * 我们没有可配参数，所以直接闭包返回 transformer。
 */
export function remarkCodeMeta() {
  return (tree: Root) => {
    // visit 第二个参数限定只回调 'code'（mdast 块级代码）节点
    // —— inlineCode 是另一种类型，不会命中
    visit(tree, 'code', (node: Code) => {
      // 没 meta 就不用动；省去无谓的 data/hProperties 初始化
      if (!node.meta) return

      // node.data：mdast 节点上挂载"和 hast 转换交互"的额外信息
      // ?? = 仅当左侧 nullish 时才赋默认对象，避免覆盖已有 data
      node.data ??= {}
      // hProperties 是 remark-rehype 约定 —— 这里塞的键会变成 hast 元素的 attribute
      // 但需要先告诉 TS 这是个可写对象（mdast Data 类型默认 unknown）
      const data = node.data as { hProperties?: Record<string, string> }
      data.hProperties ??= {}
      // data-meta 是 HTML5 自定义属性命名规范（kebab + data- 前缀），React 会把它原样透传
      data.hProperties['data-meta'] = node.meta
    })
  }
}

/**
 * 工具函数：从 fence info meta 字符串里抽出 title="..." 文件名。
 *
 * 支持三种 quote 风格：
 *   title="Foo.java"     → "Foo.java"
 *   title='Foo.java'     → "Foo.java"
 *   title=Foo.java       → "Foo.java"  （无引号，遇空白结束）
 *
 * 返回 undefined 表示没有 title 字段。
 */
export function parseCodeTitle(meta: string | undefined): string | undefined {
  if (!meta) return undefined
  // 三个捕获组分别对应三种 quote 风格；用 (?:) 让外层 group 不计数，简化提取
  const m = meta.match(/title=(?:"([^"]+)"|'([^']+)'|(\S+))/)
  // m[1] / m[2] / m[3] 至多一个非空（看用了哪个分支）
  return m?.[1] ?? m?.[2] ?? m?.[3]
}
