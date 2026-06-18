import { describe, it, expect } from 'vitest'
import { tryParseCallChain } from './chat'

describe('tryParseCallChain — GraphRAG 硬信号字段保留（P6i 前端轮）', () => {
  it('node.is_disabled / edge.virtual 透传不被丢', () => {
    const json = JSON.stringify({
      nodes: [
        { id: 'n1', label: '下单', kind: 'service' },
        { id: 'n2', label: '超时取消', kind: 'service', is_disabled: true },
      ],
      edges: [
        { from: 'n1', to: 'n2', label: '调用' },
        { from: 'n1', to: 'n3', label: 'Feign', virtual: true },
      ],
    })
    const data = tryParseCallChain(json)
    expect(data).not.toBeNull()
    expect(data?.nodes[1]?.is_disabled).toBe(true)
    expect(data?.nodes[0]?.is_disabled).toBeUndefined()
    expect(data?.edges[1]?.virtual).toBe(true)
    expect(data?.edges[0]?.virtual).toBeUndefined()
  })
})
