/**
 * src/components/chat/extractSectionContents.test.ts
 *
 * 在 raw_stream 流入过程中（可能是半截 JSON），实时提取已经出现的
 * section.content 字符串数组。
 *
 * 设计动机（v1.9）：用户原本看到 ```json {"sections":[{"type":"overview",...}]} ```
 * 这种 JSON wrapper 很难读；折叠后只展示 sections.content 拼起来的纯内容。
 *
 * 注意：实时流是"半截 JSON"，标准 JSON.parse 抛错。
 * 我们用宽松正则提 `"content": "..."` 字段，逐个收集。
 */
import { describe, it, expect } from 'vitest'
import { extractSectionContents, extractOpenContent, extractStreamingSections } from './extractSectionContents'


describe('extractSectionContents', () => {
  it('完整 JSON：返回每个 section.content', () => {
    const raw = '```json\n{"sections":[{"type":"overview","title":"x","content":"业务概述内容","references":[]},{"type":"entry_point","title":"y","content":"入口方法内容","references":[]}]}\n```'
    expect(extractSectionContents(raw)).toEqual(['业务概述内容', '入口方法内容'])
  })

  it('半截 JSON（第一个 content 已完整、第二个还在写）：只返回完整的', () => {
    const raw = '```json\n{"sections":[{"type":"overview","content":"已完整内容","references":[]},{"type":"entry_point","content":"正在写'
    // 第一个 content 完整；第二个 content 缺闭合双引号 → 不返回
    expect(extractSectionContents(raw)).toEqual(['已完整内容'])
  })

  it('没有 ```json fence 时返回空数组', () => {
    expect(extractSectionContents('普通文本')).toEqual([])
    expect(extractSectionContents('')).toEqual([])
  })

  it('content 内含转义引号（\\\"）正确解析', () => {
    // JSON 中的 \" 表示字面值是引号
    const raw = '```json\n{"sections":[{"content":"他说\\"你好\\"","type":"x"}]}\n```'
    expect(extractSectionContents(raw)).toEqual(['他说"你好"'])
  })

  it('content 内含换行（\\n）解析后还原', () => {
    const raw = '```json\n{"sections":[{"content":"第一行\\n第二行","type":"x"}]}\n```'
    expect(extractSectionContents(raw)).toEqual(['第一行\n第二行'])
  })

  it('多段 content 顺序保持原序', () => {
    const raw = '```json\n{"sections":[' +
      '{"content":"段1","type":"a"},' +
      '{"content":"段2","type":"b"},' +
      '{"content":"段3","type":"c"}]}'
    expect(extractSectionContents(raw)).toEqual(['段1', '段2', '段3'])
  })

  it('只有 ```json 头没出现 content 字段：空数组', () => {
    const raw = '```json\n{"sections":[{'
    expect(extractSectionContents(raw)).toEqual([])
  })
})


describe('extractOpenContent（末尾正在写的未闭合 content，用于 overview 逐字流）', () => {
  it('没有 ```json fence → null', () => {
    expect(extractOpenContent('你好啊')).toBeNull()
  })

  it('正在写 overview（content 未闭合）→ 返回当前已写部分', () => {
    const raw = '```json\n{"sections":[{"type":"overview","title":"业务概述","content":"用户提交订单后'
    expect(extractOpenContent(raw)).toBe('用户提交订单后')
  })

  it('overview 已闭合、无后续未闭合 content → null（交回整段渲染）', () => {
    const raw = '```json\n{"sections":[{"type":"overview","content":"已闭合内容","references":[]}'
    expect(extractOpenContent(raw)).toBeNull()
  })

  it('未闭合内容含转义换行 → 正确 unescape', () => {
    const raw = '```json\n{"sections":[{"type":"overview","content":"第一行\\n第二行还在写'
    expect(extractOpenContent(raw)).toBe('第一行\n第二行还在写')
  })

  it('前面有已闭合段、末尾又有未闭合段 → 取末尾未闭合那段', () => {
    const raw = '```json\n{"sections":[{"type":"overview","content":"完整段","references":[]},' +
      '{"type":"entry_point","content":"正在写的入口'
    expect(extractOpenContent(raw)).toBe('正在写的入口')
  })
})


describe('extractStreamingSections（按段解析，含 type + 未闭合段）', () => {
  it('没有 ```json fence → []', () => {
    expect(extractStreamingSections('你好')).toEqual([])
  })

  it('已闭合 overview + 正在写 entry_point → type 配对 + complete 标记', () => {
    const raw = '```json\n{"sections":[' +
      '{"type":"overview","title":"概述","content":"业务概述内容","references":[]},' +
      '{"type":"entry_point","title":"入口","content":"正在写入口'
    expect(extractStreamingSections(raw)).toEqual([
      { type: 'overview', content: '业务概述内容', complete: true },
      { type: 'entry_point', content: '正在写入口', complete: false },
    ])
  })

  it('call_chain 段按 type 识别（内容是 JSON，交前端改占位）', () => {
    const raw = '```json\n{"sections":[' +
      '{"type":"overview","content":"概述","references":[]},' +
      '{"type":"call_chain","title":"调用链路","content":"{\\"nodes\\":[]}","references":[]}'
    const out = extractStreamingSections(raw)
    expect(out[1].type).toBe('call_chain')
    expect(out[1].complete).toBe(true)
  })

  it('段刚起头（出了 type 还没 content）→ 给 content 空的占位段（让 call_chain 骨架尽早出现）', () => {
    const raw = '```json\n{"sections":[' +
      '{"type":"overview","content":"概述","references":[]},' +
      '{"type":"call_chain","title":"调用链路"'
    const out = extractStreamingSections(raw)
    expect(out.length).toBe(2)
    expect(out[1]).toEqual({ type: 'call_chain', content: '', complete: false })
  })
})
