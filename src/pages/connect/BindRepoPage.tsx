/**
 * src/pages/connect/BindRepoPage.tsx
 *
 * 屏 3+4（合一）：选择分支 + 填写工程信息 + 绑定确认。
 *
 * 流程：
 *   1. 从 URL params 拿 connId（/settings/connections/:connId/bind）
 *   2. 从 query string 拿 repo（?repo=<external_id>）
 *   3. useEffect 先调 listVisibleRepos(connId) 找到目标 repo，再调 listBranches 拉分支列表
 *   4. 表单字段：工程名(name)、工程ID(project_id，由 full_name 派生，可改)、分支(ref)、子目录(subpath)
 *   5. 提交：调 createProjectBind → 成功跳 /project/<id>?indexing=1
 *   6. 错误映射：403 / 409 / 502 / 503 / 其它
 *
 * 主题：全部走 token 类，不硬编码颜色值，light + dark 均可读。
 */

// useState：管理多个表单字段和异步状态
// useEffect：挂载时拉数据
import { useState, useEffect, type FormEvent } from 'react'
// useParams：从路由 URL 中取 :connId 动态参数
// useNavigate：命令式跳转
// useSearchParams：读取 URL query string（?repo=42 这部分）
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
// AlertCircle：错误/警告图标；GitBranch：分支图标；ArrowLeft：返回图标
import { AlertCircle, GitBranch, ArrowLeft } from 'lucide-react'
// 自定义 Button 组件（shadcn 风格，走 token 颜色）
import { Button } from '@/components/ui/button'
// API 函数
import { listVisibleRepos, listBranches, createProjectBind } from '@/api/scm'
// 类型
import type { VisibleRepo, ScmBranch } from '@/types/scm'

