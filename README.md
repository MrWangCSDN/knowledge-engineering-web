# knowledge-engineering-web

`knowledge-engineering` 项目的 Web 前端。**前后端分离**架构：

- **前端**：React 19 + Vite 8 + TypeScript 6 + Tailwind v4 + shadcn/ui + React Router v7 + TanStack Query + Zustand
- **后端**：Python `knowledge-engineering` 仓库的 FastAPI（默认 `http://localhost:8000`）
- **通信**：开发期 vite proxy（`/api/*` → FastAPI），生产期 `VITE_API_BASE_URL`

> 详细的功能页面规划与设计文档见内部知识库。本 README 只覆盖工程结构、安装与启动。

## 目录结构

```
src/
├── api/          # axios 客户端 + 后端调用封装
├── components/
│   ├── layout/   # AppLayout、Sidebar 等整体框架
│   └── ui/       # shadcn/ui 风格基础组件（Button 等）
├── hooks/        # 自定义 React hooks
├── lib/          # 工具函数（cn 等）
├── pages/        # 路由页面（HomePage / SearchPage / MethodDetailPage / ...）
├── store/        # zustand 全局状态（主题等）
├── types/        # 共享 TypeScript 类型
├── App.tsx       # 路由表
├── main.tsx      # Provider 链（QueryClientProvider + BrowserRouter）
└── index.css     # Tailwind v4 + shadcn 设计 token（亮 / 暗双套）
```

## 安装

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
# 默认 http://localhost:5173
```

请同时启动后端（在 `knowledge-engineering` 仓库执行）：

```bash
uvicorn src.service.api:app --reload --host 0.0.0.0 --port 8000
```

前端通过 vite proxy 自动转发 `/api/*` → `http://localhost:8000`，无需手动配 CORS（后端已有 wildcard CORS 适配开发）。

## 生产构建

```bash
npm run build      # 输出到 dist/
npm run preview    # 本地预览 dist/
```

生产环境若后端不在同源，需要设置环境变量：

```bash
VITE_API_BASE_URL=https://api.example.com npm run build
```

## 设计 Token

`src/index.css` 维护**亮 / 暗双套** shadcn 设计 token，**全部走 CSS 变量**（不允许在组件中硬编码颜色值）。切换主题：左侧导航底部按钮。

新增 shadcn 组件：

```bash
npx shadcn@latest add <component-name>
# 例：npx shadcn@latest add card dialog dropdown-menu input
```

`components.json` 已配置好别名（`@/components/ui`、`@/lib/utils` 等）。

## 当前已搭建的页面（占位）

| 路由 | 页面 | 对应能力 |
|---|---|---|
| `/` | 首页 dashboard | P-01 项目概览 + 大搜索框 |
| `/search` | 全局检索 | P-03（占位） |
| `/method` | 方法详情 | P-04（占位，将集成 Cytoscape.js 邻居图） |
| `/impact` | 影响分析 | P-08（占位） |
| `/table-access` | 方法↔表 | P-09（占位） |

## 技术决策

| 项 | 选型 | 理由 |
|---|---|---|
| 构建工具 | Vite 8 | 快速 HMR + 极小配置 |
| UI 框架 | React 19 + TypeScript 6 | 主流 + 强类型 |
| 样式 | Tailwind v4 + shadcn/ui | 高度可控 + 现代美学（Linear / Sourcegraph 风） |
| 路由 | React Router v7 | 成熟稳定 |
| 服务端状态 | TanStack Query v5 | 缓存 + 失效 + 重试一站式 |
| 客户端状态 | Zustand | 轻量、无 boilerplate |
| HTTP | axios | 拦截器 + 易测试 |
| 图谱可视化 | Cytoscape.js（详情/邻居图）+ react-force-graph（大图浏览） | 前者多布局，后者大图性能 |
| 图标 | lucide-react | 与 shadcn 默认一致 |

## 后续 TODO

- [ ] 接入 FastAPI `/health` `/stats` 等接口填充首页徽标
- [ ] 实现 P-03 全局检索（三模式：name / 代码语义 / 业务问句）
- [ ] 实现 P-04 方法详情（左 Cytoscape 邻居图 + 右源码 + 解读 Tab）
- [ ] 实现 P-08 影响分析（含/不含推断边对比 + Excel 导出）
- [ ] 实现 P-09 方法↔表（双向追溯 + SQL 片段）
- [ ] SSE 流水线进度（待后端补 `/pipeline/events`）
