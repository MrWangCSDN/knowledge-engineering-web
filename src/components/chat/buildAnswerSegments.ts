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
 * 剥掉文本里手画的 ```reactflow fenced 块。
 *
 * 用途：当本条消息已有 render_call_graph 工具产出的调用图（render 块）时，LLM 偶尔仍会
 * 在自由文本里又手画一张 ```reactflow（提示词压不住的 LLM 习惯）。手画图边常臆造、且与工具图重复，
 * 故确定性地剥掉手画块，只保留准确的工具图。无工具图时不调用本函数（手画块作为唯一图保留）。
 */
export function stripReactflowFences(text: string): string {
  // ```reactflow 到下一个 ``` 之间（含围栏）整体删除；[\s\S] 跨行，*? 非贪婪到最近的 ```
  return (text || '').replace(/```reactflow[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim()
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
