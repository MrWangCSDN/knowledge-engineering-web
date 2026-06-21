/**
 * src/hooks/useProjectReadyPolling.ts
 *
 * 当前工程非 ready 且 flag 开时，周期重拉 /projects（setInterval+useEffect 范式，
 * 不用 TanStack refetchInterval）。检测 status 由非ready→ready 时调 onReady 一次。
 *
 * 两个 useEffect 职责分离：
 *   - effect#1：转 ready 检测（用 useRef 记上一帧 status，跨 render 比较）
 *   - effect#2：轮询调度（active 时立即拉一次 + setInterval，cleanup 清定时器）
 */
import { useEffect, useRef } from 'react'
import type { ProjectStatus } from '@/types/project'
import { useProjectStore } from '@/store/projects'

// 轮询间隔 5 秒（仿 useAutoRefresh 的常量提取写法）
const POLL_MS = 5000

export function useProjectReadyPolling(
  projectId: string | null | undefined,
  status: ProjectStatus | undefined,
  enabled: boolean,
  onReady?: () => void,
) {
  // useRef 保存上一帧的 status：ref.current 跨 render 持久且改它不触发重渲染，
  // 正好用来在下一帧比较「上一帧非ready / 这一帧ready」这种状态跃迁。
  const prevStatus = useRef<ProjectStatus | undefined>(status)

  // ── effect#1：转 ready 检测 ──────────────────────────────────────────────
  // 仅当「上一帧有值且非 ready」且「当前帧 == ready」时，触发一次 onReady。
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== 'ready' && status === 'ready') {
      // 可选链调用：onReady 没传（undefined）时整表达式短路为 undefined，不报错
      onReady?.()
    }
    // 比较完把当前 status 记成「上一帧」，供下次 render 用
    prevStatus.current = status
  }, [status, onReady])

  // ── effect#2：轮询调度 ──────────────────────────────────────────────────
  useEffect(() => {
    // active 三条件同时成立才轮询：flag 开 + 有工程 id + 当前非 ready
    const active = enabled && !!projectId && status !== 'ready'
    // 不满足直接早返回（不注册定时器，也不返回 cleanup）
    if (!active) return
    // 从 store 取 action 快照（非订阅；轮询场景只需调用，不需订阅 store 变化）
    const fetchProjects = useProjectStore.getState().fetchProjects
    // 立即拉一次，避免首屏要等满 5s 才有数据
    fetchProjects()
    // setInterval 固定间隔重复触发（这里语义就是固定 5s 轮询，故用 interval 而非 timeout）
    const id = setInterval(() => { fetchProjects() }, POLL_MS)
    // cleanup：依赖变化 / 组件卸载时清掉旧定时器，避免泄漏 + 重复轮询
    return () => clearInterval(id)
  }, [enabled, projectId, status])
}
