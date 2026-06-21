/**
 * src/lib/projectGating.ts
 *
 * 工程状态 → 是否禁用提问 + 禁用时占位文案（纯函数，无副作用）。
 *
 * 只有"无可用接地数据"的状态才禁用：
 *   - indexing：pipeline 还在跑，图/向量库还没数据 → 没法接地回答
 *   - failed：pipeline 报错 → 数据坏了，回答不可信
 * partial 有数据可答（仅警示失真），ready 正常，未知状态兜底放行（不被坏数据锁死用户）。
 *
 * 设计文档：[[工程状态指示-设计]] 提问 gating 部分
 */
import type { ProjectStatus } from '@/types/project'

/**
 * 是否对该工程禁用提问。
 *
 * @param status 工程状态
 * @returns true = 禁用提问（indexing / failed）；其余一律放行
 */
export function isQAGated(status: ProjectStatus): boolean {
  // 显式列出需禁用的两种状态；写成白名单而非黑名单，
  // 这样未来新增状态默认放行（坏数据/未知值不会误锁死用户）。
  return status === 'indexing' || status === 'failed'
}

/**
 * gated 状态下输入框的占位文案。
 *
 * @param status 工程状态
 * @returns 对应的中文占位串；非 gated 状态返回空串（调用方不会用到）
 */
export function gatedPlaceholder(status: ProjectStatus): string {
  // indexing：告知用户在跑、完成后可用
  if (status === 'indexing') return '工程正在索引，完成后即可提问…'
  // failed：告知坏了、需人工介入
  if (status === 'failed') return '工程索引失败，请联系管理员…'
  // 非 gated 状态无占位（理论上不会进入此分支，仅类型完备性兜底）
  return ''
}
