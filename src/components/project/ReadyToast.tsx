/**
 * src/components/project/ReadyToast.tsx
 *
 * 极简一次性 toast：visible 为 true 时显示，2.5s 自消失由父组件控制（仿 MonacoSnippet）。
 * 颜色走状态色 token（绿系），light/dark 双变体：
 *   - light：text-green-700（深绿，浅底上对比足够）
 *   - dark：text-green-400（亮一档，暗底上对比足够）
 */
interface Props { visible: boolean; projectName: string }

export function ReadyToast({ visible, projectName }: Props) {
  // visible 为 false → 整个组件不渲染（一次性 toast 的最简实现）
  if (!visible) return null
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
                 bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30
                 text-[13px] font-medium shadow-md"
    >
      [{projectName}] 已就绪，可以开始提问了
    </div>
  )
}
