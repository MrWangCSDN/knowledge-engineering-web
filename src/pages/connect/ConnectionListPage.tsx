/**
 * src/pages/connect/ConnectionListPage.tsx
 *
 * 屏 0/1：GitHub 连接列表页。
 *
 * 功能：
 *   - 列出当前用户的所有 SCM 连接（listConnections）
 *   - 「连接 GitHub」按钮：先获取 App 安装 URL（getInstallUrl），若 403 则先走账号关联（startLinkGithub）
 *   - 每行有「选择仓库」链接跳到 /settings/connections/<id>/select
 *   - loading / empty / error 三态
 *
 * 主题：全部走 token 类（bg-background / text-foreground / text-muted-foreground / border-border），
 * 不硬编码颜色，light + dark 均可读。
 */
import { useState, useEffect } from 'react'
// useNavigate：react-router-dom 提供的命令式跳转 hook
import { useNavigate } from 'react-router-dom'
// Button 组件（shadcn 风格，支持 variant / size prop）
import { Button } from '@/components/ui/button'
// Link 图标 —— provider 徽标用
// 注：lucide-react 当前版本无 Github 品牌图标，用 GitFork 代替
import { Link2, GitFork, ExternalLink, AlertCircle, Inbox } from 'lucide-react'
// API 函数：列出连接、获取 App 安装 URL、先走账号关联
import {
  listConnections,
  getInstallUrl,
  startLinkGithub,
} from '@/api/scm'
// 类型：SCM 连接 DTO
import type { ScmConnection } from '@/types/scm'

export function ConnectionListPage() {
  // connections：当前用户所有 SCM 连接列表
  const [connections, setConnections] = useState<ScmConnection[]>([])
  // loading：挂载时拉取列表的 loading 态
  const [loading, setLoading] = useState(true)
  // busy：点「连接 GitHub」按钮时的 loading 态（按钮禁用防双击）
  const [busy, setBusy] = useState(false)
  // error：非预期错误的文案
  const [error, setError] = useState<string | null>(null)

  // useNavigate：react-router 命令式导航，返回 navigate 函数
  const navigate = useNavigate()

  // useEffect：组件挂载时拉一次连接列表
  // 第二个参数 [] 表示只在 mount 时执行一次，等价于 componentDidMount
  useEffect(() => {
    void fetchConnections()
  }, [])

  /**
   * 拉取连接列表，更新 connections / loading / error。
   * void 前缀：告知 eslint 我们有意不 await 返回值（在 useEffect 里直接调）。
   */
  async function fetchConnections() {
    setLoading(true)
    setError(null)
    try {
      // await：等待 Promise 完成，结果赋值给 conns
      const conns = await listConnections()
      setConnections(conns)
    } catch (e) {
      // (e as Error).message：把 unknown 类型的 catch 参数断言为 Error 取 message
      setError((e as Error).message)
    } finally {
      // finally 块无论成功失败都会执行——确保 loading 最终关掉
      setLoading(false)
    }
  }

  /**
   * 点击「连接 GitHub」的处理函数。
   *
   * 流程：
   *   1. setBusy(true) 禁用按钮防止重复点击
   *   2. 调 getInstallUrl() 获取 GitHub App 安装链接
   *   3. 若抛 403（未关联 GitHub 账号）→ 改调 startLinkGithub() 先走 OAuth 关联流程
   *   4. 其它错误 → setError 展示
   */
  async function handleConnect() {
    setBusy(true)
    setError(null)
    try {
      // 尝试获取 GitHub App 安装 URL
      const { install_url } = await getInstallUrl()
      // window.location.href = url：强制整页跳转（OAuth 外链，不走 SPA 路由）
      window.location.href = install_url
    } catch (err) {
      // err?.response?.status：axios 风格错误对象的 HTTP 状态码
      // 用可选链 ?. 防止 err 不是 axios 错误（普通 Error 对象没有 .response）
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        // 403 = 未关联 GitHub 账号，先走账号绑定 OAuth 流程
        try {
          const { authorize_url } = await startLinkGithub()
          window.location.href = authorize_url
        } catch (linkErr) {
          setError((linkErr as Error).message)
          setBusy(false)
        }
      } else {
        // 其它错误直接展示
        setError((err as Error).message)
        setBusy(false)
      }
    }
  }

  return (
    // max-w-3xl 居中 + px/py 留白，跟其它 settings 页面保持一致
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* 页面头部：标题 + 主操作按钮 */}
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">GitHub 连接</h1>
          {/* text-muted-foreground：辅助说明文字，light/dark 均有对比度 */}
          <p className="mt-1 text-[14px] text-muted-foreground">
            通过 GitHub App 连接账号，授权后可选择要索引的仓库。
          </p>
        </div>

        {/* 主操作按钮：连接 GitHub */}
        <Button
          onClick={() => void handleConnect()}
          disabled={busy}
          className="shrink-0"
        >
          {/* GitFork 图标 —— lucide-react 内置（版本无 Github 品牌图标） */}
          <GitFork className="h-4 w-4 mr-1.5" />
          {/* busy 时显示「连接中…」给用户反馈 */}
          {busy ? '连接中…' : '连接 GitHub'}
        </Button>
      </header>

      {/* 错误提示区域：仅 error 非空时渲染 */}
      {error && (
        <div className="mb-4 px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          {/* AlertCircle：lucide 警告图标 */}
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* 连接列表容器 */}
      <div className="border border-border rounded-xl overflow-hidden">
        {loading ? (
          // loading 态：居中提示文字
          <div className="px-4 py-10 text-center text-muted-foreground text-sm">
            加载中…
          </div>
        ) : connections.length === 0 ? (
          // empty 态：引导用户点上方按钮
          <div className="px-4 py-12 text-center">
            {/* Inbox 图标：表达"空列表"语义 */}
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">还没有 GitHub 连接</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              点击上方「连接 GitHub」开始授权
            </p>
          </div>
        ) : (
          // 连接列表：遍历 connections 数组渲染每一行
          // map 是数组的遍历方法，返回新数组（React 用来渲染列表）
          connections.map(conn => (
            <div
              key={conn.id}
              // flex items-center：弹性布局水平对齐
              className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
            >
              {/* provider 徽标：现阶段只有 github，预留扩展 */}
              <div className="shrink-0">
                {conn.provider === 'github' ? (
                  <GitFork className="h-5 w-5 text-foreground/70" />
                ) : (
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* 账号名 + provider */}
              <div className="flex-1 min-w-0">
                {/* font-medium：中等粗细，显眼但不抢眼 */}
                <div className="font-medium text-[14px] truncate">
                  {/* account_login 可能为 null，退化显示 id 后缀 */}
                  {conn.account_login ?? `连接 #${conn.id.slice(-6)}`}
                </div>
                <div className="text-[12px] text-muted-foreground capitalize">
                  {conn.provider} · {conn.status}
                </div>
              </div>

              {/* 「选择仓库」链接：命令式跳转到仓库选择页 */}
              <button
                type="button"
                onClick={() => navigate(`/settings/connections/${conn.id}/select`)}
                className="
                  flex items-center gap-1 text-[13px] text-primary
                  hover:underline shrink-0
                "
              >
                选择仓库
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
