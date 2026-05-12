/**
 * src/pages/settings/AddCredentialDialog.tsx
 *
 * 新增凭证对话框 — 单 step 表单。
 *
 * 字段：
 *   name: 人类可读名（如 'My GitLab PAT'）
 *   token: 明文 PAT（提交后服务端加密）
 */
import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createMyCredential as createCredential } from '@/api/credentials'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function AddCredentialDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 关闭时重置表单
  const handleClose = () => {
    setName('')
    setToken('')
    setShowToken(false)
    setError(null)
    onClose()
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || token.length < 8) return
    setSubmitting(true)
    setError(null)
    try {
      await createCredential({ name: name.trim(), token, type: 'pat' })
      // 成功 → 重置 + 通知父刷新
      setName('')
      setToken('')
      setShowToken(false)
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const valid = name.trim().length > 0 && token.length >= 8

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="新增凭证"
      description="保存 Git PAT 用于私有仓库同步。明文不会存数据库，会用 Fernet 对称加密。"
      width="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="cred-name" className="text-[13px] font-medium block mb-1.5">
            名称 *
          </label>
          <input
            id="cred-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="如：My GitLab PAT"
            disabled={submitting}
            maxLength={128}
            required
            className="
              w-full px-3 py-2 text-[14px] bg-background border rounded-lg
              focus:outline-none focus:ring-2 focus:ring-ring
              disabled:opacity-50
            "
          />
          <p className="mt-1 text-[12px] text-muted-foreground">
            人类可读名称；列表里区分多条凭证用
          </p>
        </div>

        <div>
          <label htmlFor="cred-token" className="text-[13px] font-medium block mb-1.5">
            Personal Access Token *
          </label>
          <div className="relative">
            <input
              id="cred-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              disabled={submitting}
              minLength={8}
              maxLength={512}
              required
              autoComplete="off"
              className="
                w-full pl-3 pr-10 py-2 text-[14px] font-mono bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
                disabled:opacity-50
              "
            />
            <button
              type="button"
              onClick={() => setShowToken(s => !s)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              aria-label={showToken ? '隐藏' : '显示'}
              tabIndex={-1}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            GitHub: Settings → Developer settings → Tokens (classic) → repo 权限<br />
            GitLab: Profile → Access Tokens → read_repository 权限
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded">
            ❌ {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" disabled={!valid || submitting}>
            {submitting ? '保存中…' : '保存凭证'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
