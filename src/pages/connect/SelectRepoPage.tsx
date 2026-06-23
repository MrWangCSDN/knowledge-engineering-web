/**
 * src/pages/connect/SelectRepoPage.tsx
 *
 * 屏 2：选择要连接的仓库。
 *
 * 流程：
 *   1. 从 URL params 拿 connId（/settings/connections/:connId/select）
 *   2. useEffect 挂载时调 listVisibleRepos(connId) 拉取可见仓库列表
 *   3. loading / error / empty 三态
 *   4. 正常态：渲染 RepoPicker；用户点选仓库后跳转到绑定页
 *   5. 底部提供「去 GitHub 调整授权范围」外链
 *
 * 主题：全部走 token 类，light + dark 均可读，不硬编码颜色值。
 */

// useState：管理本地异步状态
// useEffect：组件挂载时拉取数据
import { useState, useEffect } from 'react'
// useParams：从当前路由 URL 中提取动态参数（如 :connId）
// useNavigate：命令式跳转，点选仓库后跳到绑定页
import { useParams, useNavigate } from 'react-router-dom'
// AlertCircle：错误提示图标；Inbox：空列表图标；ExternalLink：外链图标
import { AlertCircle, Inbox, ExternalLink } from 'lucide-react'
// listVisibleRepos：调后端 /scm/connections/:id/visible-repos
import { listVisibleRepos } from '@/api/scm'
// VisibleRepo 类型
import type { VisibleRepo } from '@/types/scm'
// RepoPicker：仓库选择器组件
import { RepoPicker } from '@/components/connect/RepoPicker'

/**
 * SelectRepoPage —— 选仓页（屏 2）。
 * 路由匹配：/settings/connections/:connId/select
 */
export function SelectRepoPage() {
  // useParams：解构出 URL 里的 :connId 动态段
  // TypeScript 推断 connId 类型为 string | undefined（路由可能未匹配），
  // 实际上此组件只在匹配时渲染，断言为 string
  const { connId } = useParams<{ connId: string }>()

  // useNavigate：返回 navigate 函数，用于命令式页面跳转
  const navigate = useNavigate()

  // repos：已拉取的可见仓库列表，初始为空数组
  const [repos, setRepos] = useState<VisibleRepo[]>([])
  // loading：拉取中的加载态
  const [loading, setLoading] = useState(true)
  // error：拉取失败时的错误文案
  const [error, setError] = useState<string | null>(null)

  // useEffect：组件挂载时拉取仓库列表
  // 依赖项 [connId]：当 connId 变化时重新拉取（正常情况下不会变，但写好更规范）
  useEffect(() => {
    // 若 connId 不存在（路由未匹配），不拉取
    if (!connId) return

    // void 前缀：明确表示不需要 await 这个 Promise（在 useEffect 里直接调异步函数的惯用法）
    void fetchRepos()

    // fetchRepos 定义在 useEffect 内部，避免暴露到组件外作用域
    async function fetchRepos() {
      setLoading(true)
      setError(null)
      try {
        // await：等待 Promise 完成，赋值给 data
        const data = await listVisibleRepos(connId!)
        // 感叹号 ! 是 TypeScript 非空断言，告诉编译器"我确保 connId 非空"
        setRepos(data)
      } catch (e) {
        // (e as Error).message：把 unknown 类型的 catch 参数断言为 Error
        setError((e as Error).message)
      } finally {
        // finally：无论成功/失败都关闭 loading
        setLoading(false)
      }
    }
  }, [connId]) // 依赖数组：connId 变化时重新执行

  /**
   * 用户点选仓库后的回调。
   * 跳转到绑定页，通过 ?repo= 查询参数传递 external_id。
   *
   * @param repo 用户选中的仓库
   */
  function handleSelect(repo: VisibleRepo) {
    // 模板字符串（反引号）：嵌入变量用 ${} 语法
    // encodeURIComponent 不在这里做，因为 external_id 是数字，不含特殊字符
    navigate(`/settings/connections/${connId}/bind?repo=${repo.external_id}`)
  }

  return (
    // 外层容器：限宽 + 居中 + 内边距，与其他 settings 页保持一致
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* 页面标题 */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">选择要连接的仓库</h1>
        {/* text-muted-foreground：辅助说明，light/dark 均有对比度 */}
        <p className="mt-1 text-[14px] text-muted-foreground">
          选择要索引的 GitHub 仓库，需要有该仓库的管理员权限。
        </p>
      </header>

      {/* 错误提示区域：仅 error 非空时渲染 */}
      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          {/* AlertCircle：lucide 警告图标 */}
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 仓库列表容器：border + 圆角卡片样式 */}
      <div className="border border-border rounded-xl overflow-hidden">
        {loading ? (
          // loading 态：居中提示文字
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">
            加载中…
          </div>
        ) : repos.length === 0 && !error ? (
          // empty 态（无报错、无仓库）：引导用户调整授权
          <div className="px-4 py-12 text-center">
            {/* Inbox 图标：表达"空列表"语义 */}
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">未找到可用仓库</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              请在 GitHub 调整授权范围后刷新
            </p>
          </div>
        ) : (
          // 正常态：渲染 RepoPicker 组件
          // onSelect 传入 handleSelect，点选后跳转到绑定页
          <RepoPicker repos={repos} onSelect={handleSelect} />
        )}
      </div>

      {/* 底部辅助链接：找不到仓库时引导调整授权 */}
      <p className="mt-4 text-[13px] text-muted-foreground">
        找不到仓库？{' '}
        {/* TODO(D1): 用 installation_id 精确到该安装的设置页 */}
        {/* target="_blank"：在新标签页打开外链；rel="noopener"：安全规范，防止新页面访问 window.opener */}
        <a
          href="https://github.com/settings/installations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          去 GitHub 调整授权范围
          {/* ExternalLink 图标：提示这是外链 */}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </p>
    </div>
  )
}
