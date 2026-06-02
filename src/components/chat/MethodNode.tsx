/**
 * src/components/chat/MethodNode.tsx
 *
 * ReactFlow 自定义节点 —— 调用图里的"一个方法 / 业务步骤"。
 *
 * 设计思路（区别于 mermaid 死板方块）：
 *   - 节点本身是 React 组件 → 可塞 EntityRef 跳转链接、kind 图标、签名 hover
 *   - 配色走 design token（ref-accent / status-done / status-progress / muted），
 *     dark/light 主题自动跟随
 *   - 上下左右 4 个 Handle（ReactFlow 要求边必须挂在 Handle 上）
 *
 * 不在这里做：
 *   - 自动布局（交给 CallChainFlow 里的 dagre）
 *   - 主题切换（用 css var，浏览器自己跟）
 */
// ReactFlow v12 核心 API:
//   Handle  — 节点的连接锚点
//   Position — Handle 位置枚举（Top/Right/Bottom/Left）
//   NodeProps — 自定义节点 props 类型（含 data / id / selected 等）
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { CallChainNode } from '@/types/chat'
import { EntityRef } from './EntityRef'

// ReactFlow v12 的 Node<T> 类型 *要求* T 满足 `Record<string, unknown>` 索引签名。
// CallChainNode 是 interface（具名字段），不直接满足；用 intersection 包一层
// 让 TS 既保留 CallChainNode 的精确字段类型，又满足 ReactFlow 的 generic 约束。
type MethodNodeData = CallChainNode & Record<string, unknown>
// Node<T, 'method'> 第二个泛型是节点 type 字符串，CallChainFlow 注册用
export type MethodFlowNode = Node<MethodNodeData, 'method'>

// 节点角色 → 配色 token 映射；undefined 走默认 'method' 灰
// 用 CSS 变量而非硬编码 hex，dark/light 自动跟随
const KIND_COLOR: Record<NonNullable<CallChainNode['kind']>, string> = {
  controller: 'var(--ref-accent)',      // 蓝 —— 入口 / API 层
  service: 'var(--status-done)',         // 绿 —— 业务服务层
  mapper: 'var(--status-progress)',      // 琥珀 —— 数据访问层
  method: 'var(--muted-foreground)',     // 灰 —— 普通方法
  external: 'var(--muted-foreground)',   // 灰 —— 外部依赖
}

// 节点角色 → emoji 图标；空 → 不显示图标
const KIND_ICON: Record<NonNullable<CallChainNode['kind']>, string> = {
  controller: '🌐',
  service: '⚙️',
  mapper: '💾',
  method: '⚡',
  external: '↗',
}

/**
 * ReactFlow 调用 <MethodNode>，把 CallChainNode data 传进来。
 *
 * @param props.data CallChainNode 全字段
 * @param props.selected ReactFlow 框选状态（用户点了它）
 */
export function MethodNode({ data, selected }: NodeProps<MethodFlowNode>) {
  // kind 没填默认 'method'
  const kind = data.kind ?? 'method'
  const accent = KIND_COLOR[kind]
  const icon = KIND_ICON[kind]

  // hover 提示完整签名：classOf + label + sig
  // 例：com.foo.UserController.createUser(Long, String)
  const titleHint = [data.classOf, data.label].filter(Boolean).join('.') + (data.sig ?? '')

  return (
    <div
      // 节点容器：圆角 + 阴影 + 左侧 3px accent 竖条（按 kind 着色）
      // selected 状态加 ring 边框（ReactFlow 自带 outline 不够明显）
      className={`
        relative min-w-[180px] max-w-[280px]
        rounded-lg border border-border bg-card
        shadow-sm hover:shadow-md transition-shadow
        ${selected ? 'ring-2 ring-[var(--ref-accent)]' : ''}
      `}
      // 左侧 3px 竖条：用 box-shadow inset 实现，节省一层 DOM
      style={{ boxShadow: `inset 3px 0 0 0 ${accent}` }}
      title={titleHint}
    >
      {/* 4 方向 Handle：上下左右各一个，让 dagre 自动选合适入口 */}
      {/* style 隐藏 Handle 圆点视觉（让节点看起来干净），但仍允许连接 */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      {/* 节点内容区 */}
      <div className="px-3 py-2">
        {/* 第一行：图标 + 主标签 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] shrink-0" aria-hidden>{icon}</span>
          {/* label 用 EntityRef 套上（如果有 entityId），实现点击跳源码 */}
          {/* 没有 entityId 时退化为普通文本 */}
          {data.entityId ? (
            <EntityRef entityId={data.entityId}>
              <span className="font-mono text-[12.5px] text-foreground truncate">
                {data.label}
              </span>
            </EntityRef>
          ) : (
            <span className="font-mono text-[12.5px] text-foreground truncate">
              {data.label}
            </span>
          )}
        </div>

        {/* 第二行（可选）：类全限定名 + 签名 —— 灰小字 */}
        {/* 用 line-clamp-1 保证一行不超过节点宽度 */}
        {(data.classOf || data.sig) && (
          <div className="mt-0.5 text-[10.5px] text-muted-foreground font-mono truncate">
            {data.classOf}
            {data.sig && <span className="opacity-80">{data.sig}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
