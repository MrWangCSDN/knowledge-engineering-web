/**
 * src/index.test.ts
 *
 * 主题 token 源码不变量：--context-ok/warn/danger 必须在 :root 与 .dark 各定义一档，
 * 并在 @theme inline 注册为 --color-context-*（Tailwind 才能用 bg-context-*）。
 * CSS 无运行时行为可单测，沿用本仓库 readFileSync 不变量手法（见 chat.test.ts）。
 * 设计：[[上下文窗口前端展示-设计]] §5.3
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('src/index.css', 'utf-8')

const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'))
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('@theme inline {'))
const themeBlock = css.slice(css.indexOf('@theme inline {'))

describe('index.css --context-* 语义 token', () => {
  it(':root 定义三态 light token', () => {
    expect(rootBlock).toContain('--context-ok: oklch(0.55 0.17 250)')
    expect(rootBlock).toContain('--context-warn: oklch(0.75 0.15 85)')
    expect(rootBlock).toContain('--context-danger: oklch(0.577 0.245 27.325)')
  })

  it('.dark 定义三态 dark token（提亮一档防脏块）', () => {
    expect(darkBlock).toContain('--context-ok: oklch(0.70 0.15 250)')
    expect(darkBlock).toContain('--context-warn: oklch(0.82 0.14 85)')
    expect(darkBlock).toContain('--context-danger: oklch(0.704 0.191 22.216)')
  })

  it('@theme inline 注册 --color-context-* (启用 bg-context-*)', () => {
    expect(themeBlock).toContain('--color-context-ok: var(--context-ok)')
    expect(themeBlock).toContain('--color-context-warn: var(--context-warn)')
    expect(themeBlock).toContain('--color-context-danger: var(--context-danger)')
  })
})
