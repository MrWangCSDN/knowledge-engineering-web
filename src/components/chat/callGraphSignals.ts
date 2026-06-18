/**
 * 调用图 GraphRAG 硬信号样式（P6i 前端轮）。
 * 集中 is_disabled 节点 / virtual 跨服务边的样式决策，供 MethodNode / CallChainFlow 共用、便于单测。
 * 颜色走 CSS 变量（light/dark 自动跟随），无硬编码 hex。
 */
import type { CallChainEdge } from '@/types/chat'

/** 禁用节点内容降透明度（徽章不受影响，单独渲染在外层）。 */
export const DISABLED_OPACITY = 0.6
/** 禁用节点右上角徽章文案。 */
export const DISABLED_BADGE_TEXT = '未启用'
/** 禁用节点左侧 accent 竖条颜色（去色 → muted）。 */
export const DISABLED_ACCENT = 'var(--muted-foreground)'
/** 跨服务虚线边的 dash 模式（ReactFlow strokeDasharray）。 */
export const VIRTUAL_EDGE_DASH = '5 4'

/** 边描边/箭头样式。 */
export interface EdgeVisual {
  stroke: string
  markerColor: string
  strokeDasharray?: string
}

/** 边样式：virtual → --edge-virtual 虚线；否则 muted 实线（现状）。 */
export function edgeVisual(edge: Pick<CallChainEdge, 'virtual'>): EdgeVisual {
  if (edge.virtual) {
    return {
      stroke: 'var(--edge-virtual)',
      markerColor: 'var(--edge-virtual)',
      strokeDasharray: VIRTUAL_EDGE_DASH,
    }
  }
  return {
    stroke: 'var(--muted-foreground)',
    markerColor: 'var(--muted-foreground)',
  }
}
