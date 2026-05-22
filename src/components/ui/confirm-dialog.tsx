/**
 * src/components/ui/confirm-dialog.tsx
 *
 * 通用二次确认对话框 — 基于 Modal 封装。
 *
 * 替代 window.confirm() 的统一 UI 体验：
 *  - 暗色 / 亮色主题一致
 *  - 跨浏览器视觉统一
 *  - 支持 destructive 红色按钮（如「删除」）
 *  - ESC 关闭 + 点遮罩关闭（继承 Modal）
 *
 * 用法：
 *   const [open, setOpen] = useState(false)
 *   <ConfirmDialog
 *     open={open}
 *     onCancel={() => setOpen(false)}
 *     onConfirm={() => { doDelete(); setOpen(false) }}
 *     title="确认删除该对话"
 *     message="此操作不可恢复。"
 *     confirmText="删除"
 *     variant="destructive"
 *   />
 */
import { Modal } from './modal'

interface ConfirmDialogProps {
  /** 是否显示对话框 */
  open: boolean
  /** 取消回调（点取消按钮 / ESC / 点遮罩 都触发） */
  onCancel: () => void
  /** 确认回调（点确定按钮触发；调用方负责关闭对话框） */
  onConfirm: () => void
  /** 标题，默认"确认操作" */
  title?: string
  /** 主提示文案 */
  message: string
  /** 确定按钮文案，默认"确定" */
  confirmText?: string
  /** 取消按钮文案，默认"取消" */
  cancelText?: string
  /** destructive: 确定按钮变红色（如删除场景）；default: 主色 */
  variant?: 'default' | 'destructive'
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'default',
}: ConfirmDialogProps) {
  // destructive variant 用 text-destructive-foreground + bg-destructive；
  // default variant 用项目主色（沿用 Button primary 样式）
  const confirmBtnClass =
    variant === 'destructive'
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      : 'bg-primary text-primary-foreground hover:bg-primary/90'

  return (
    <Modal open={open} onClose={onCancel} title={title} width="sm">
      {/* message 内容区 */}
      <p className="text-[14px] text-foreground/85 mb-5">{message}</p>

      {/* 按钮区：右对齐 */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="
            px-4 py-2 text-sm rounded-md border
            text-foreground hover:bg-muted
            transition-colors
          "
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={(e) => {
            // stopPropagation 防 click 冒泡到外层 Modal 遮罩 onClose（兼容 portal 边界）
            e.stopPropagation()
            onConfirm()
          }}
          className={`
            px-4 py-2 text-sm rounded-md font-medium
            transition-colors
            ${confirmBtnClass}
          `}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
