/**
 * src/pages/settings/AddRepositoryDialog.tsx
 *
 * 添加仓库对话框 — 两步表单：
 *   Step 1: Git URL + 凭证 + 测试连接
 *   Step 2: 工程 ID / 名称 / domain → 创建
 */
import { useEffect, useState, type FormEvent } from 'react'
import { GitBranch, CheckCircle2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  createAdminProject,
  testConnection,
} from '@/api/admin'
import { listAllCredentials as listCredentials } from '@/api/credentials'
import type {
  TestConnectionResponse,
} from '@/types/admin'
import type { MyCredential as Credential } from '@/types/credential'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type Step = 1 | 2

export function AddRepositoryDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [credentials, setCredentials] = useState<Credential[]>([])

  // Step 1
  const [gitUrl, setGitUrl] = useState('')
  const [credentialId, setCredentialId] = useState<string>('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null)

  // Step 2
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [branch, setBranch] = useState('main')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 打开时拉凭证列表
  useEffect(() => {
    if (!open) return
    void listCredentials().then(setCredentials).catch(() => setCredentials([]))
  }, [open])

  const reset = () => {
    setStep(1)
    setGitUrl('')
    setCredentialId('')
    setTesting(false)
    setTestResult(null)
    setProjectId('')
    setName('')
    setDomain('')
    setBranch('main')
    setSubmitting(false)
    setSubmitError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // ─── Step 1: 测试连接 ───
  const onTest = async () => {
    if (!gitUrl.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testConnection({
        git_url: gitUrl.trim(),
        credential_id: credentialId || null,
      })
      setTestResult(r)
      if (r.ok && r.default_branch) setBranch(r.default_branch)
    } catch (e) {
      setTestResult({ ok: false, error: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  const goNext = () => {
    if (testResult?.ok) {
      setStep(2)
      // 默认从 URL 末段推一个工程 id（用户可改）
      if (!projectId) {
        const match = gitUrl.match(/\/([^/]+?)(\.git)?\/?$/)
        if (match) {
          setProjectId(match[1].toLowerCase().replace(/[^a-z0-9-]/g, '-'))
        }
      }
    }
  }

  // ─── Step 2: 创建 ───
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      await createAdminProject({
        id: projectId.trim(),
        name: name.trim(),
        domain: domain.trim() || null,
        git_url: gitUrl.trim(),
        git_branch: branch.trim() || 'main',
        credential_id: credentialId || null,
      })
      reset()
      onCreated()
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const step1Valid = gitUrl.trim().length >= 4
  const step2Valid =
    /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/.test(projectId) && name.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`添加仓库 (Step ${step}/2)`}
      description={step === 1 ? '连接 Git 仓库并验证凭证' : '填写工程元信息'}
      width="md"
    >
      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="git-url" className="text-[13px] font-medium block mb-1.5">
              仓库 URL *
            </label>
            <input
              id="git-url"
              type="text"
              value={gitUrl}
              onChange={e => {
                setGitUrl(e.target.value)
                setTestResult(null)
              }}
              placeholder="https://github.com/org/repo 或 git@host:org/repo.git"
              maxLength={512}
              required
              className="
                w-full px-3 py-2 text-[14px] font-mono bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
              "
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              支持 HTTPS（推荐，配 PAT）和 SSH（v2.0 凭证支持）
            </p>
          </div>

          <div>
            <label htmlFor="cred-select" className="text-[13px] font-medium block mb-1.5">
              访问凭证（私有仓必填）
            </label>
            <select
              id="cred-select"
              value={credentialId}
              onChange={e => {
                setCredentialId(e.target.value)
                setTestResult(null)
              }}
              className="
                w-full px-3 py-2 text-[14px] bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
              "
            >
              <option value="">无（公开仓库）</option>
              {credentials.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.token_hint}）
                </option>
              ))}
            </select>
            {credentials.length === 0 && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                💡 还没有凭证？先去 <strong>凭证管理</strong> 标签新增 PAT
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={!step1Valid || testing}
            className="w-full"
          >
            {testing ? '测试中…' : '🔍 测试连接'}
          </Button>

          {testResult && (
            <div
              className={`px-3 py-2.5 rounded-lg border text-[13px] ${
                testResult.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.ok ? (
                <>
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    连接成功
                  </div>
                  <div className="mt-1 ml-5 text-[12px] space-y-0.5">
                    <div>默认分支：<code className="font-mono">{testResult.default_branch}</code></div>
                    <div>HEAD commit：<code className="font-mono">{testResult.last_commit?.slice(0, 12)}…</code></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="h-4 w-4" />
                    连接失败
                  </div>
                  <div className="mt-1 ml-5 text-[12px] font-mono whitespace-pre-wrap break-all">
                    {testResult.error}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              取消
            </Button>
            <Button type="button" onClick={goNext} disabled={!testResult?.ok}>
              下一步 →
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="px-3 py-2 bg-muted/40 rounded-lg text-[12px] text-muted-foreground">
            <div className="font-mono break-all">{gitUrl}</div>
            <div className="mt-1 flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              <span>{branch}</span>
            </div>
          </div>

          <div>
            <label htmlFor="proj-id" className="text-[13px] font-medium block mb-1.5">
              工程 ID *
            </label>
            <input
              id="proj-id"
              type="text"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              placeholder="deposit-system"
              pattern="^[a-z][a-z0-9-]{0,62}[a-z0-9]$"
              required
              className="
                w-full px-3 py-2 text-[14px] font-mono bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
              "
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              小写英文 + 数字 + 连字符；URL 用，至少 2 字符
            </p>
          </div>

          <div>
            <label htmlFor="proj-name" className="text-[13px] font-medium block mb-1.5">
              工程名称 *
            </label>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="存款系统"
              maxLength={128}
              required
              className="
                w-full px-3 py-2 text-[14px] bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
              "
            />
          </div>

          <div>
            <label htmlFor="proj-domain" className="text-[13px] font-medium block mb-1.5">
              所属域（可选）
            </label>
            <input
              id="proj-domain"
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="deposit / loan / common / ..."
              maxLength={64}
              className="
                w-full px-3 py-2 text-[14px] bg-background border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-ring
              "
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              用于按域分组展示；同一域的工程会一起出现在工程选择器里
            </p>
          </div>

          {submitError && (
            <div className="px-3 py-2 border border-destructive/30 bg-destructive/10 text-destructive text-[13px] rounded">
              ❌ {submitError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
              ← 上一步
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={!step2Valid || submitting}>
                {submitting ? '创建中…' : '创建仓库'}
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/80 text-center pt-1">
            v1.0：仅保存 git 配置，不实际 clone 也不跑 pipeline；v1.1 上线索引能力
          </p>
        </form>
      )}
    </Modal>
  )
}
