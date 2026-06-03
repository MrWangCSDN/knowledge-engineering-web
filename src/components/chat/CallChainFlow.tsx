/**
 * src/components/chat/CallChainFlow.tsx
 *
 * 用 ReactFlow + dagre 渲染 LLM 输出的调用链 JSON。
 *
 * 数据流：
 *   后端 LLM → call_chain.content (JSON string)
 *     ↓ tryParseCallChain
 *   CallChainData {nodes, edges}
 *     ↓ 本组件 useMemo: dagre 算 LR 布局 + 转成 ReactFlow 节点
 *   <ReactFlow nodes={...} edges={...} />
 *     - 自定义 MethodNode（卡片样式 + EntityRef 跳转）
 *     - 内置 MiniMap / Controls / Background
 *     - 暗色模式 colorMode 跟随主题 store
 *
 * 工具栏（右上悬浮）：
 *   - 全屏：包装容器从 inline 切到 fixed inset-0 z-50（Esc 退出）
 *   - PNG 导出：toPng 渲染 viewport + 高 DPI
 *
 * 不做：
 *   - 节点拖拽（默认开启 ReactFlow 自带，无需额外代码）
 *   - 节点编辑（KE 是只读展示）
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
// ReactFlow v12 核心 API
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
  getNodesBounds,
  getViewportForBounds,
  type ReactFlowInstance,
} from '@xyflow/react'
// 必须 import 官方样式，否则节点/边/控件位置错乱
import '@xyflow/react/dist/style.css'
// dagre 做自动布局：给一组节点 + 边，算出每个节点应该放哪
import dagre from '@dagrejs/dagre'
// html-to-image 把 DOM 节点（viewport）转 PNG dataUrl
import { toPng } from 'html-to-image'
// lucide-react 图标库
import { Maximize2, Minimize2, ImageDown } from 'lucide-react'

import type { CallChainData } from '@/types/chat'
import { MethodNode, type MethodFlowNode } from './MethodNode'

// 注册节点 type：'method' → MethodNode 组件
// nodeTypes 必须用 useMemo 或模块级常量，否则每次 render 都新对象 → ReactFlow 警告
const NODE_TYPES: NodeTypes = { method: MethodNode }

// dagre 算布局时给每个节点的预估尺寸 —— 实际渲染时节点 minWidth/maxWidth 在
// MethodNode 里控制；dagre 只用这个估算 ranksep / nodesep 间距
// 2026-06-02 美化：尺寸往实际渲染最大宽度（max-w-[280]）+ 含 classOf hover tooltip 简化后
// 的真实高度（~44px）对齐，让 dagre 算出来的间距视觉舒展不挤压
const NODE_WIDTH = 260
// 2026-06-03：节点恢复「短类名 + 方法名」两行，实际高度 ~58px → dagre 估值同步上调，
// 避免 LR 布局同 rank 节点竖向间距被低估而视觉挤压
const NODE_HEIGHT = 58

/**
 * 用 dagre 算 LR (Left-to-Right) 布局，返回带 position 的 ReactFlow 节点。
 *
 * 算法：
 *   1. 建 graph，每个 node 给 width/height 预估
 *   2. 添加 edges（dagre 不关心 label，只看拓扑）
 *   3. dagre.layout() 算出每个 node 的 center 坐标
 *   4. dagre 返回中心点，ReactFlow 要左上角 → 减半宽半高
 */
function layoutWithDagre(
  nodes: MethodFlowNode[],
  edges: Edge[],
  rankdir: 'LR' | 'TB' = 'LR',
): MethodFlowNode[] {
  // dagre.graphlib.Graph：核心数据结构
  const g = new dagre.graphlib.Graph()
  // setGraph：图级配置 —— rankdir 方向、间距
  // 2026-06-02 第二轮美化（反思）：ranksep 不能一味加大！
  // LR 布局下 8 节点 × (NODE_WIDTH + ranksep) 总宽 → fitView 等比缩到容器宽 →
  // 缩放比降到 ~30% → 字号变 4px 看不清。
  // 改策略：ranksep / nodesep 保持紧凑，让总图小；
  // 配合 maxZoom 放开（ReactFlow 设 3），fitView 能把"小图放大"到节点尺寸接近原始
  g.setGraph({
    rankdir,
    ranksep: 90,   // 同向 rank 之间 —— 给边 + label 够位但不爆图宽
    nodesep: 36,   // 同 rank 内节点间距
    marginx: 24,
    marginy: 24,
  })
  // dagre 要求设默认 edge label 工厂（即使我们不用 label）
  g.setDefaultEdgeLabel(() => ({}))

  // 灌节点
  nodes.forEach(n => {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })
  // 灌边
  edges.forEach(e => {
    g.setEdge(e.source, e.target)
  })

  // 算布局 —— 改写 g 内每个 node 的 x/y
  dagre.layout(g)

  // 把算出的位置塞回 ReactFlow 节点
  return nodes.map(n => {
    const pos = g.node(n.id)
    return {
      ...n,
      // dagre 返回中心点；ReactFlow position 是左上角 → 减半
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      // LR 方向：source 在右、target 在左
      sourcePosition: rankdir === 'LR' ? Position.Right : Position.Bottom,
      targetPosition: rankdir === 'LR' ? Position.Left : Position.Top,
    }
  })
}

