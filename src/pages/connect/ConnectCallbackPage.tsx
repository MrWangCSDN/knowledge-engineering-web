/**
 * src/pages/connect/ConnectCallbackPage.tsx
 *
 * GitHub App 安装回调中转页（R2 关键）。
 *
 * 流程：
 *   1. 从 URL query string 读取 installation_id + state（GitHub 回跳时附带）
 *   2. 调 completeInstallCallback 完成服务端握手（apiClient 自动带 Bearer Token）
 *   3. 再调 listConnections 找到对应连接 → navigate 到 /settings/connections/<id>/select
 *   4. 找不到对应连接 → 回退到 /settings/connections
 *   5. 缺参数 / 调用出错 → 显示错误 + 「返回连接页」链接
 *
 * 此页不需要 SettingsLayout 包裹（纯中转，不展示 settings 导航框）。
 * 路由挂在 <RequireAuth><AppLayout /> 内，需要登录。
 */
import { useState, useEffect, useRef } from 'react'
// useSearchParams：读取 URL query string（?installation_id=...&state=...）
// useNavigate：命令式路由跳转
// Link：声明式链接组件
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
// API 函数：完成安装回调 + 列出连接
import { completeInstallCallback, listConnections } from '@/api/scm'
// 图标
import { AlertCircle, Loader2 } from 'lucide-react'

export function ConnectCallbackPage() {
  // useSearchParams 返回 [searchParams, setSearchParams]
  // searchParams 提供 .get(key) 方法读取 query 参数
  const [sp] = useSearchParams()

  // 从 URL 读取 GitHub 回跳携带的两个参数
  const installation_id = sp.get('installation_id')
  const state = sp.get('state')

  // status：当前处理状态，'loading' | 'error'
  // （成功后立即 navigate，不需要 'success' 态）
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  // errorMsg：出错时展示给用户的文案
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // useNavigate：命令式跳转
  const navigate = useNavigate()

  // useRef：用来防止 React StrictMode 下 useEffect 双调用导致重复请求
  // useRef 的值在组件生命周期内持久，不触发重渲染
  const hasRun = useRef(false)

  // useEffect：组件挂载时执行一次回调处理
  // 依赖数组为空 []，确保只跑一次（生产模式）
  useEffect(() => {
    // StrictMode 保护：已经跑过就不重复跑
    if (hasRun.current) return
    hasRun.current = true

    // 缺少必须参数时直接报错，不发请求
    if (!installation_id || !state) {
      setErrorMsg('缺少必要参数（installation_id / state），请重新从 GitHub 安装页跳转。')
      setStatus('error')
      return
    }

    // void：显式丢弃 Promise（ESLint no-floating-promises 规则）
    void handleCallback()

    /**
     * 实际回调处理逻辑：
     *   1. completeInstallCallback —— 服务端验 state + 写 installation 记录
     *   2. listConnections —— 找到刚创建的连接
     *   3. navigate 到选仓页（replace 模式防止用户按"返回"又触发回调）
     */
    async function handleCallback() {
      try {
        // 第一步：完成服务端握手（POST/GET /scm/github/callback）
        // installation_id 和 state 在上方已经做过 null 检查，这里 as string 是安全的
        await completeInstallCallback({
          installation_id: installation_id as string,
          state: state as string,
        })

        // 第二步：拉取最新连接列表，找到 installation_id 对应的连接
        const conns = await listConnections()

        // Number(installation_id)：把 string 转成 number 再比较
        // c.github_installation_id 是 number | null，所以要 Number() 对齐类型
        const matched = conns.find(
          c => c.github_installation_id === Number(installation_id),
        )

        if (matched) {
          // replace: true —— 用 replace 而非 push，防止用户点"返回"再次触发回调
          navigate(`/settings/connections/${matched.id}/select`, { replace: true })
        } else {
          // 找不到匹配连接 → 回退到连接列表页（也用 replace 避免回调环）
          navigate('/settings/connections', { replace: true })
        }
      } catch (err) {
        // 任何错误（网络 / 服务端 4xx/5xx）→ 显示错误态
        setErrorMsg(
          (err as Error).message || '建立连接失败，请重试或联系管理员。',
        )
        setStatus('error')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 加载态 ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      // 全屏居中：min-h-screen + flex + items-center + justify-center
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        {/* Loader2 + animate-spin：lucide 旋转加载图标 */}
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-[15px]">正在建立连接…</p>
        <p className="text-[13px] text-muted-foreground/70">
          请稍候，正在验证 GitHub 授权并初始化连接。
        </p>
      </div>
    )
  }

  // ── 错误态 ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="max-w-md w-full px-6">
        {/* 错误卡片：用 destructive token 色，light/dark 均可读 */}
        <div className="flex items-start gap-3 px-4 py-4 border border-destructive/30 bg-destructive/10 text-destructive rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[14px]">连接失败</p>
            {/* errorMsg 非空时展示具体原因 */}
            {errorMsg && (
              <p className="mt-1 text-[13px] opacity-90">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* 返回链接：用 Link 组件（声明式），避免整页刷新 */}
        <Link
          to="/settings/connections"
          className="
            text-[14px] text-primary hover:underline
            flex items-center gap-1
          "
        >
          ← 返回连接页
        </Link>
      </div>
    </div>
  )
}
