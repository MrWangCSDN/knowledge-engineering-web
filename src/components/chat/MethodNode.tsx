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

  // hover 完整提示（title 属性 → 浏览器原生 tooltip）
  // 例：com.foo.UserController.createUser(Long, String)
  // 节点本身只显示精简的 label，完整路径交给 tooltip
  const titleHint = [data.classOf, data.label].filter(Boolean).join('.') + (data.sig ?? '')

  // 2026-06-02 美化：把 sig 与 label 拼到同一行单行展示，节点高度从 ~56px 降到 ~36px
  // 视觉密度跟 ChatGPT / Linear 工作流图对齐
  const displayLabel = data.label + (data.sig ?? '')

  // 2026-06-03：短类名（去包名）—— 区分同名方法的不同分层
  // （Controller.register / Service.register / Impl.register 在图上一眼分得清）；
  // 完整全限定名仍在 title hover 里。仅在有 classOf 时显示这一行。
  const shortClass = data.classOf ? data.classOf.split('.').pop() : ''

  return (
    <div
      // 节点容器：圆角 + 阴影 + 左侧 3px accent 竖条（按 kind 着色）
      // selected 状态加 ring 边框（ReactFlow 自带 outline 不够明显）
      // 美化（2026-06-02）：min-w 略增到 200，max-w 收紧到 260（跟 dagre NODE_WIDTH 对齐）；
      // hover 阴影更显眼，shadow-sm → shadow，hover:shadow-md → hover:shadow-lg
      className={`
        relative min-w-[200px] max-w-[260px]
        rounded-md border border-border bg-card
        shadow hover:shadow-lg transition-all duration-150
        ${selected ? 'ring-2 ring-[var(--ref-accent)] ring-offset-1' : ''}
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

      {/* 节点内容区 —— 两行：短类名（分层）+ icon + label(含sig) */}
      {/* 2026-06-03：恢复类名行但用「短类名」(去包名) + text-[10px]，让同名方法的不同层
          （Controller/Service/Impl）一眼区分；完整全限定名仍在 hover tooltip。
          配色走 token（text-muted-foreground），light/dark 自动跟随，无硬编码色值 */}
      <div className="flex flex-col px-3 py-1.5">
        {shortClass && (
          <span className="font-mono text-[10px] leading-tight text-muted-foreground truncate">
            {shortClass}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] shrink-0" aria-hidden>{icon}</span>
          {/* label + sig 拼一起显示；超长 truncate 加 ... */}
          {/* 用 EntityRef 套上（如果有 entityId），实现点击跳源码 */}
          {data.entityId ? (
            <EntityRef entityId={data.entityId}>
              <span className="font-mono text-[12.5px] text-foreground truncate">
                {displayLabel}
              </span>
            </EntityRef>
          ) : (
            <span className="font-mono text-[12.5px] text-foreground truncate">
              {displayLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
