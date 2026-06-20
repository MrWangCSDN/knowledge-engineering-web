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

  it('agent 用 markdown 链接形式 [文本](method://...) 也能转 entity:（不再 about:blank#blocked）', () => {
    // 线上真实复现：agent 偶尔写成 markdown 链接 [文本](method://Cls::m) 而非规范 [method://Cls::m|文本]。
    // 这种 URL 既不被 ENTITY_RE 接（无竖线），又被 looksLikeQualifiedName 排除（有 ://），
    // 修复前 → <a href="method://..."> 死链 → 点击 about:blank#blocked。
    md('查询分类 [分类查询](method://PmsProductCategoryController::getItem) 实现')
    expect(screen.getByText('分类查询').getAttribute('data-href'))
      .toBe('entity:method://PmsProductCategoryController::getItem')
  })
})

describe('entityUrlTransform 安全白名单', () => {
  it('放行 entity: 与常规安全协议', () => {
    expect(entityUrlTransform('entity:method://a')).toBe('entity:method://a')
    expect(entityUrlTransform('https://example.com')).toBe('https://example.com')
  })

  it('拦截危险协议 javascript: / data:（清空）', () => {
    expect(entityUrlTransform('javascript:alert(1)')).toBe('')
    expect(entityUrlTransform('data:text/html,<script>alert(1)</script>')).toBe('')
  })

  it('兜底：把 qualified-name 模式（含 ::）转成 entity: scheme', () => {
    // agent 偶尔写标准 markdown [文本](Cls::m) 而非 [Cls::m|文本]；
    // 不转的话 react-markdown 默认丢弃非白名单 scheme → href="" → 浏览器 about:blank#blocked
    expect(entityUrlTransform('OrderTimeOutCancelTask::cancelTimeOutOrder'))
      .toBe('entity:OrderTimeOutCancelTask::cancelTimeOutOrder')
    expect(entityUrlTransform('PortalOrderDao::updateOrderStatus#()'))
      .toBe('entity:PortalOrderDao::updateOrderStatus#()')
    expect(entityUrlTransform('com.foo.OmsServiceImpl::generateOrder#(OrderParam)'))
      .toBe('entity:com.foo.OmsServiceImpl::generateOrder#(OrderParam)')
  })

  it('兜底2：把 ke 实体 scheme 的 markdown 链接 URL（method:// 等）转成 entity:', () => {
    // agent 写成 markdown 链接 [文本](method://Cls::m)：URL 带 :// scheme，
    // 既不被 ENTITY_RE 接（无竖线）、又被 looksLikeQualifiedName 排除（有 ://）。
    // 必须单独把 method/class/table/doc 这几个 ke scheme 转 entity:，否则点击 about:blank#blocked。
    expect(entityUrlTransform('method://PmsProductCategoryController::getItem'))
      .toBe('entity:method://PmsProductCategoryController::getItem')
    expect(entityUrlTransform('class://com.foo.Bar')).toBe('entity:class://com.foo.Bar')
    expect(entityUrlTransform('table://oms_order')).toBe('entity:table://oms_order')
    expect(entityUrlTransform('doc://some/doc')).toBe('entity:doc://some/doc')
  })

  it('已有 entity: 已经被识别，不要双重前缀', () => {
    expect(entityUrlTransform('entity:method://Cls::m')).toBe('entity:method://Cls::m')
  })

  it('普通 https 链接不受 :: 兜底影响', () => {
    // 极端：含 :: 的 https URL（如 IPv6 host 路径里带 ::）不应被当 qualified-name
    expect(entityUrlTransform('https://example.com/Cls::m')).toBe('https://example.com/Cls::m')
  })
})
