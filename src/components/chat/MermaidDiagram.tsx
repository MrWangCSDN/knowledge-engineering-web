/**
 * src/components/chat/MermaidDiagram.tsx
 *
 * 把 mermaid 图源码渲染成 SVG；解析失败时降级为 <pre> 原文。
 *
 * 设计点：
 *   - 用 useEffect 异步调 mermaid.render（mermaid v10+ 是 async）
 *   - 给每个实例一个唯一 id（不然多个图会冲突）
 *   - light / dark 主题用 mermaid 自己的 theme，CSS 变量盖一遍颜色
 *   - 失败兜底：显示原始 code，不让用户看白屏
 */
import { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'

interface Props {
  code: string
  /**
   * 当前 UI 主题；'dark' 时用 mermaid 的 dark theme。
   * 由父组件从 themeStore 读取后传入；这样组件本身无状态依赖。
   */
  theme?: 'light' | 'dark'
}

/**
 * 模块级初始化：mermaid 全局 config 只能初始化一次。
 * `securityLevel: 'loose'` 允许我们自己写的 graph 里有点 raw html（标签换行）。
 */
let _initialized = false
function initOnce(theme: 'light' | 'dark') {
  if (_initialized) return
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })
  _initialized = true
}

export function MermaidDiagram({ code, theme = 'light' }: Props) {
  // `useId` 是 React 18+ 内置 hook，专为生成唯一 id 用
  // mermaid.render 要求 id 是合法 CSS 选择器；React 的 useId 含 ":"，得去掉
  const reactId = useId()
  const safeId = `mermaid-${reactId.replace(/:/g, '')}`

  // `useRef` 拿 DOM 引用；外层 div 用来检测组件是否还挂载
  const mountedRef = useRef(true)

  // svg 字符串 + 错误信息；用 state 触发重渲染
  const [svg, setSvg] = useState<string | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    // 标记挂载状态；卸载时置 false，回调里跳过 setState 避免 React 警告
    mountedRef.current = true
    initOnce(theme)

    // 异步渲染 mermaid 源码
    let cancelled = false
    ;(async () => {
      try {
        const result = await mermaid.render(safeId, code)
        if (!cancelled && mountedRef.current) {
          setSvg(result.svg)
          setErrored(false)
        }
      } catch (e) {
        // 解析失败 / 语法错误：降级为 <pre>，把错误 swallow
        // 不打 console.error 防止生产 sentry 误报；用 console.debug 更轻
        if (!cancelled && mountedRef.current) {
          console.debug('MermaidDiagram render failed:', e)
          setSvg(null)
          setErrored(true)
        }
      }
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
    // `code + theme` 变化时重渲染；safeId 在组件生命周期内稳定，不需要进 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, theme])

  // 渲染失败 → 显示原始代码（用户至少能复制粘贴排查）
  if (errored) {
    return (
      <pre
        data-testid="mermaid-fallback"
        className="
          my-3 p-3 rounded-lg bg-muted text-foreground/80 text-[12.5px]
          font-mono overflow-x-auto whitespace-pre-wrap
          border border-destructive/30
        "
      >
        <span className="block text-destructive text-[11px] mb-1">⚠ Mermaid 解析失败，原始内容：</span>
        {code}
      </pre>
    )
  }

  // 渲染中 / 已成功：把 svg 字符串注入 div
  // 注意：React 不允许同时给同一个元素传 children 和 dangerouslySetInnerHTML
  // 所以分两个分支渲染（不同元素）
  if (!svg) {
    // 还没渲染好时显示占位
    return (
      <div
        data-testid="mermaid-container"
        className="
          my-3 p-3 rounded-lg bg-card border
          flex justify-center items-center
          min-h-[60px]
        "
      >
        <span className="text-[12px] text-muted-foreground">渲染中…</span>
      </div>
    )
  }

  // 已成功：注入 svg 字符串
  return (
    <div
      data-testid="mermaid-container"
      className="
        my-3 p-3 rounded-lg bg-card border overflow-x-auto
        flex justify-center
        [&_svg]:max-w-full [&_svg]:h-auto
      "
      // `dangerouslySetInnerHTML` 是 React 注入原始 HTML 的官方语法；
      // mermaid.render 返回的 svg 是它自己生成的、可信的字符串，所以这里安全
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
