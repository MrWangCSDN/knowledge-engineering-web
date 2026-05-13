/**
 * src/components/ui/modal.tsx
 *
 * 极简 Modal 组件 — 不依赖额外 shadcn 包。
 * 用 React Portal 渲染到 document.body，避免嵌套层级问题。
 *
 * 用法：
 *   <Modal open={open} onClose={() => setOpen(false)} title="..." width="md">
 *     ...内容...
 *   </Modal>
 */
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  /** sm = 400px / md = 540px / lg = 720px */
  width?: 'sm' | 'md' | 'lg'
}

const WIDTH_MAP = {
  sm: 'max-w-[400px]',
  md: 'max-w-[540px]',
  lg: 'max-w-[720px]',
}

export function Modal({ open, onClose, title, description, children, width = 'md' }: Props) {
  // ESC 关闭 + 锁 body 滚动
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* 内容 */}
      <div
        className={`
          relative w-full ${WIDTH_MAP[width]} max-h-[90vh] overflow-hidden
          bg-background border rounded-xl shadow-2xl
          flex flex-col
        `}
      >
        <header className="flex items-start justify-between p-5 pb-3 shrink-0">
          <div>
            {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
            {description && (
              <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