interface Props {
  data: CallChainData
  /** 'dark' 时 ReactFlow 切暗色 UI；默认 'light' */
  theme?: 'light' | 'dark'
}

/**
 * 内层 —— 渲染 ReactFlow 主体。
 *
 * 设计取舍（2026-06-02 调整）：
 * - 不在这里调 useReactFlow()，避免 React 19 + lazy + ReactFlowProvider 组合
 *   下出现的 Invalid hook call（mount 顺序）；改成通过 ReactFlow 的 `onInit`
 *   回调拿 instance，存 useRef 里在需要时（fitView / toPng）使用
 * - 全屏切换用 key 强制 remount，让 ReactFlow 自动 fitView 进新尺寸
 */
function CallChainFlowInner({ data, theme = 'light' }: Props) {
  // 全屏状态：true 时容器从 inline 切到 fixed inset-0
  const [fullscreen, setFullscreen] = useState(false)
  // 容器 ref —— 用于 PNG 导出定位 viewport 元素
  const wrapperRef = useRef<HTMLDivElement>(null)
  // ReactFlow 实例 —— 通过 onInit 回调注入，避免在父组件用 useReactFlow hook
  // 泛型必须和 ReactFlow 的 nodes/edges 类型对齐，否则 onInit 回调里 instance 类型不匹配
  const flowRef = useRef<ReactFlowInstance<MethodFlowNode, Edge> | null>(null)

  // 把 CallChainData 转成 ReactFlow Node[] / Edge[]
  // useMemo 防止每次 render 都新数组导致 ReactFlow 无谓 reset
  const { initialNodes, initialEdges } = useMemo(() => {
    // 1. 节点：CallChainNode → ReactFlow Node<MethodNodeData, 'method'>
    //    position 先填 (0,0)，下面 dagre 重排
    //    data spread (...n) 让 TS 推导出 Record-like 形态，满足 ReactFlow generic 约束
    const rfNodes: MethodFlowNode[] = data.nodes.map(n => ({
      id: n.id,
      type: 'method' as const,
      position: { x: 0, y: 0 },
      data: { ...n },
    }))

    // 2. 边：CallChainEdge → ReactFlow Edge
    //    用 smoothstep 圆角折线（比 bezier 视觉更清晰），加箭头 marker
    const rfEdges: Edge[] = data.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      type: 'smoothstep',
      // 边末端加三角箭头；箭头颜色和边一致
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted-foreground)' },
      // 边线颜色 + 宽度 —— 走 design token；label 字体 + 背景框
      // 2026-06-02 美化：label padding 加厚 (4,2)→(8,4) 防文字贴边；
      // background 改成 card 色，对比度比 background 更清晰；
      // 边线 strokeWidth 1.5 → 1.2 更细更优雅
      style: { stroke: 'var(--muted-foreground)', strokeWidth: 1.2 },
      labelStyle: { fontSize: 11, fontFamily: 'inherit', fill: 'var(--foreground)', fontWeight: 500 },
      labelBgStyle: { fill: 'var(--card)', stroke: 'var(--border)', strokeWidth: 0.5 },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 6,
    }))

    // 3. dagre 重排
    const layouted = layoutWithDagre(rfNodes, rfEdges, 'LR')

    return { initialNodes: layouted, initialEdges: rfEdges }
  }, [data])

  // 全屏开关 + Esc 监听
  useEffect(() => {
    if (!fullscreen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [fullscreen])

  // PNG 导出 —— 完整图（不止 viewport，全部节点都进去）
  // 通过 onInit 拿到的 ReactFlow 实例调用；不依赖 useReactFlow hook
  const handleExportPNG = useCallback(async () => {
    const flow = flowRef.current
    if (!flow) return
    const nodes = flow.getNodes()
    if (nodes.length === 0) return
    // 算所有节点的包围盒 —— 用 ReactFlow util
    const bounds = getNodesBounds(nodes)
    // 算让所有节点入框的 transform（含 padding）
    const width = 1200
    const height = Math.max(600, Math.round((bounds.height / bounds.width) * 1200))
    const transform = getViewportForBounds(bounds, width, height, 0.5, 2, 0.1)

    // 找到 ReactFlow 的 viewport 元素（真正画图的层）
    const viewportEl = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewportEl) return

    try {
      const dataUrl = await toPng(viewportEl, {
        width, height,
        backgroundColor: theme === 'dark' ? '#212121' : '#ffffff',
        style: {
          width: `${width}px`,
          height: `${height}px`,
          // 临时把 viewport transform 设成"刚好容纳所有节点"
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
        pixelRatio: 2,
      })
      // 触发浏览器下载
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `call-chain-${Date.now()}.png`
      a.click()
    } catch (err) {
      console.error('CallChainFlow PNG 导出失败', err)
    }
  }, [theme])

  return (
    <div
      ref={wrapperRef}
      className={
        // 全屏：fixed 覆盖整个 viewport + 顶层 z-index + 黑底加深
        // 非全屏：内联 + 默认高度 + 边框
        // 2026-06-02 美化：高度 420 → 460；LR 布局图本身扁，加高也帮助有限，
        // 真正放大节点靠 maxZoom + 紧凑 ranksep（fitView 把小图自动放大到节点接近原始尺寸）
        fullscreen
          ? 'fixed inset-0 z-50 bg-background'
          : 'relative my-3 h-[460px] rounded-lg border border-border bg-card overflow-hidden'
      }
    >
      {/* 工具栏（右上悬浮，hover 显示）*/}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={handleExportPNG}
          title="导出 PNG"
          className="
            p-1.5 rounded-md bg-card border border-border
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-colors
          "
          aria-label="导出 PNG"
        >
          <ImageDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? '退出全屏 (Esc)' : '全屏'}
          className="
            p-1.5 rounded-md bg-card border border-border
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-colors
          "
          aria-label={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ReactFlow 本体；key 切换让全屏前后强制 remount + 重新 fitView
          用 defaultNodes/defaultEdges 走 uncontrolled 模式，ReactFlow 内部自己跑 onNodesChange
          自动写入 measured (width/height)，否则 MiniMap 无法画节点 rect */}
      <ReactFlow
        key={fullscreen ? 'fs' : 'inline'}
        defaultNodes={initialNodes}
        defaultEdges={initialEdges}
        nodeTypes={NODE_TYPES}
        // onInit 在 ReactFlow 实例 ready 时调一次，存到 ref 给 PNG 导出用
        onInit={(instance) => { flowRef.current = instance }}
        // colorMode v12 新 API：自动给内置 UI（minimap/controls/background）切暗色
        colorMode={theme}
        // 自动 fit 进 viewport（首屏铺满）
        fitView
        // 美化（2026-06-02 第二轮）：padding 0.15 → 0.08 让节点占更多面积；
        // 关键：放开 maxZoom 让"小图自动放大"超过 1.0 → 节点视觉接近原始尺寸
        fitViewOptions={{ padding: 0.08, maxZoom: 2.5 }}
        // 双击不让聚焦节点（避免误触）
        nodesFocusable={false}
        // 禁用键盘 delete / backspace（KE 是只读视图）
        deleteKeyCode={null}
        // 鼠标滚轮缩放 + 拖拽平移；都是默认开启，这里显式列让可读
        zoomOnScroll
        panOnDrag
        // 缩放上下限：minZoom 看清节点的最低限；maxZoom 提到 3 让 fitView 能放大小图
        minZoom={0.3}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        {/* 背景：点阵网格；颜色走 design token */}
        <Background gap={20} size={1} color="var(--border)" />
        {/* 左下控件：缩放 +/- / 复位 / 锁定 */}
        <Controls position="bottom-left" showInteractive={false} />
        {/* 右下小地图：复杂图时方便定位 */}
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="var(--background)"
          nodeColor={(n) => {
            // minimap 内节点配色按 kind 走（保持视觉一致）
            const k = (n.data as { kind?: string })?.kind
            switch (k) {
              case 'controller': return 'var(--ref-accent)'
              case 'service':    return 'var(--status-done)'
              case 'mapper':     return 'var(--status-progress)'
              default:           return 'var(--muted-foreground)'
            }
          }}
          style={{ background: 'var(--card)' }}
        />
      </ReactFlow>
    </div>
  )
}

/**
 * 外层导出 —— 不再套 ReactFlowProvider（2026-06-02 修）：
 * useReactFlow hook 已移除，改用 onInit 拿 ReactFlow instance；ReactFlow 自带 store
 * 不再需要外层 Provider。少一层包装避免 React 19 + lazy + Provider 组合下偶发的
 * Invalid hook call。
 */
export function CallChainFlow(props: Props) {
  return <CallChainFlowInner {...props} />
}
