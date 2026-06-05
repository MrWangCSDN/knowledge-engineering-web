// 把"自由文本 raw_stream + 带 render 的 tool_calls"编排成有序段：
// 文本段与渲染块段按 render 的到达偏移 at 交错（agent 先说几句→插调用图→再接着说）。
// 设计 [[业务问答-agent化输出改造-设计]] §5.3。

/** 渲染块（目前仅 call_graph，未来可扩 table 等）。 */
export interface RenderBlock {
  kind: string          // 'call_graph' | ...
  data: unknown         // CallChainFlow 等组件直接消费
}

/** 一个 tool_call 条目（只取本函数关心的字段）。 */
interface ToolCallEntry {
  render?: RenderBlock | null
  at?: number           // 到达时 raw_stream 偏移（render 块插入位置）
}

/** 有序段：文本段 或 渲染块段。 */
export type AnswerSegment =
  | { kind: 'text'; content: string }
  | { kind: 'render'; data: unknown; renderKind: string }

/**
 * 剥掉文本里手画的"调用图/流程图"代码块（```reactflow 与 ```mermaid 的 flowchart/graph）。
 *
 * 用途：当本条消息已有 render_call_graph 工具产出的调用图（render 块）时，LLM 偶尔仍会
 * 在自由文本里又手画一张图（提示词压不住的 LLM 习惯，~半数概率）——手画的边常臆造、且与工具图
 * 重复，mermaid 还常因 `#(参数)` 等非法语法导致前端"解析失败"。故确定性剥掉手画的调用图块，
 * 只保留准确的工具图。无工具图时不调用本函数（手画块作为唯一图来源保留）。
 *
 * 注意：只剥"节点-边"类（reactflow / mermaid flowchart|graph）——这类一律应走 render_call_graph；
 * 保留 mermaid 的 sequenceDiagram / erDiagram / stateDiagram / gantt 等（工具画不了，仍需手画）。
 */
export function stripReactflowFences(text: string): string {
  return (text || '')
    // 1. 手画 reactflow 整块删（[\s\S] 跨行，*? 非贪婪到最近的 ```）
    .replace(/```reactflow[\s\S]*?```/g, '')
    // 2. 手画 mermaid 的 flowchart / graph（调用图/流程图）整块删；不动 sequence/er/state 等
    .replace(/```mermaid\s*(?:flowchart|graph)\b[\s\S]*?```/gi, '')
    .replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 按 render 的 at 偏移，把 rawStream 切成文本段并交错插入渲染块。
 *
 * @param rawStream agent 自由输出累计文本
 * @param toolCalls message.tool_calls（dict，key=tool_call id）
 * @returns 有序段列表（中间空文本段会被丢弃；无 render 时返回单个文本段，含空串）
 */
export function buildAnswerSegments(
  rawStream: string,
  toolCalls: Record<string, ToolCallEntry> | null | undefined,
): AnswerSegment[] {
  const text = rawStream || ''
  // 收集带 render 的渲染点：{at, block}；at 夹到 [0, text.length]；按 at 升序（同 at 稳定）
  const renders = Object.values(toolCalls || {})
    .filter((tc): tc is ToolCallEntry & { render: RenderBlock } => tc.render != null)
    .map(tc => ({ at: Math.max(0, Math.min(tc.at ?? text.length, text.length)), block: tc.render }))
    .sort((a, b) => a.at - b.at)

  // 无渲染点 → 单文本段（空串也返回一个，调用方可据需处理）
  if (renders.length === 0) return [{ kind: 'text', content: text }]

  const segs: AnswerSegment[] = []
  let cursor = 0
  // 在每个渲染点切一刀：先 push [cursor, at) 文本段（非空才 push），再 push 渲染块。
  // 既有工具图（renders 非空）→ 文本段剥掉手画 ```reactflow（去重，保留准确的工具图）。
  // 注意：用原始 text 按 at 切片（保偏移正确），只对切出的段内容去 reactflow。
  for (const r of renders) {
    const chunk = stripReactflowFences(text.slice(cursor, r.at))
    if (chunk) segs.push({ kind: 'text', content: chunk })
    segs.push({ kind: 'render', data: r.block.data, renderKind: r.block.kind })
    cursor = r.at
  }
  // 收尾：最后一个渲染点之后的剩余文本（同样去手画 reactflow）
  const tail = stripReactflowFences(text.slice(cursor))
  if (tail) segs.push({ kind: 'text', content: tail })
  return segs
}
