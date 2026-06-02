/**
 * src/components/chat/CodeBlock.tsx
 *
 * ChatGPT 风格的代码块组件 —— header (语言名 + 复制按钮) + 语法高亮。
 *
 * 用 react-syntax-highlighter (prism async light)：
 *  - async = 按需注册语言，避免一次性 import 所有 grammar (200+KB)
 *  - 我们只注册 6 种常用语言：Java / Python / TS / JS / Bash / SQL / JSON
 *  - 暗主题用 vscDarkPlus，亮主题用 oneLight（Atom One Light）
 *    （原 vs / VSCode 浅色太淡、关键字几乎分不出来；oneLight 对比清晰，
 *     视觉对齐 ChatGPT 浅色代码块。2026-05-16 改）
 *
 * 用法（一般通过 ReactMarkdown 的 components.code 钩子调用）:
 *   <CodeBlock language="java" value="public class Foo {}" />
 */
import { useState, type ReactNode } from 'react'
import { Check, Copy, Code2 } from 'lucide-react'
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// 按需注册语言，避免 default bundle 太大
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
// 2026-06-02：diff 高亮 — LLM 回答里贴 git diff / patch 时之前 fallback 为 plain，
// 现在显式注册，给增删行上色（绿/红）
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff'

SyntaxHighlighter.registerLanguage('java', java)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('tsx', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('jsx', javascript)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)
SyntaxHighlighter.registerLanguage('xml', markup)
SyntaxHighlighter.registerLanguage('html', markup)
SyntaxHighlighter.registerLanguage('diff', diff)
SyntaxHighlighter.registerLanguage('patch', diff)

import { useThemeStore } from '@/store/theme'

interface Props {
  /** 代码块语言 (如 'java', 'python')；空 / unknown 时显示为 plain */
  language?: string
  /** 代码源码 */
  value: string
  /** ReactMarkdown components.code 钩子里 inline 模式（行内 \`code\`）跳过 highlight */
  inline?: boolean
  /** 自定义 children for inline rendering */
  children?: ReactNode
  /** 2026-06-02：fence info 解析出的文件名（```java title="Foo.java"）；存在时 header 显示文件名 + lang badge */
  title?: string
}

/** 友好的语言显示名（小写 lang → 显示名） */
const LANG_LABELS: Record<string, string> = {
  java: 'Java',
  python: 'Python',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  javascript: 'JavaScript',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  sql: 'SQL',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  diff: 'Diff',
  patch: 'Patch',
}

export function CodeBlock({ language, value, inline, children, title }: Props) {
  const theme = useThemeStore(s => s.theme)
  const [copied, setCopied] = useState(false)

  // inline `code` 行内代码：用 muted 背景的小标签
  if (inline) {
    return (
      <code className="bg-muted px-1 py-0.5 rounded text-[13px] font-mono">
        {children ?? value}
      </code>
    )
  }

  const lang = (language || '').toLowerCase()
  const langLabel = LANG_LABELS[lang] || lang || 'plain'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API 在非 HTTPS / 部分浏览器可能失败，静默忽略
    }
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border bg-code-bg">
      {/* Header: (文件名)? + 语言名 + 复制按钮
          2026-06-02：fence 有 title="Foo.java" 时，文件名显眼，lang 缩成小 badge — ChatGPT 同款 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b text-[12px]">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Code2 className="h-3.5 w-3.5 shrink-0" />
          {title ? (
            <>
              {/* truncate 防止超长文件名撑爆 header；font-mono 更像"文件名"质感 */}
              <span className="font-mono text-foreground truncate" title={title}>
                {title}
              </span>
              <span className="px-1.5 py-px rounded bg-muted text-[10.5px] uppercase tracking-wide shrink-0">
                {langLabel}
              </span>
            </>
          ) : (
            <span>{langLabel}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="复制代码"
          className="
            flex items-center gap-1 px-2 py-0.5 rounded
            text-muted-foreground hover:bg-muted hover:text-foreground
            transition-colors
          "
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>

      {/* 代码体：语法高亮 */}
      <SyntaxHighlighter
        language={lang || 'plaintext'}
        style={theme === 'dark' ? vscDarkPlus : oneLight}
        customStyle={{
          margin: 0,
          padding: '12px 14px',
          fontSize: '13px',
          lineHeight: '1.6',
          background: 'transparent',
        }}
        // 关键（2026-05-16）：oneLight/vscDarkPlus 主题会给内层 <code> 元素
        // 自带一个 background（白/深），customStyle 只作用于外层 <pre>，
        // 不覆盖 <code> → 每行透出主题白底成"白块"。codeTagProps 把
        // <code> 也设透明，统一露出 --code-bg 面板底。
        codeTagProps={{ style: { background: 'transparent' } }}
        wrapLongLines={false}
      >
        {value.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}
