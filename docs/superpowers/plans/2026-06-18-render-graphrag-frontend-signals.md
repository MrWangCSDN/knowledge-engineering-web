# 调用图前端硬信号呈现（P6i 前端轮）Implementation Plan — v2（基线 release-0513）

> 设计 spec：Obsidian `01 Engineering/knowledge-engineering/图渲染-前端硬信号呈现-设计.md`（已审）。
> 本 plan 为 v2：**基线改 off `release-0513`**（真正前端主线，已推 origin，含 ReactFlow 渲染器，无 SVG POC）。v1 误基于已废弃的 `feat/svg-callgraph-poc`（已删）。

**Goal:** 给 `CallChainFlow`/`MethodNode`（ReactFlow）渲染后端 S3 已发的两个硬信号——`is_disabled` 节点灰化（去色+虚框+降透明+「未启用」徽章）、`virtual` 跨服务边画 `--edge-virtual` 紫色虚线。

**与 v1 的差异（release-0513 结构适配）：**
- **删 Task A**：release-0513 无 SvgCallChain，无需移除。
- **无 `callChainStyle.ts`**：release-0513 的 `MethodNode` 内联 `KIND_COLOR`（私有）。改为新建小模块 `callGraphSignals.ts`（常量 + `edgeVisual` 纯函数，可测）；节点禁用 accent 用常量 `DISABLED_ACCENT` 在 `MethodNode` 内联三元（component test 覆盖）。
- **`CallChainFlow`**：release-0513 的边映射 + `layoutWithDagre` 都内联在组件里（无 `callChainLayout.ts`）；只改边映射段接 `edgeVisual`，加 MiniMap 禁用判断。

**Tech Stack:** React 19 + @xyflow/react + Tailwind v4（CSS 变量 token）+ vitest + @testing-library/react。验证：`npx tsc -b`(0)、`npx vitest run <file>`、`npx eslint <files>`、preview 双主题截图。

**约束（前端宪法）：** 颜色全走 `var(--*)`；浅+深双主题验证；无裸 hex；缺字段=现状（向后兼容）。

---

### Task 1: types 加 is_disabled / virtual
- Modify `src/types/chat.ts`：`CallChainNode` + `is_disabled?: boolean`；`CallChainEdge` + `virtual?: boolean`。
- Test `src/types/chat.callchain.test.ts`：`tryParseCallChain` 保留两字段（pass-through 守卫）。
- 验证：`npx vitest run src/types/chat.callchain.test.ts`（绿）+ `npx tsc -b`(0) → commit。

### Task 2: --edge-virtual token
- Modify `src/index.css`：`:root` 加 `--edge-virtual: oklch(0.52 0.19 295)`（--ref-accent 行后）；`.dark` 加 `oklch(0.72 0.16 295)`；`@theme inline` 加 `--color-edge-virtual: var(--edge-virtual)`。
- 验证：`npx tsc -b`(0) → commit。（先确认 release-0513 的 index.css 有这些锚点行。）

### Task 3: callGraphSignals.ts（新模块 + 测试）
- Create `src/components/chat/callGraphSignals.ts`：
  - `DISABLED_OPACITY = 0.6`、`DISABLED_BADGE_TEXT = '未启用'`、`DISABLED_ACCENT = 'var(--muted-foreground)'`、`VIRTUAL_EDGE_DASH = '5 4'`
  - `interface EdgeVisual { stroke; markerColor; strokeDasharray? }`
  - `edgeVisual(edge: { virtual?: boolean }): EdgeVisual` —— virtual→edge-virtual 虚线；否则 muted 实线。
- Test `src/components/chat/callGraphSignals.test.ts`：edgeVisual virtual/普通 + 常量合法。
- 验证：test 绿 + tsc 0 + eslint → commit。

### Task 4: MethodNode 渲染 is_disabled
- Modify `src/components/chat/MethodNode.tsx`：
  - import `{ DISABLED_OPACITY, DISABLED_BADGE_TEXT, DISABLED_ACCENT }` from `./callGraphSignals`
  - `const disabled = !!data.is_disabled`；`const accent = disabled ? DISABLED_ACCENT : KIND_COLOR[kind]`
  - 根 div className 加 `${disabled ? 'border-dashed' : ''}`
  - 内容区 div `style={disabled ? { opacity: DISABLED_OPACITY } : undefined}`
  - 内容区后插「未启用」徽章（`var(--muted-foreground)` 文字+边框、`var(--muted)` 背景、不降透明）
- Test `src/components/chat/MethodNode.test.tsx`（ReactFlowProvider 包裹）：禁用节点出徽章 + border-dashed；正常节点无。
- 验证：test 绿 + tsc 0 + eslint → commit。

### Task 5: CallChainFlow 渲染 virtual 边 + MiniMap 禁用节点
- Modify `src/components/chat/CallChainFlow.tsx`：
  - import `{ edgeVisual }` from `./callGraphSignals`
  - 边映射 `data.edges.map((e,i) => { const ev = edgeVisual(e); return {..., markerEnd:{...,color:ev.markerColor}, style:{ stroke:ev.stroke, strokeWidth:1.2, ...(ev.strokeDasharray?{strokeDasharray:ev.strokeDasharray}:{}) }, ...} })`
  - MiniMap `nodeColor`：禁用节点（`n.data.is_disabled`）回退 `var(--muted-foreground)`
- 验证：tsc 0 + eslint + `npx vitest run src/components/chat`（不回归）→ commit。

### Task 6: 全量回归 + 双主题视觉验收
- `npx vitest run`（全绿）+ `npx tsc -b`(0) + 改动文件 eslint 干净（仓库既有 lint 债不计）。
- dev server（`npm run dev`，/dev/md-preview）临时给 CALL_CHAIN_SAMPLE 注入 is_disabled 节点 + virtual 边，preview 截图 light+dark 对照 spec §3 mockup，验毕还原（不提交临时改动）。

---

## 收尾
- `superpowers:finishing-a-development-branch`：全绿 + 双主题截图 → 推送 → 开 PR **base=`release-0513`**（在 origin，diff 仅本轮）。标题 `feat: 调用图前端硬信号呈现（is_disabled 灰化 + 跨服务虚线边）`。
- 部署：合 release-0513 不等于上线（前端独立构建/发布）。范围外：框架 entry_kind 节点徽章（需后端透字段）。
