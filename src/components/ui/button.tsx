import * as React from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants, type ButtonVariantProps } from './button-variants'

/**
 * shadcn 风格 Button 基类。后续 `npx shadcn@latest add button` 也会生成类似文件。
 * 这里手写一份避免阻塞首次启动；与 shadcn 完全兼容，未来可被覆盖。
 */

// Button 组件的 props 接口 —— 继承 HTML 原生 button 属性 + Button 的自定义 variant/size 属性
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
