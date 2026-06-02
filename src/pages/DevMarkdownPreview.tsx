/**
 * src/pages/DevMarkdownPreview.tsx
 *
 * 临时 dev 路由（/dev/md-preview）—— 不需要登录就能进，直接挂 AssistantMessage
 * + 一段塞满 GFM 特性的 mock markdown，便于一次性验证：
 *   - 表格（thead / th / td 样式 + 行高不被外层 1.7 穿透）
 *   - 任务列表（- [x] / - [ ]）
 *   - 删除线（~~xxx~~）
 *   - diff 代码块（增删行高亮）
 *   - 实体引用 [method://...|text]
 *
 * 验证流程：
 *   1. 浏览器打开 http://localhost:5173/dev/md-preview
 *   2. 看 light 模式下表格 / 任务列表 / del / diff 是否对齐 ChatGPT 视觉
 *   3. 在 devtools 里跑 `document.documentElement.classList.toggle('dark')`
 *      切到 dark 模式再看一遍
 *
 * 这个文件可以保留作"以后改 markdown 渲染的快速验证入口"，
 * 也可以验证完直接删（连同 App.tsx 里那条 Route 一起）。
 */
// AssistantMessage 是 named export，DevMarkdownPreview 自己也用 named export 与项目其他页保持一致
import { AssistantMessage } from '@/components/chat/AssistantMessage'
// Message / Section / CallChainData 类型从 types/chat 取
import type { Message, CallChainData } from '@/types/chat'

// 一段塞满 GFM 特性的样例 markdown
// 用模板字符串方便保留多行结构；反引号代码块在模板字符串里要用 \` 转义
// 2026-06-02 二次扩展：把所有渲染层 polish 都搬进来当回归样本
// 包含：基础 GFM（表格/任务/del/diff）+ callout + 数学公式 + fence title + 智能引号
// + 表格 cell 内 <br>（后端 _fix_gfm_table_cells 处理后输出的形态）
// + entity ref 含 pipe / 反斜杠转义
const SAMPLE_MD = `这是一段 dev 测试 markdown，覆盖 KE 渲染层全部特性。

## 1. 表格（核心修复点）

| 维度 | Tree-sitter | JavaParser |
| --- | --- | --- |
| 本质 | 通用、增量式语法解析器生成器（parser generator） | 专为 Java 设计的纯 Java AST 解析库 |
| 语言支持 | Java/JS/Python/Rust 等 100+ 语言 | 仅 Java（含 Java 8–21 preview 特性） |
| 输出 | S-Expression 风格的 Syntax Tree（CST） | AST（抽象掉无关语法细节） |
| 默认丢弃 | 保留注释和空白 | 默认丢弃注释和空白 |

### 1.1 表格 cell 内多行（后端 _fix_gfm_table_cells 转 <br> 后的形态）

| 字段 | 说明 |
| --- | --- |
| name | 用户名<br>（必填，3-32 字符） |
| age | 年龄<br>整型<br>0 ≤ age ≤ 150 |
| email | 邮箱地址 |

## 2. 任务列表 + 删除线

- [x] 给 \`<table>\` 加 components 覆盖
- [x] 抽 \`MD_PROSE_*\` 常量去重
- [x] 给 \`<del>\` 加灰色样式
- [x] 半截 fence 自动闭合（防御性 safeguard）
- [x] dev preview 路由（你正在看的这一页）

~~旧方案：靠浏览器默认 table 样式凑合~~ → 改为显式覆盖 thead/tr/th/td，对齐 ChatGPT 视觉。

## 3. diff 代码块（含 fence title）

\`\`\`diff title="UserService.java"
- public User createUser(String name) {
+ public User createUser(String name, String email) {
   var user = new User(name);
+  user.setEmail(email);
   return userRepository.save(user);
 }
\`\`\`

普通 \`\`\`java（无 title）：

\`\`\`java
@Transactional(propagation = REQUIRES_NEW)
public void transfer(Account from, Account to, BigDecimal amount) {
    from.withdraw(amount);
    to.deposit(amount);
}
\`\`\`

## 4. 实体引用

入口方法：[method://com.foo.bar.UserController#createUser|UserController.createUser()]。

display 含 pipe（验证 #5 修复）：[method://com.util.Maps#put|Map.put(K|V)]。

display 含反斜杠转义的 |（验证 #5 修复）：[method://com.foo.Pipe#join|a\\|b\\|c]。
（注：display 内的 \`]\` 由于 markdown 自身 escape 优先级，建议改用语义化文字；
真要写字面 \`]\` 时，把整段实体引用括起来。）

## 5. callouts（GitHub 风格 admonition）

> [!NOTE]
> 这是 NOTE 提示，蓝色色块。常用来提示一般性补充信息。

> [!TIP]
> 这是 TIP 小贴士，绿色色块。比 NOTE 更轻量，鼓励用户尝试。

> [!IMPORTANT]
> 这是 IMPORTANT 重要说明，蓝色色块（同 NOTE token，更强语义）。

> [!WARNING]
> 这是 WARNING 警告，橙色色块。提示有潜在副作用。

> [!CAUTION]
> 这是 CAUTION 危险，红色色块。说明可能造成严重后果。

## 6. 数学公式（KaTeX）

行内：质能方程 $E=mc^2$ 是相对论核心。

块级（独占一行）：

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

含多行：

$$
\\begin{aligned}
f(x) &= a x^2 + b x + c \\\\
f'(x) &= 2 a x + b
\\end{aligned}
$$

## 7. 智能引号 normalize

原始：“双引号” 和 ‘单引号’ 应该被转成 ASCII。
代码块里 *不* 应被 normalize：

\`\`\`python
print("hello")  # 这里的引号保持原样
\`\`\`

## 8. blockquote（普通，非 callout）

> 这是一段普通 blockquote 引用，验证默认样式仍然正常（左竖线 + 灰字）。

---

收尾。
`

