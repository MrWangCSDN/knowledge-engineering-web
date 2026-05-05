// 按钮样式变体定义 —— 使用 class-variance-authority (CVA) 库
// CVA 是一个轻量级工具，用于管理 Tailwind CSS 类的条件组合
// 详见：https://cva.style/docs
import { cva, type VariantProps } from 'class-variance-authority'

/**
 * buttonVariants
 *
 * 定义 Button 组件的所有样式变体（variant + size 组合）。
 * 使用 CVA 的 cva() 函数生成类名，避免手写重复的 Tailwind 类。
 *
 * 用法示例：
 *   const styles = buttonVariants({ variant: 'destructive', size: 'lg' })
 *   // 返回一个类名字符串，可直接传给 className
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:opacity-90',
        destructive:
          'bg-destructive text-destructive-foreground hover:opacity-90',
        outline:
          'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:opacity-90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

// 导出 VariantProps 类型，用于在组件 props 接口中定义 variant/size 参数
// 示例：interface ButtonProps extends VariantProps<typeof buttonVariants> {}
export type ButtonVariantProps = VariantProps<typeof buttonVariants>
