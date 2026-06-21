/**
 * 集中式 feature flag。读 Vite 注入的 import.meta.env.VITE_* 字符串。
 * flag 默认关：只有显式 'true' 才开，规避后端 status 流转/ backfill 未就绪时误开导致全工程被禁。
 */

/** 可注入 env 以便单测（生产传 import.meta.env）。 */
type EnvLike = Record<string, string | boolean | undefined>

/** 工程状态徽章 + 提问 gating + 轮询 总开关。 */
export function isProjectStatusEnabled(env: EnvLike = import.meta.env): boolean {
  return env.VITE_KE_PROJECT_STATUS === 'true'
}
