/**
 * src/components/auth/BrandPanel.tsx
 *
 * 登录页左侧 brand 区（Layout B — 双列分栏）
 *
 * ── 响应式行为 ──────────────────────────────────────────────────────────────────
 *   ≥ 1024px（Tailwind 的 lg 断点）：占左侧 50% 宽度，全屏高度，显示完整品牌信息
 *   < 1024px：折叠为顶部精简横条，只保留 LOGO + 名称；核心能力列表与 footer 隐藏
 *
 * ── 关于 <aside> ────────────────────────────────────────────────────────────────
 *   aside 是 HTML5 语义化标签，表示"与主内容相关、但相对独立的侧边补充内容"。
 *   视觉上和 <div> 完全相同，但对屏幕阅读器（NVDA / VoiceOver）和 SEO 爬虫更友好。
 *
 * ── 关于颜色策略 ─────────────────────────────────────────────────────────────────
 *   全局工程规则：禁止硬编码颜色值（#fff / rgba(...) / bg-[oklch(...)]）。
 *   所有颜色必须走 CSS 变量（token → var(--xxx) → 组件）。
 *
 *   这里用到两个 BrandPanel 专用 token（定义在 src/index.css）：
 *     --brand-panel-bg：深灰（oklch(0.18 0 0)）— 几乎黑的背景
 *     --brand-panel-fg：纯白（oklch(1 0 0)）   — 前景文字/图标
 *
 *   "永远深色"是有意识的设计选择（Sourcegraph / GitLab / Vercel 登录页同款），
 *   让 light / dark 主题切换不影响 brand 面板外观，加强品牌识别度。
 *
 * ── 关于 oklch 色彩空间 ──────────────────────────────────────────────────────────
 *   oklch(L C H)：
 *     L = Lightness（0 = 纯黑, 1 = 纯白，感知均匀）
 *     C = Chroma（彩度，0 = 无色相/灰色，数值越大越鲜艳）
 *     H = Hue（色相角度，0–360°）
 *   好处：相同的 L 差值在视觉上差距均匀（不像 hex 那样深色区辨识度差），
 *   更容易用数学方式调配色板。现代浏览器（Chrome 111+ / Safari 16.4+）全支持。
 */

// ── 核心能力列表 ──────────────────────────────────────────────────────────────────
// 声明在组件外部：这是一个"模块级常量"，不会随每次渲染重新创建，节省内存。
// const：声明不可重新赋值的变量（数组本身的引用不会变）。
// 这里用 const 而不是 let，明确告诉读代码的人"这个数组不会被替换"。
const FEATURES = [
  '代码 → 知识图谱',
  '4 种 LLM 解读模式',
  '影响分析 + 模式识别',
  '业务问题反向找代码',
]

