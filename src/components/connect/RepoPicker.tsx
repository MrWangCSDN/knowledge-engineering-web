/**
 * src/components/connect/RepoPicker.tsx
 *
 * 仓库选择器组件（屏2 核心 UI）。
 *
 * 功能：
 *   - 顶部搜索框：受控输入，按 full_name 内存子串过滤（忽略大小写）
 *   - 列表每行：full_name + 私有徽标 + 右侧状态（已绑定 / 置灰不可绑 / 可点选）
 *   - 已绑定行：不可点，附指向 /project/<bound_project_id> 的小链接
 *   - can_query 行：置灰不可绑，hover 提示需管理员权限
 *   - can_bind 且未绑定行：可点，调用 onSelect(repo)
 *   - 过滤后无结果：显示「无匹配仓库」
 *
 * 主题：全部走 token 类，light + dark 均可读，不硬编码颜色值。
 */

// useState：React 状态 hook，用于控制搜索框的值
import { useState } from 'react'
// Link：react-router-dom 声明式链接组件，会自动加 href
import { Link } from 'react-router-dom'
// Lock 图标：代表「私有仓库」
// Link2 图标：代表「已绑定」跳转链接
// Ban 图标：代表「不可绑定」
import { Lock, Link2, Ban } from 'lucide-react'
// VisibleRepo 类型：来自 src/types/scm.ts
import type { VisibleRepo } from '@/types/scm'

// ── Props 接口 ──────────────────────────────────────────────────────────
// interface：TypeScript 的接口声明，定义组件接受的 props 类型
interface RepoPickerProps {
  // repos：从父组件传入的仓库列表
  repos: VisibleRepo[]
  // onSelect：用户点选某仓库后的回调函数
  // (repo: VisibleRepo) => void 表示：接受一个 VisibleRepo 参数，不返回值
  onSelect: (repo: VisibleRepo) => void
}

/**
 * 仓库选择器。
 *
 * @param repos   可见仓库列表（已由父组件拉取）
 * @param onSelect 点选可绑仓库时的回调
 */
