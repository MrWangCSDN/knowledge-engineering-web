/**
 * src/pages/LoginPage.tsx
 *
 * 登录页 —— Layout B 双列分栏装配
 *
 * 这是"页面级组件"，职责只是把更小的 UI 组件装配起来：
 *   - BrandPanel：左侧品牌区
 *   - LoginForm：右侧表单
 *
 * "页面级" vs "可复用组件"：
 *   - 可复用组件（components/）：接受 props，内部状态独立，可在多个页面复用
 *   - 页面级组件（pages/）：直接组合其他组件，通常无 props，负责全局布局 + 路由逻辑
 *
 * 响应式布局：
 *   <1024px：上下堆叠（flex-col），BrandPanel 在顶部变成精简横条
 *   ≥1024px：左右分栏（lg:flex-row），左侧 BrandPanel 占 50%，右侧 main 占 50%
 *
 * ── Tailwind 响应式设计原理 ───────────────────────────────────────────────────
 * Tailwind 采用 mobile-first 策略：
 *   1. 基础类（无前缀）：默认应用于所有屏幕尺寸（从手机开始）
 *   2. 断点前缀：在更大屏幕上生效
 *      sm:>=640px / md:>=768px / lg:>=1024px / xl:>=1280px / 2xl:>=1536px
 *   3. 每个类独立应用，不会相互覆盖（Tailwind 内部用特异度管理）
 *
 * 这里的关键模式是 flex-col 变 lg:flex-row：
 *   - 移动端（默认）：flex-col 意味着 flex-direction: column（上下排列）
 *   - 桌面端（lg:）：flex-row 改为 flex-direction: row（左右排列）
 *
 * ── flex-1 的含义 ──────────────────────────────────────────────────────────────
 * flex-1 → flex: 1 1 0%（简写）
 *   - flex-grow: 1     → 吸收容器剩余空间
 *   - flex-shrink: 1   → 必要时可压缩
 *   - flex-basis: 0%   → 初始大小为 0（相对于其他 flex item，完全由 flex-grow 决定）
 *
 * 在这个布局里：
 *   <main className="flex-1">：右侧 main 容器会吸收 flex 行（或列）中的所有剩余空间
 *   - 移动端：flex-col 行内，main 尽可能高
 *   - 桌面端：flex-row 行内，main 尽可能宽（与 BrandPanel 平分）
 *
 * ── light / dark 主题支持 ────────────────────────────────────────────────────────
 * 所有颜色（bg-background）都走 CSS 变量（token），不允许硬编码 #fff/#000。
 * 全局工程规则要求页面必须同时支持 light 和 dark 主题。
 */

// 导入 BrandPanel 和 LoginForm：这两个组件已经在 src/components/auth/ 目录下完成
// 使用 @/ 别名（配置在 tsconfig 的 compilerOptions.baseUrl 和 paths），
// 可以用绝对路径 import，避免 ../../../ 这样的相对路径地狱
import { BrandPanel } from '@/components/auth/BrandPanel'
import { LoginForm } from '@/components/auth/LoginForm'

/**
 * LoginPage —— 登录页的顶层布局组件
 *
 * 无 props：这个页面没有接收外部参数的需要，所有数据都在子组件（LoginForm）内部管理。
 * 作用：负责整体的响应式布局（左右分栏 vs 上下堆叠）和语义化的 HTML 结构。
 */
export function LoginPage() {
  // ── 外层容器 ──────────────────────────────────────────────────────────────────
  // Tailwind 类解读：
  //   min-h-screen      → min-height: 100vh（最小高度撑满视口，再多内容就会滚动）
  //                       作用：确保只有一屏内容时也能铺满整个窗口，避免底部留空白
  //
  //   flex              → display: flex（启用 flex 布局容器）
  //
  //   flex-col          → flex-direction: column（默认竖向排列）
  //                       移动端上下堆叠：BrandPanel 在上，main 在下
  //
  //   lg:flex-row       → 在 >=1024px 时：flex-direction: row（改为左右排列）
  //                       桌面端：BrandPanel 在左，main 在右
  //
  //   bg-background     → background-color: var(--background)（背景色 token）
  //                       light 模式：#f9fafb 或类似的浅色
  //                       dark 模式：#0f1419 或类似的深色
  //                       通过 CSS 变量自动跟随主题，无需手动处理
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* ── 左侧品牌区 ────────────────────────────────────────────────────────────
          BrandPanel 内部已经处理响应式：
            - 移动端（<1024px）：固定高度 min-h-[180px]，作为顶部横条，隐藏详情列表
            - 桌面端（>=1024px）：min-h-screen，占整个左侧高度，显示完整品牌信息

          这里不需要额外的包装容器，直接放入。
      */}
      <BrandPanel />

      {/* ── 右侧表单容器 ──────────────────────────────────────────────────────────
          <main> 是 HTML5 语义化标签，表示页面的主要内容区域。
          对屏幕阅读器和搜索引擎都有帮助（vs 用无语义的 <div>）。

          Tailwind 类解读：
            flex-1              → 吸收所有剩余空间（见上面的 flex-1 详解）
                                  移动端：flex-col 中占据尽可能多的高度
                                  桌面端：flex-row 中占据尽可能多的宽度

            flex                → display: flex（内部也是 flex 容器，方便子元素居中）
            items-center        → align-items: center（交叉轴居中，这里是垂直居中）
            justify-center      → justify-content: center（主轴居中，这里是水平居中）
                                  combined：content 完全在视口中心

            p-8                 → padding: 2rem（32px 内边距，移动端留白）
            lg:p-16             → 在 >=1024px 时：padding: 4rem（64px 内边距，桌面端更宽松）
                                  让表单和边界有足够距离，视觉更舒展

            bg-background       → 背景色同外层，保持视觉一致（也走主题 token）
      */}
      <main className="flex-1 flex items-center justify-center p-8 lg:p-16 bg-background">
        {/* LoginForm 是 360px max-width 的表单容器，会在我们的 flex 容器中心位置 */}
        <LoginForm />
      </main>
    </div>
  )
}