// ── v1.11（2026-06-02）：ReactFlow 调用图样本 ────────────────────────────
// 取自用户实际遇到的 mall-swarm "订单状态流转" 调用链截图，扩展几条边演示分支结构
// 节点 kind 分布：controller(蓝) / service(绿) / mapper(橙)，让 ReactFlow 配色全覆盖
const CALL_CHAIN_SAMPLE: CallChainData = {
  nodes: [
    {
      id: 'n1', label: 'confirmReceiveOrder', kind: 'controller',
      classOf: 'OmsPortalOrderController', sig: '(Long)',
      filePath: 'src/main/java/.../OmsPortalOrderController.java',
      entityId: 'method://com.macro.mall.portal.controller.OmsPortalOrderController#confirmReceiveOrder',
    },
    {
      id: 'n2', label: 'confirmReceiveOrder', kind: 'service',
      classOf: 'OmsPortalOrderService', sig: '(Long)',
    },
    {
      id: 'n3', label: 'create', kind: 'controller',
      classOf: 'OmsPortalOrderReturnApplyController', sig: '(OmsOrderReturnApplyParam)',
    },
    {
      id: 'n4', label: 'create', kind: 'service',
      classOf: 'OmsPortalOrderReturnApplyService', sig: '(OmsOrderReturnApplyParam)',
    },
    {
      id: 'n5', label: 'updateStatus', kind: 'controller',
      classOf: 'OmsOrderReturnApplyController', sig: '(Long, OmsUpdateStatusParam)',
    },
    {
      id: 'n6', label: 'updateStatus', kind: 'service',
      classOf: 'OmsOrderReturnApplyService', sig: '(Long, OmsUpdateStatusParam)',
    },
    {
      id: 'n7', label: 'updateByPrimaryKey', kind: 'mapper',
      classOf: 'OmsOrderReturnApplyMapper',
    },
    {
      id: 'n8', label: '通知用户', kind: 'external',
      classOf: '消息推送服务',
    },
  ],
  edges: [
    { from: 'n1', to: 'n2', label: '触发收货确认' },
    { from: 'n2', to: 'n3', label: '收货后允许退货' },
    { from: 'n3', to: 'n4', label: '提交退货申请' },
    { from: 'n4', to: 'n7', label: '插入退货记录' },
    { from: 'n5', to: 'n6', label: '管理员更新状态' },
    { from: 'n6', to: 'n7', label: '更新退货状态' },
    { from: 'n6', to: 'n8', label: '通知用户结果' },
  ],
}

// 默认 message 对象 — 模拟一条已完成的 assistant 消息
// 只填必需字段（id / session_id / role / content / sections / created_at），其余可选字段不传
const MOCK_MESSAGE: Message = {
  id: 'dev-msg-1',
  session_id: 'dev-session',
  role: 'assistant',
  content: '',
  sections: [
    {
      type: 'overview',
      title: 'Markdown 渲染验证',
      content: SAMPLE_MD,
    },
    // v1.11：call_chain 段 content 是 JSON 字符串 → 前端 tryParseCallChain
    // 命中 → 走 ReactFlow（CallChainFlow 组件）
    {
      type: 'call_chain',
      title: '调用链路（ReactFlow 演示）',
      content: JSON.stringify(CALL_CHAIN_SAMPLE),
    },
    // v1.12（2026-06-02）：chat 路径模拟 —— 非 call_chain 段含 ```reactflow JSON fence
    // 验证 splitDiagramFences 能识别并渲染 ReactFlow 图
    // 这模拟用户在 chat 里追问"用流程图展示出来"时，LLM 自由格式答案内嵌图
    {
      type: 'overview',
      title: 'Chat 路径 ReactFlow fence 演示',
      content:
        '下面是 mall-swarm 退货流程图（chat 自由格式答案中嵌入 ```reactflow JSON）：\n\n' +
        '```reactflow\n' +
        JSON.stringify({
          nodes: [
            { id: 'a1', label: '用户点击申请退货', kind: 'external' },
            { id: 'a2', label: 'create', kind: 'controller', classOf: 'OmsPortalOrderReturnApplyController' },
            { id: 'a3', label: 'create', kind: 'service', classOf: 'OmsPortalOrderReturnApplyService' },
            { id: 'a4', label: 'insert', kind: 'mapper', classOf: 'OmsOrderReturnApplyMapper' },
          ],
          edges: [
            { from: 'a1', to: 'a2', label: '提交退货申请' },
            { from: 'a2', to: 'a3', label: '校验 + 保存' },
            { from: 'a3', to: 'a4', label: '插入退货记录' },
          ],
        }, null, 2) +
        '\n```\n\n' +
        '上面的图通过 ` ```reactflow ` fenced JSON 在 overview 段里渲染，验证 v1.12 全段 fence 识别。',
    },
  ],
  created_at: '2026-06-02T00:00:00.000Z',
}

export function DevMarkdownPreview() {
  return (
    // 最外层用 bg-background 撑满 viewport，避免页面只占内容高度看上去半截
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-[20px] font-semibold mb-2">
          Markdown 渲染 dev preview
        </h1>
        <p className="text-[13px] text-muted-foreground mb-4">
          切换 dark 主题：在 devtools console 跑{' '}
          <code className="bg-muted px-1 py-0.5 rounded">
            document.documentElement.classList.toggle(&apos;dark&apos;)
          </code>
        </p>
        {/* 直接挂 AssistantMessage 渲染 mock message —— 走的就是 chat 真实路径 */}
        <AssistantMessage message={MOCK_MESSAGE} />
      </div>
    </div>
  )
}