export function RepoPicker({ repos, onSelect }: RepoPickerProps) {
  // query：搜索框的受控状态；初始值为空字符串
  // setQuery 是修改 query 的函数（React 强制通过 setter 修改状态，不允许直接赋值）
  const [query, setQuery] = useState('')

  // 内存过滤：将 query 和 full_name 都小写，做子串匹配
  // filter 是数组方法，保留满足条件的元素，返回新数组
  // toLowerCase()：字符串转小写，实现大小写不敏感搜索
  // includes()：判断字符串是否包含某子串
  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    // 容器：flex 列方向布局，撑开全宽
    <div className="flex flex-col w-full">

      {/* ── 搜索框区域 ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border">
        <input
          type="text"
          // placeholder：输入框没有内容时的提示文字
          placeholder="搜索仓库名…"
          // value 和 onChange 组合：受控组件写法
          // 受控：React state 驱动 input 的值，保证 UI 与状态同步
          value={query}
          // e.target.value：input 元素当前的值
          // onChange 每次按键都触发，实时更新 query 状态
          onChange={e => setQuery(e.target.value)}
          // 样式：全宽 + border + 圆角 + 背景/文字走 token 类
          className="
            w-full px-3 py-1.5 text-sm
            border border-border rounded-md
            bg-background text-foreground placeholder:text-muted-foreground
            focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent
          "
        />
      </div>

      {/* ── 列表区域 ──────────────────────────────────────────────── */}
      {/* 条件渲染：过滤后为空时显示空状态提示，否则渲染列表 */}
      {filtered.length === 0 ? (
        // 空状态：居中提示文字，用 muted-foreground 保证 light/dark 均可读
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          无匹配仓库
        </div>
      ) : (
        // 列表：ul/li 语义标签，逐行渲染
        <ul className="divide-y divide-border">
          {/* map：数组遍历，每个 repo 渲染一个 <li> */}
          {/* key：React 要求列表元素有唯一 key，帮助 diff 算法识别节点 */}
          {filtered.map(repo => (
            <RepoRow key={repo.external_id} repo={repo} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ── 单行组件 ─────────────────────────────────────────────────────────────
// 拆成独立组件让逻辑清晰，避免 RepoPicker 函数体过长

// 单行 props 类型
interface RepoRowProps {
  repo: VisibleRepo
  onSelect: (repo: VisibleRepo) => void
}

/**
 * 单条仓库行。
 *
 * 三种状态：
 *   1. bound===true      → 已绑定（不可点，附跳转链接）
 *   2. scm_role==='can_query' → 置灰不可绑（hover 提示需管理员）
 *   3. scm_role==='can_bind' && !bound → 可点选
 */
function RepoRow({ repo, onSelect }: RepoRowProps) {
  // 判断三种状态，用变量存储，逻辑清晰不重复
  // repo.bound：已绑定标志
  const isBound = repo.bound
  // repo.scm_role：'can_bind' | 'can_query'
  const canBind = !isBound && repo.scm_role === 'can_bind'

  // 行的基础样式：flex 水平布局 + 内边距
  // 根据是否可点切换 cursor 和 hover 效果
  // canBind 时加 cursor-pointer + hover:bg-accent（高亮反馈）
  const rowClass = [
    'flex items-center gap-3 px-4 py-3 transition-colors',
    canBind
      ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
      : 'cursor-default',
    // 不可绑（非已绑定的 can_query）时整行文字置灰
    !isBound && repo.scm_role === 'can_query'
      ? 'opacity-50'
      : '',
  ]
    // join(' ')：把数组里的类名用空格拼成字符串
    // filter(Boolean)：过滤掉空字符串，避免多余空格
    .filter(Boolean)
    .join(' ')

  // 点击整行的处理函数
  function handleClick() {
    // 只有 canBind 状态才触发 onSelect，否则忽略
    if (canBind) {
      onSelect(repo)
    }
  }

  return (
    // li 行：用 onClick 绑定点击；role="button" 配合 canBind 增强可访问性
    // title 属性：can_query 时 hover 显示提示（原生 tooltip）
    <li
      className={rowClass}
      onClick={handleClick}
      // role="button" 和 tabIndex 只给可点击行添加，提升键盘访问性
      // 三元表达式：条件 ? 值A : 值B —— Python 的 A if 条件 else B
      role={canBind ? 'button' : undefined}
      tabIndex={canBind ? 0 : undefined}
      // onKeyDown：键盘 Enter/Space 触发点击（无障碍）
      // Space 分支必须先 preventDefault()，否则浏览器默认行为是向下滚动页面，
      // 导致用户按 Space 选仓时页面跳动，体验差。
      // Enter 没有此问题（Enter 在 role=button 上的默认行为不触发滚动）。
      onKeyDown={canBind ? e => {
        if (e.key === ' ') {
          // preventDefault：阻止 Space 触发的页面滚动默认行为
          e.preventDefault()
          handleClick()
        } else if (e.key === 'Enter') {
          // Enter 不需要 preventDefault
          handleClick()
        }
      } : undefined}
      // title：not-can_bind 时作 tooltip 提示（浏览器原生悬浮文字）
      title={
        repo.scm_role === 'can_query' && !isBound
          ? '需该仓管理员权限才能连接'
          : undefined
      }
    >
      {/* ── 左侧：仓库名 + 标签 ──────────────────────────────── */}
      {/* flex-1 min-w-0 + truncate 防止长名称撑破布局 */}
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        {/* 仓库全名，如 "owner/repo-name" */}
        <span className="text-sm font-medium truncate">{repo.full_name}</span>

        {/* 私有徽标：repo.private === true 时展示 */}
        {/* && 短路运算：左侧为 falsy 时不渲染右侧（React 常用条件渲染技巧） */}
        {repo.private && (
          <span className="
            inline-flex items-center gap-0.5 px-1.5 py-0.5
            text-[11px] font-medium rounded
            bg-muted text-muted-foreground
            border border-border shrink-0
          ">
            {/* Lock 图标：视觉上表示"私有" */}
            <Lock className="h-3 w-3" />
            私有
          </span>
        )}

        {/* 已绑定徽标：仅 bound===true 时展示 */}
        {isBound && (
          <span className="
            inline-flex items-center gap-0.5 px-1.5 py-0.5
            text-[11px] font-medium rounded
            bg-primary/10 text-primary
            border border-primary/20 shrink-0
          ">
            已绑定
          </span>
        )}

        {/* can_query 提示徽标：只查询权限时 */}
        {repo.scm_role === 'can_query' && !isBound && (
          <span className="
            inline-flex items-center gap-0.5 px-1.5 py-0.5
            text-[11px] font-medium rounded
            bg-muted text-muted-foreground
            border border-border shrink-0
          ">
            {/* Ban 图标：不可操作的视觉提示 */}
            <Ban className="h-3 w-3" />
            仅查询
          </span>
        )}
      </div>

      {/* ── 右侧：状态区 ────────────────────────────────────────── */}
      <div className="shrink-0">
        {isBound ? (
          // 已绑定：若有 bound_project_id，显示「查看项目」跳转链接
          // 用 && 保证 bound_project_id 非 null 才渲染
          repo.bound_project_id ? (
            // Link：react-router-dom 的内部链接，不整页刷新
            // stopPropagation：阻止点击冒泡到 li 的 onClick
            <Link
              to={`/project/${repo.bound_project_id}`}
              className="
                flex items-center gap-1 text-[12px] text-primary
                hover:underline
              "
              // 阻止点击事件冒泡到 li，避免触发行点击逻辑
              onClick={e => e.stopPropagation()}
            >
              查看项目
              <Link2 className="h-3 w-3" />
            </Link>
          ) : (
            // 有 bound 但无 bound_project_id 时，仅文字提示
            <span className="text-[12px] text-muted-foreground">
              已绑定
            </span>
          )
        ) : repo.scm_role === 'can_query' ? (
          // can_query：右侧显示原因提示（与 title tooltip 互补，对无鼠标设备友好）
          <span className="text-[12px] text-muted-foreground">
            需管理员权限
          </span>
        ) : (
          // can_bind + 未绑定：右侧显示「选择」提示文字，强化可点击感
          <span className="text-[12px] text-primary font-medium">
            选择
          </span>
        )}
      </div>
    </li>
  )
}
