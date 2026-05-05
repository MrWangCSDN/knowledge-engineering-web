/**
 * src/hooks/useAutoRefresh.ts
 *
 * 自定义 hook —— 在 access_token 过期前主动续期
 *
 * 什么是 hook：
 *   函数名以 use 开头的函数（约定，不是关键字），可以在内部调用其他 hook
 *   （useState / useEffect 等）。组件 + 自定义 hook 之外不能调用 hook。
 *
 * 为什么需要主动续期：
 *   - access_token TTL 60 分钟；如果只靠 401 触发续期，用户在第 60 分钟点击会有"卡顿"
 *   - 主动在第 55 分钟换 token，用户全程无感
 *
 * setTimeout vs setInterval：
 *   - setInterval 是固定间隔重复，不适合 TTL 不固定的场景
 *   - setTimeout 是一次性，token 更新后通过 useEffect 依赖触发重新调度，更精准
 */
import { useEffect } from 'react'
import { refresh as apiRefresh } from '@/api/auth'
import { useAuthStore } from '@/store/auth'

// 提前 5 分钟续期 —— 留缓冲应对网络延迟
const PRE_EXPIRE_MS = 5 * 60 * 1000

export function useAutoRefresh() {
  // 用 selector 写法只订阅 expires-at 变化（其他字段变不会重跑 effect）
  const accessTokenExpiresAt = useAuthStore((s) => s.accessTokenExpiresAt)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const clear = useAuthStore((s) => s.clear)

  useEffect(() => {
    // 未登录：不调度
    if (!accessTokenExpiresAt) return

    // 距离"提前 5 分钟"还剩多少毫秒
    const ms = accessTokenExpiresAt - Date.now() - PRE_EXPIRE_MS

    // tryRefresh 是闭包：捕获外层 setAccessToken/clear 引用
    async function tryRefresh() {
      try {
        const { access_token, expires_in } = await apiRefresh()
        // 写新 token → store 变化 → 本 effect 依赖触发 → 重新 schedule
        setAccessToken(access_token, expires_in)
      } catch {
        // refresh 失败（cookie 过期等）→ 清状态
        clear()
      }
    }

    // 已经在续期窗口内：立即试
    if (ms <= 0) {
      tryRefresh()
      return
    }

    // 否则 N ms 后试
    const t = setTimeout(tryRefresh, ms)

    // cleanup：组件卸载 / expires-at 变化时清旧定时器
    return () => clearTimeout(t)
  }, [accessTokenExpiresAt, setAccessToken, clear])
}
