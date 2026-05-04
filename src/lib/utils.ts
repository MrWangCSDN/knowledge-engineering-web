import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn/ui 标配工具函数：合并 Tailwind className，自动去重 + 后写覆盖前写。
 *
 * @example
 *   cn('px-2 py-1', condition && 'px-4', 'bg-blue-500')
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
