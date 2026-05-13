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
import { extractSectionContents } from './extractSectionContents'


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
