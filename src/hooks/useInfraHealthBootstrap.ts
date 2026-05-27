/**
 * src/hooks/useInfraHealthBootstrap.ts
 *
 * App 顶层 layout mount 时跑一次 fetchHealth，让 InfraBanner 第一时间反映现实。
 * 设计：[[基础设施健康检查与产品不可用-设计]] §4.2
 *
 * 为什么单独抽成 hook？
 *   - 职责分离：layout 组件不直接调 store action，逻辑集中在 hook 里
 *   - 方便测试：mock 这个 hook 比 mock 整个 layout 组件更简单
 *   - 将来如果要加轮询（setInterval）或 visibilitychange 监听，改这里即可
 */

// useEffect：React 内置 hook，用于在组件挂载/更新/卸载时执行副作用
// "副作用"（side effect）= 与渲染无关的操作，如 API 调用、定时器、DOM 操作
import { useEffect } from 'react'

// 从 infra store 导入 hook
// @ 是 Vite 配置的路径别名，指向 src/ 目录，避免写 ../../../../store/infra 这种相对路径
import { useInfraStore } from '@/store/infra'

/**
 * useInfraHealthBootstrap
 *
 * 在调用此 hook 的组件挂载时，触发一次 /health 检查。
 * 无返回值（void hook）：纯副作用，不向组件提供任何状态。
 *
 * 使用方式（在 AppLayout 或根组件里）：
 *   function AppLayout() {
 *     useInfraHealthBootstrap()
 *     return <>{children}</>
 *   }
 */
export function useInfraHealthBootstrap() {
  // useInfraStore(selector)：Zustand 的选择器模式
  // 只订阅 fetchHealth 这一个字段，而不是整个 store
  // 好处：fetchHealth 函数引用不变（Zustand 保证 action 引用稳定），
  //        不会因为 healthy / deps 变化而触发本 hook 所在组件的 re-render
  const fetchHealth = useInfraStore(s => s.fetchHealth)

  // useEffect(callback, deps[])：
  //   - callback：挂载后执行的副作用函数
  //   - deps（依赖数组）：deps 里的值变化时 callback 重新执行
  //   - [fetchHealth]：fetchHealth 引用变化时重跑（实际上永远不变，所以只跑一次）
  //   - 等效于 componentDidMount（类组件时代的写法）
  useEffect(() => {
    // void 关键字：显式丢弃 Promise，告诉 TS "我知道这是异步的，但我不 await"
    // useEffect 的 callback 不能是 async 函数（会返回 Promise，而 React 期望 void | cleanup fn）
    // 所以用 void fetchHealth() 来正确处理 async action
    void fetchHealth()
  }, [fetchHealth])  // eslint-disable-line react-hooks/exhaustive-deps — fetchHealth 引用稳定
}
