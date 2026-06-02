/**
 * src/lib/monacoSetup.ts
 *
 * 自托管 Monaco 核心：让 @monaco-editor/react 使用 bundle 内的 monaco-editor，
 * 不再从 jsdelivr CDN 动态加载。蓝队内网/国内访问 CDN 不稳定，此模块为必要兜底。
 *
 * 副作用模块（side-effect only）：
 *   - 设置 self.MonacoEnvironment.getWorker → 从 Vite ?worker bundle 实例化各语言 Worker
 *   - 调用 loader.config({ monaco }) → 把打包好的 monaco 实例注入 @monaco-editor/react
 *
 * 使用方式：在 MonacoSnippet.tsx 顶部 `import '@/lib/monacoSetup'`，
 * 保证 Editor 组件首次渲染前 loader.config 已经执行。
 */

// 导入完整的 monaco-editor 实例（打包进 bundle，不走 CDN）
import * as monaco from 'monaco-editor'

// loader 是 @monaco-editor/react 暴露的配置入口，用于替换默认 CDN 加载策略
import { loader } from '@monaco-editor/react'

// ?worker 是 Vite 专属语法：把对应 JS 文件打包成独立 chunk，
// 返回一个可以 `new` 的 Worker 构造器（而非直接引用脚本路径）
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Monaco 在浏览器里通过 self.MonacoEnvironment.getWorker 取得各语言的 Web Worker。
// 若不覆盖此全局变量，Monaco 会尝试从 CDN 下载 worker 脚本（内网不可达）。
// _workerId 是内部 ID（字符串），label 是语言类型标识符，用于按需选择正确 worker。
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    // JSON 语言 → 专用 json worker（提供 JSON schema 校验）
    if (label === 'json') return new JsonWorker()

    // CSS/SCSS/Less → 专用 css worker（提供补全与 lint）
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()

    // HTML 模板语言 → 专用 html worker
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()

    // TypeScript/JavaScript → 专用 ts worker（类型检查 + 补全）
    if (label === 'typescript' || label === 'javascript') return new TsWorker()

    // 其余语言（java、xml、sql、yaml、plaintext 等）走通用编辑器 worker：
    // 仅提供基础分词/括号匹配，无专属语义分析，够代码查看器使用。
    return new EditorWorker()
  },
}

// 核心配置：把本地 bundle 的 monaco 实例注入 @monaco-editor/react 的 loader，
// 使其在首次渲染 <Editor /> 前直接使用已打包的 monaco，不再触发 CDN 请求。
loader.config({ monaco })
