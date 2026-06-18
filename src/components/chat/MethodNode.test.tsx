import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Position, ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { MethodNode, type MethodFlowNode } from './MethodNode'
import type { CallChainNode } from '@/types/chat'

// MethodNode 用了 ReactFlow 的 <Handle>，必须包在 ReactFlowProvider 里渲染。
// NodeProps 字段多，测试只关心 data/selected，其余补齐后整体 cast。
function renderNode(data: CallChainNode) {
  const props = {
    id: data.id,
    type: 'method',
    data: { ...data },
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    deletable: true,
    selectable: true,
    draggable: true,
    width: 200,
    height: 40,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  } as unknown as NodeProps<MethodFlowNode>
  return render(
    <ReactFlowProvider>
      <MethodNode {...props} />
    </ReactFlowProvider>,
  )
}

describe('MethodNode — is_disabled 渲染（P6i 前端轮）', () => {
  it('禁用节点出现「未启用」徽章 + 卡片带 border-dashed', () => {
    const { container } = renderNode({
      id: 'n1',
      label: '超时取消',
      kind: 'service',
      is_disabled: true,
    })
    expect(screen.getByText('未启用')).toBeTruthy()
    expect(container.querySelector('.border-dashed')).toBeTruthy()
  })
  it('正常节点无「未启用」徽章、无 border-dashed', () => {
    const { container } = renderNode({ id: 'n2', label: '下单', kind: 'service' })
    expect(screen.queryByText('未启用')).toBeNull()
    expect(container.querySelector('.border-dashed')).toBeNull()
  })
})
