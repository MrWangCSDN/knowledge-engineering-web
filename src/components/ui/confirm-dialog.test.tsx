import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './confirm-dialog'

describe('ConfirmDialog', () => {
  let onCancel: ReturnType<typeof vi.fn>
  let onConfirm: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onCancel = vi.fn()
    onConfirm = vi.fn()
  })

  it('open=false 时不渲染', () => {
    render(
      <ConfirmDialog
        open={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        message="某操作不可恢复"
      />,
    )
    expect(screen.queryByText('某操作不可恢复')).not.toBeInTheDocument()
  })

  it('open=true 渲染 title + message + 默认两按钮', () => {
    render(
      <ConfirmDialog
        open={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="确认删除"
        message="此操作不可恢复"
      />,
    )
    expect(screen.getByText('确认删除')).toBeInTheDocument()
    expect(screen.getByText('此操作不可恢复')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确定' })).toBeInTheDocument()
  })

  it('未传 title 时显示默认「确认操作」', () => {
    render(
      <ConfirmDialog open={true} onCancel={onCancel} onConfirm={onConfirm} message="..." />,
    )
    expect(screen.getByText('确认操作')).toBeInTheDocument()
  })

  it('支持自定义 confirmText / cancelText', () => {
    render(
      <ConfirmDialog
        open={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
        message="..."
        confirmText="彻底删除"
        cancelText="再想想"
      />,
    )
    expect(screen.getByRole('button', { name: '再想想' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '彻底删除' })).toBeInTheDocument()
  })

  it('点取消按钮调 onCancel', () => {
    render(
      <ConfirmDialog open={true} onCancel={onCancel} onConfirm={onConfirm} message="..." />,
    )
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('点确定按钮调 onConfirm', () => {
    render(
      <ConfirmDialog open={true} onCancel={onCancel} onConfirm={onConfirm} message="..." />,
    )
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('variant="destructive" 时确定按钮带 destructive 样式', () => {
    render(
      <ConfirmDialog
        open={true}
        onCancel={onCancel}
        onConfirm={onConfirm}
        message="..."
        confirmText="删除"
        variant="destructive"
      />,
    )
    const btn = screen.getByRole('button', { name: '删除' })
    // destructive variant 用 bg-destructive class 标识
    expect(btn.className).toContain('bg-destructive')
  })

  it('default variant（不传 variant）时确定按钮无 destructive 样式', () => {
    render(
      <ConfirmDialog open={true} onCancel={onCancel} onConfirm={onConfirm} message="..." />,
    )
    const btn = screen.getByRole('button', { name: '确定' })
    expect(btn.className).not.toContain('bg-destructive')
    expect(btn.className).toContain('bg-primary')
  })
})
