import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const CSS = readFileSync('src/index.css', 'utf-8')
// 取 :root{...} 与 .dark{...} 两块
const rootBlock = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('.dark {'))
const darkBlock = CSS.slice(CSS.indexOf('.dark {'), CSS.indexOf('@theme inline'))

describe('agent 状态色 token（守前端宪法：light+dark 双定义）', () => {
  for (const t of ['--status-pending', '--status-progress', '--status-done', '--ref-accent']) {
    it(`light 定义 ${t}`, () => expect(rootBlock).toContain(t))
    it(`dark 定义 ${t}`, () => expect(darkBlock).toContain(t))
  }
})