// ── 组件定义 ──────────────────────────────────────────────────────────────────────
// export function BrandPanel()：
//   - export：导出这个函数，让其他模块可以 import { BrandPanel } from './BrandPanel'
//   - function BrandPanel()：React 函数组件（Function Component）
//     React 会调用这个函数，把返回的 JSX 渲染成真实 DOM。
//   - 这个组件没有 props（不接受外部传参），因为 brand 内容是固定的。
export function BrandPanel() {
  // ── JSX 注意 ──────────────────────────────────────────────────────────────────
  // JSX 看起来像 HTML，但其实是 JavaScript 的语法糖：
  //   <aside className="..."> 会被编译成 React.createElement('aside', { className: '...' })
  // className 而非 class：因为 class 是 JS 保留字，JSX 里统一用 className。
  //
  // JSX 里的注释语法（这段就是例子）：
  //   在 JSX 标签内容区域，注释要写成花括号包裹的 JS 块注释：{/* 注释内容 */}
  //   在 JSX 属性区域或组件定义外，普通 // 和 /* */ 注释都可以用。
  return (
    // ── <aside> 根容器 ────────────────────────────────────────────────────────────
    // Tailwind 类逐行解释：
    //   relative    → position: relative（子元素的绝对定位参考点是这个 aside）
    //   flex        → display: flex（弹性布局，子元素成为 flex item）
    //   flex-col    → flex-direction: column（主轴改为纵向，子元素上下排列）
    //   bg-[var(--brand-panel-bg)] → background-color 使用 CSS 变量 --brand-panel-bg
    //     [var(...)]：Tailwind 的"任意值"语法，方括号里写任意 CSS 值
    //     等价于内联样式 style={{ background: 'var(--brand-panel-bg)' }}，
    //     但用 Tailwind 类便于响应式处理和统一管理。
    //   text-[var(--brand-panel-fg)] → color 使用 CSS 变量 --brand-panel-fg
    //   w-full      → width: 100%（移动端占满宽度）
    //   lg:w-1/2    → 在 >=1024px 时：width: 50%（桌面端占左侧一半）
    //     "lg:" 是 Tailwind 的响应式前缀（mobile-first 设计）：
    //       sm:>=640px / md:>=768px / lg:>=1024px / xl:>=1280px / 2xl:>=1536px
    //       没有前缀 = 移动端优先（默认），加前缀 = 该断点以上才生效
    //   min-h-[180px]   → min-height: 180px（移动端最小高度，作为顶部横条）
    //   lg:min-h-screen → 在 >=1024px 时：min-height: 100vh（桌面端撑满整个视口高度）
    //   p-8             → padding: 2rem（32px，移动端四周内边距）
    //   lg:p-16         → 在 >=1024px 时：padding: 4rem（64px，桌面端更宽松的内边距）
    <aside
      className="
        relative flex flex-col
        bg-[var(--brand-panel-bg)] text-[var(--brand-panel-fg)]
        w-full lg:w-1/2
        min-h-[180px] lg:min-h-screen
        p-8 lg:p-16
      "
    >
      {/* ── LOGO（含品牌图标 + 文字）────────────────────────────────────────────
        这是一张 PNG 图片：左侧是 "<E>" 括号样式的图标（电路 + 节点设计），
        右侧是 "Knowledge Engineering" 文字。这两部分在图片中已经一起设计好。

        ── 关于 public/ 目录 ──────────────────────────────────────────────
        Vite 处理 src/assets/ 下的图片会做 hash 重命名（适合 import 模式）；
        放在 public/ 下，Vite 会原样发布到根 URL，引用直接写 "/logo.png"。
        换句话说：public/logo.png  →  浏览器访问 http://host/logo.png

        ── 关于 <img> 各属性 ───────────────────────────────────────────────
          src         →  图片路径
          alt         →  替代文本：屏幕阅读器读出 + 图片加载失败时显示
                          这是无障碍（a11y）必备属性
          draggable   →  HTML 图片默认可拖动产生 ghost；禁掉避免登录页误操作
          className   →  Tailwind 类：
                          h-14         →  height: 3.5rem（56px，移动端）
                          lg:h-20      →  桌面 height: 5rem（80px）
                          w-auto       →  宽度按原图比例自动算（不变形）
                          select-none  →  禁止文本框选（鼠标拖选不会高亮）
                          mb-4         →  margin-bottom: 1rem（移动端与下方间距）
                          lg:mb-12     →  桌面 margin-bottom: 3rem（更宽松）
      */}
      <img
        src="/logo.png"
        alt="Knowledge Engineering"
        draggable={false}
        className="h-14 lg:h-20 w-auto select-none mb-4 lg:mb-12"
      />

      {/* ── 一句话定位 ──────────────────────────────────────────────────────────────
          <p> 是语义化段落标签，放置产品一句话描述。
          text-base                → font-size: 1rem
          text-[var(...)]/70       → 前景色 70% 不透明（略微降低，层次感）
          leading-relaxed          → line-height: 1.625（行高宽松，中文阅读友好）
          mb-6 / lg:mb-12          → 下方间距（桌面端更大）
          max-w-md                 → max-width: 28rem（限制行宽，避免一行过长难读）
      */}
      <p className="text-base text-[var(--brand-panel-fg)]/70 leading-relaxed mb-6 lg:mb-12 max-w-md">
        把代码仓库变成可检索 / 可解释的知识图谱
      </p>

      {/* ── 核心能力列表（仅 lg 及以上显示）──────────────────────────────────────────
          hidden lg:block：
            hidden   → display: none（默认隐藏，移动端不显示）
            lg:block → 在 >=1024px 时：display: block（桌面端显示出来）
          这是 Tailwind 最常用的"仅大屏显示"模式：先 hidden 隐藏，再 lg:block 还原。
          反过来"仅小屏显示"就是：block lg:hidden
      */}
      <div className="hidden lg:block">
        {/* 小标题："核心能力"
            text-xs          → font-size: 0.75rem（12px）
            uppercase        → text-transform: uppercase（全大写，常见于小标签）
            tracking-wider   → letter-spacing: 0.05em（字间距放宽，配合全大写好看）
            /40              → 40% 不透明（很淡，作为辅助标签）
            mb-4             → 下方间距 1rem
        */}
        <p className="text-xs uppercase tracking-wider text-[var(--brand-panel-fg)]/40 mb-4">
          核心能力
        </p>

        {/* 能力列表
            <ul> 是无序列表标签（Unordered List），语义上表示"一组并列项目"
            space-y-3 → 相邻 <li> 之间的垂直间距 0.75rem（12px）
            text-sm   → font-size: 0.875rem（14px）
        */}
        <ul className="space-y-3 text-sm">
          {/*
            FEATURES.map((f) => (...))：
              .map() 是 JavaScript 数组方法：把数组每个元素变换成新的值。
              这里把每个字符串 f 变成一个 <li> JSX 元素。
              React 会渲染这个数组里所有元素，拼在 <ul> 里。

            key={f}：
              React 在渲染列表时需要 key 属性来高效做 diff（差量更新 DOM）。
              key 必须在同级兄弟元素里唯一。
              这里用能力文字本身作为 key（内容不重复，满足唯一性要求）。
              生产环境通常用 id，但文字稳定的简单列表用文字 key 也可以。

            <li> 内部布局：
              flex items-start gap-2 → 水平弹性布局，顶部对齐，8px 间距
              items-start 而非 items-center：当文字换行时，圆点对齐第一行顶部
          */}
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[var(--brand-panel-fg)]/80">
              {/* 圆点装饰：40% 透明度，比正文更淡，视觉上是"装饰"不是"内容" */}
              <span className="text-[var(--brand-panel-fg)]/40">•</span>
              {/* 能力文字：80% 透明度，略亮于圆点，层次分明 */}
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Footer（仅 lg 及以上显示）──────────────────────────────────────────────
          hidden lg:block → 同上，仅桌面端显示
          absolute        → position: absolute（相对于 <aside> 的 relative 定位）
          bottom-8 left-16 → bottom: 2rem, left: 4rem（定位到左下角）
          text-xs          → font-size: 0.75rem
          /30              → 30% 不透明（极淡，版本号是辅助信息）
      */}
      <div className="hidden lg:block absolute bottom-8 left-16 text-xs text-[var(--brand-panel-fg)]/30">
        v0.1 · 内部工具
      </div>
    </aside>
  )
}
