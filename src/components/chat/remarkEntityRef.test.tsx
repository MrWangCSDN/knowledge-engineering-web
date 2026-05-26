import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { remarkEntityRef, entityUrlTransform } from './remarkEntityRef'

const comps: Components = {
  a: ({ href, children }) => <a data-href={href}>{children}</a>,
}

function md(src: string) {
  render(
    <ReactMarkdown
      remarkPlugins={[remarkEntityRef]}
      components={comps}
      urlTransform={entityUrlTransform}
    >
      {src}
    </ReactMarkdown>,
  )
}

describe('remarkEntityRef', () => {
  it('把 [entity_id|显示文本] 转成 entity: 链接', () => {
    md('见 [method://com.bank.openAccount|DepositController.openAccount()] 实现')
    const a = screen.getByText('DepositController.openAccount()')
    expect(a.getAttribute('data-href')).toBe('entity:method://com.bank.openAccount')
  })

  it('不误伤普通 markdown 链接', () => {
    md('[文档](https://example.com)')
    const a = screen.getByText('文档')
    expect(a.getAttribute('data-href')).toBe('https://example.com')
  })

  it('一行多个引用都转', () => {
    md('[class://A|甲] 和 [method://b|乙]')
    expect(screen.getByText('甲').getAttribute('data-href')).toBe('entity:class://A')
    expect(screen.getByText('乙').getAttribute('data-href')).toBe('entity:method://b')
  })
})