// ─────────────────────────────────────────────────────────────────────────────
// deriveSlug：从 full_name（如 "macrozheng/mall-swarm"）派生合法的工程 ID slug
//
// 规则（与后端 `^[a-z][a-z0-9-]{0,62}[a-z0-9]$` 对齐）：
//   1. 取 full_name 最后一段（split('/').pop()）
//   2. 转小写
//   3. 非 [a-z0-9-] 的字符替换成 '-'
//   4. 去掉首尾多余的 '-'
//   5. 若首字符是数字，前面加 'r-'（保证首字符是字母）
//   6. 截到 64 字符（后端允许最长 64）
//
// 这是一个纯函数（相同输入总返回相同输出，没有副作用），便于单独测试。
export function deriveSlug(fullName: string): string {
  // split('/')：按 '/' 分割字符串，取最后一段（仓库名部分）
  // pop()：取数组最后一个元素；|| fullName 作为回退（万一 split 结果为空）
  const repoName = fullName.split('/').pop() || fullName

  // toLowerCase()：转小写，满足 slug 只含小写字母的要求
  // replace(/[^a-z0-9-]/g, '-')：把所有非 [a-z0-9-] 字符替换成连字符
  //   [^...]：否定字符集，意思是"不在括号里的字符"
  //   /g flag：全局替换（没有 g 只替换第一个匹配）
  let slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  // replace(/^-+|-+$/g, '')：去掉首尾的连字符
  //   ^-+：以一或多个连字符开头
  //   -+$：以一或多个连字符结尾
  //   | 是正则的"或"
  slug = slug.replace(/^-+|-+$/g, '')

  // 若首字符是数字（\d 匹配 0-9），前面加 'r-' 让首字符变成合法字母
  // /^\d/.test(slug)：test 返回 boolean，检查 slug 是否以数字开头
  if (/^\d/.test(slug)) {
    slug = 'r-' + slug
  }

  // 若经过处理后仍为空（如输入全是特殊字符），给一个默认值
  if (!slug) {
    slug = 'my-project'
  }

  // 截到 64 字符（slice(0, 64) 取前 64 个字符）
  // 同时去掉末尾可能出现的连字符（后端要求末尾必须是 [a-z0-9]）
  slug = slug.slice(0, 64).replace(/-+$/, '')

  // 若截断后变成单字符（后端要求至少 2 字符），末尾补 '0'
  if (slug.length < 2) {
    slug = slug + '0'
  }

  return slug
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapHttpError：把 HTTP 状态码映射成用户友好的中文错误文案。
 *
 * @param status - HTTP 状态码（403 / 409 / 502 / 503 / 其它）
 * @returns 中文错误文案字符串
 */
function mapHttpError(status: number | undefined): string {
  // switch：多分支匹配，比多个 if-else 更清晰
  switch (status) {
    case 403:
      return '你不是该仓的管理员，无法连接'
    case 409:
      return '工程 ID 已存在，换一个'
    case 503:
      return '服务未就绪，稍后重试'
    case 502:
      return 'GitHub 暂时出错，重试'
    default:
      // default：兜底分支，处理所有未列出的状态码
      return '绑定失败，请稍后重试'
  }
}

/**
 * BindRepoPage —— 绑定确认页（屏 3+4 合一）。
 * 路由匹配：/settings/connections/:connId/bind?repo=<repoExternalId>
 */
export function BindRepoPage() {
  // useParams：解构 URL 里的 :connId 参数
  const { connId } = useParams<{ connId: string }>()

  // useNavigate：返回 navigate 函数，用于命令式路由跳转
  const navigate = useNavigate()

  // useSearchParams：返回 [searchParams, setSearchParams] 元组
  //   searchParams 是 URLSearchParams 对象，可用 .get('key') 取值
  const [sp] = useSearchParams()

  // repoExternalId：从 query string 取 repo 参数并转为数字
  // Number()：把字符串转为数字；若参数不存在 sp.get 返回 null，Number(null)=0
  const repoExternalId = Number(sp.get('repo'))

  // ── 加载状态 ──
  // repo：找到的目标仓库（null 表示尚未加载或找不到）
  const [repo, setRepo] = useState<VisibleRepo | null>(null)
  // branches：分支列表
  const [branches, setBranches] = useState<ScmBranch[]>([])
  // loading：初始化加载中
  const [loading, setLoading] = useState(true)
  // loadError：加载过程中的错误文案（null=无错误）
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── 表单状态 ──
  // name：工程名，用户必填
  const [name, setName] = useState('')
  // projectId：工程 ID（slug），由 repo full_name 派生，用户可改
  const [projectId, setProjectId] = useState('')
  // refType：ref 的类型，'branch'（分支下拉）/ 'tag'（文本输入）/ 'commit'（文本输入）
  // 字面量联合类型：只允许这三个字符串值之一，其它值 TypeScript 编译报错
  const [refType, setRefType] = useState<'branch' | 'tag' | 'commit'>('branch')
  // ref：选择的分支名 / tag 名 / commit sha
  const [ref, setRef] = useState('')
  // subpath：monorepo 子目录，可选
  const [subpath, setSubpath] = useState('')

  // ── 提交状态 ──
  // submitting：提交进行中（禁用按钮）
  const [submitting, setSubmitting] = useState(false)
  // submitError：提交失败时的用户友好文案
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── 数据加载 ──
  // useEffect：组件挂载时调 API 加载仓库+分支数据
  // 依赖 [connId, repoExternalId]：这两个值变化时重新加载
  useEffect(() => {
    // repoExternalId 合法性检查：Number(null)=0，Number('abc')=NaN，Number('0')=0
    // 这三种情况均表示 URL query string 参数缺失或非法，与「仓库不存在」区分开
    // isNaN(0) = false，所以 !repoExternalId 足以同时拒绝 0 和 NaN
    if (!connId || !repoExternalId || isNaN(repoExternalId)) {
      // 参数层面的错误（URL 被篡改/直接访问/来源页 bug）→ 引导用户回到选仓页
      setLoadError('链接参数无效，请从选仓页重新进入')
      setLoading(false)
      return
    }

    // void：明确忽略 Promise 返回值（useEffect 回调不能是 async，所以定义内部 async 函数）
    void loadData()

    async function loadData() {
      setLoading(true)
      setLoadError(null)
      try {
        // 第一步：拉取可见仓库列表，找到目标 repo
        const repos = await listVisibleRepos(connId!)
        // Array.find：线性查找满足条件的第一个元素，找不到返回 undefined
        const found = repos.find(r => r.external_id === repoExternalId)

        if (!found) {
          // 已成功加载仓库列表，但列表中不含该 external_id：
          // 说明用户的 GitHub App 授权可能已变更，该仓库已被移除授权范围。
          // 与「URL 参数非法」用不同文案，帮助用户判断是自己操作问题还是权限问题。
          setLoadError('未找到指定仓库，可能已调整授权')
          setLoading(false)
          return
        }

        // 保存找到的 repo
        setRepo(found)

        // 第二步：拉取该仓库的分支列表
        const branchList = await listBranches(connId!, found.full_name)
        setBranches(branchList)

        // 初始化表单默认值
        // ref 默认选 default_branch
        setRef(found.default_branch)
        // project_id 由 full_name 派生（用户可改）
        setProjectId(deriveSlug(found.full_name))
      } catch (e) {
        // 捕获 API 调用失败的错误
        setLoadError((e as Error).message)
      } finally {
        // finally：无论成功/失败都关闭 loading
        setLoading(false)
      }
    }
  }, [connId, repoExternalId]) // 依赖数组

  // ── refType 切换 ──
  /**
   * 切换 ref 类型时重置 ref 值，避免携带上一种类型的残留值。
   * 切到 branch → 恢复 default_branch；切到 tag/commit → 清空，让用户手动输入。
   *
   * @param next - 新选中的 refType 值
   */
  function handleRefTypeChange(next: 'branch' | 'tag' | 'commit') {
    setRefType(next)
    if (next === 'branch') {
      // 切回分支时，恢复 default_branch（repo 此时已加载）
      // repo?.default_branch：可选链，若 repo 为 null 则返回 undefined，|| '' 兜底空字符串
      setRef(repo?.default_branch || '')
    } else {
      // 切到 tag 或 commit 时清空，等用户输入具体值
      setRef('')
    }
  }

  // ── 表单提交 ──
  /**
   * 提交绑定请求。
   * @param e - FormEvent，用于 e.preventDefault() 阻止原生表单提交跳页
   */
  async function handleSubmit(e: FormEvent) {
    // preventDefault：阻止浏览器原生表单提交（会刷新页面）
    e.preventDefault()
    if (!repo || !connId) return

    setSubmitError(null)
    setSubmitting(true)

    try {
      // 调 createProjectBind API，传完整绑定请求体
      // repo.external_id：使用已加载并通过 find() 校验的仓库对象字段，
      // 而非 URL query string 派生的 repoExternalId（Number(sp.get('repo'))）。
      // 这样即使 URL 参数被篡改，实际提交的也是服务端返回的真实 external_id，
      // 与 repo_full_name: repo.full_name 同源，保持一致性。
      const resp = await createProjectBind(connId, {
        project_id: projectId.trim(),
        name: name.trim(),
        repo_external_id: repo.external_id,
        repo_full_name: repo.full_name,
        ref,
        // 把用户选择的 refType 传给后端，之前固定 'branch'，现在动态传入
        ref_type: refType,
        // subpath：空字符串时传 undefined（后端不需要这个字段）
        // || undefined：利用 JavaScript 的短路逻辑，空字符串是 falsy，结果为 undefined
        subpath: subpath.trim() || undefined,
      })

      // 成功：跳转到工程页，带上 indexing=1 参数（提示前端展示索引进度）
      // 模板字符串：用反引号定义，${} 内嵌变量
      navigate(`/project/${resp.project_id}?indexing=1`)
    } catch (e) {
      // 从错误对象中提取 HTTP 状态码
      // (e as { response?: { status?: number } }) 是 TypeScript 类型断言，
      // 把 unknown 类型的 e 断言为带 response.status 字段的对象（axios 错误的结构）
      const status = (e as { response?: { status?: number } }).response?.status
      // 用可选链 ?. 安全访问，status 可能是 undefined（非 HTTP 错误）
      setSubmitError(mapHttpError(status))
    } finally {
      setSubmitting(false)
    }
  }

  // ── 表单有效性验证 ──
  // 正则验证 project_id 格式（与后端一致）
  // /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/ 要求：首字母小写+字母/数字/连字符+末位字母/数字
  const slugValid = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/.test(projectId)
  // refValid：branch 时 ref 由下拉选择总有值；tag/commit 时 ref 为文本输入，需非空
  const refValid = refType === 'branch' ? true : ref.trim().length > 0
  // 表单整体有效：name 非空 + slug 合法 + ref 合法
  const formValid = name.trim().length > 0 && slugValid && refValid

  // ── 渲染 ──
  return (
    // 外层容器：限宽居中 + 内边距，与其他 settings 页一致
    <div className="max-w-2xl mx-auto px-6 py-8">

      {/* 页面标题区 */}
      <header className="mb-6">
        {/* 返回选仓链接 —— loading 和 loadError 时也要展示 */}
        <a
          href={`/settings/connections/${connId}/select`}
          className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-3"
          // onClick 拦截默认跳转，改用 navigate（避免整页刷新）
          onClick={e => { e.preventDefault(); navigate(`/settings/connections/${connId}/select`) }}
        >
          {/* ArrowLeft 图标：表示"返回上一步" */}
          <ArrowLeft className="h-3.5 w-3.5" />
          返回选仓
        </a>
        <h1 className="text-2xl font-semibold">绑定仓库</h1>
        {/* text-muted-foreground：辅助说明文字，light/dark 均可读 */}
        <p className="mt-1 text-[14px] text-muted-foreground">
          配置分支与工程信息，完成连接绑定
        </p>
      </header>

      {/* 加载中态 */}
      {loading && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          加载中…
        </div>
      )}

      {/* 加载错误态 */}
      {loadError && !loading && (
        <div className="space-y-4">
          {/* 错误提示框：border-destructive 系走 token */}
          <div className="px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
            {/* AlertCircle 图标：语义上表示错误 */}
            <AlertCircle className="h-4 w-4 shrink-0" />
            {loadError}
          </div>
          {/* 返回链接 */}
          <Button
            variant="outline"
            onClick={() => navigate(`/settings/connections/${connId}/select`)}
          >
            返回选仓
          </Button>
        </div>
      )}

      {/* 正常态：显示表单 */}
      {!loading && !loadError && repo && (
        <>
          {/* 仓库信息展示卡 */}
          <div className="mb-6 px-4 py-3 bg-muted/40 border border-border rounded-xl text-[13px]">
            {/* font-mono：等宽字体，适合展示仓库名/代码相关内容 */}
            <div className="font-mono font-medium">{repo.full_name}</div>
            <div className="mt-1 flex items-center gap-1 text-muted-foreground">
              {/* GitBranch 图标 */}
              <GitBranch className="h-3.5 w-3.5" />
              <span>默认分支：{repo.default_branch}</span>
            </div>
          </div>

          {/* 绑定表单 */}
          {/* onSubmit：提交时调 handleSubmit；space-y-5：子元素垂直间距 */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* 工程名 */}
            <div>
              <label htmlFor="bind-name" className="text-[13px] font-medium block mb-1.5">
                工程名 *
              </label>
              <input
                id="bind-name"
                type="text"
                value={name}
                // onChange：受控组件模式，每次输入都更新 state
                onChange={e => setName(e.target.value)}
                placeholder="如：商城 Swarm 后端"
                maxLength={128}
                required
                className="
                  w-full px-3 py-2 text-[14px] bg-background border border-border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-ring
                "
              />
            </div>

            {/* 工程 ID */}
            <div>
              <label htmlFor="bind-project-id" className="text-[13px] font-medium block mb-1.5">
                工程 ID *
              </label>
              <input
                id="bind-project-id"
                type="text"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                placeholder="my-service"
                // pattern：HTML5 原生正则校验，浏览器在提交时会检查
                pattern="^[a-z][a-z0-9-]{0,62}[a-z0-9]$"
                required
                className="
                  w-full px-3 py-2 text-[14px] font-mono bg-background border border-border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-ring
                "
              />
              <p className="mt-1 text-[12px] text-muted-foreground">
                小写英文 + 数字 + 连字符；URL 用，至少 2 字符
              </p>
              {/* 实时格式校验提示：当字段非空但格式不合法时显示 */}
              {projectId && !slugValid && (
                <p className="mt-1 text-[12px] text-destructive">
                  格式不合法，需以字母开头，只含 a-z、0-9、-
                </p>
              )}
            </div>

            {/* Ref 类型选择 + Ref 值输入 */}
            <div>
              <span className="text-[13px] font-medium block mb-1.5">
                Ref 类型 *
              </span>
              {/* 三个单选按钮：branch / tag / commit */}
              {/* flex gap-4：横向排列，间距 1rem */}
              <div className="flex gap-4 mb-3">
                {(
                  [
                    { value: 'branch', label: '分支' },
                    { value: 'tag',    label: 'Tag'  },
                    { value: 'commit', label: 'Commit' },
                  ] as const
                  // as const：把数组字面量类型固定为只读元组，value 类型保留字面量而非 string
                ).map(opt => (
                  <label
                    key={opt.value}
                    className="inline-flex items-center gap-1.5 text-[14px] cursor-pointer"
                  >
                    {/* type="radio"：单选；name 相同的 radio 同组互斥 */}
                    <input
                      type="radio"
                      name="ref-type"
                      value={opt.value}
                      // checked：受控组件，当前 refType 与该选项值相等时选中
                      checked={refType === opt.value}
                      // onChange：切换时调 handleRefTypeChange 同步重置 ref
                      onChange={() => handleRefTypeChange(opt.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* 根据 refType 显示不同的输入控件 */}
              {refType === 'branch' ? (
                // ── 分支下拉（原有逻辑保留） ──
                <select
                  id="bind-ref"
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  aria-label="分支"
                  className="
                    w-full px-3 py-2 text-[14px] bg-background border border-border rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-ring
                  "
                >
                  {/* Array.map：把 branches 数组映射为 <option> 元素数组 */}
                  {/* key：React 要求列表元素有唯一 key，以便高效 diff 更新 */}
                  {branches.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                  {/* 若分支列表为空（罕见），至少保留一个默认值可提交 */}
                  {branches.length === 0 && (
                    <option value={repo.default_branch}>{repo.default_branch}</option>
                  )}
                </select>
              ) : (
                // ── Tag / Commit 文本输入 ──
                <input
                  id="bind-ref"
                  type="text"
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  // placeholder：根据 refType 给出不同提示文字
                  placeholder={refType === 'tag' ? '如 v1.0.0' : '完整或短 commit sha'}
                  // aria-label：无障碍语义，让测试也能按名称查找该输入框
                  aria-label={refType === 'tag' ? 'tag' : 'commit sha'}
                  className="
                    w-full px-3 py-2 text-[14px] font-mono bg-background border border-border rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-ring
                  "
                />
              )}
            </div>

            {/* 子目录（可选） */}
            <div>
              <label htmlFor="bind-subpath" className="text-[13px] font-medium block mb-1.5">
                子目录（可选）
              </label>
              <input
                id="bind-subpath"
                type="text"
                value={subpath}
                onChange={e => setSubpath(e.target.value)}
                // placeholder：输入框空时的提示文字，不影响 value
                placeholder="monorepo 子目录，可空，如 mall-portal"
                maxLength={256}
                className="
                  w-full px-3 py-2 text-[14px] font-mono bg-background border border-border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-ring
                "
              />
              <p className="mt-1 text-[12px] text-muted-foreground">
                若仓库是 monorepo，可填入要索引的子目录路径
              </p>
            </div>

            {/* 提交错误提示 */}
            {/* &&：短路求值，submitError 为真（非空）才渲染后面的 JSX */}
            {submitError && (
              <div className="px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {submitError}
              </div>
            )}

            {/* 操作按钮区 */}
            <div className="flex justify-between pt-2">
              {/* 返回按钮：variant="ghost" = 无背景透明按钮 */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/settings/connections/${connId}/select`)}
                disabled={submitting}
              >
                ← 返回
              </Button>

              {/* 提交按钮：disabled 条件：表单无效 OR 提交进行中 */}
              <Button
                type="submit"
                disabled={!formValid || submitting}
              >
                {/* 三目运算符：submitting ? "提交中" : "确认绑定" */}
                {submitting ? '绑定中…' : '确认绑定'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
