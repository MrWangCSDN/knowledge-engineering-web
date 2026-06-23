import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/api/client'
import * as scm from './scm'

vi.mock('@/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const mc = apiClient as unknown as { get: any; post: any; delete: any }

describe('api/scm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listConnections 解包 connections', async () => {
    mc.get.mockResolvedValue({ data: { connections: [{ id: 'c1' }] } })
    expect(await scm.listConnections()).toEqual([{ id: 'c1' }])
    expect(mc.get).toHaveBeenCalledWith('/scm/connections')
  })
  it('getInstallUrl 返回 install_url', async () => {
    mc.get.mockResolvedValue({ data: { install_url: 'https://github.com/apps/x', state: 's' } })
    expect((await scm.getInstallUrl()).install_url).toContain('github.com')
    expect(mc.get).toHaveBeenCalledWith('/scm/github/install-url')
  })
  it('startLinkGithub POST link-scm', async () => {
    mc.post.mockResolvedValue({ data: { authorize_url: 'https://github.com/login/oauth' } })
    expect((await scm.startLinkGithub()).authorize_url).toContain('github.com')
    expect(mc.post).toHaveBeenCalledWith('/account/link-scm/github/start')
  })
  it('completeInstallCallback GET callback 带 params', async () => {
    mc.get.mockResolvedValue({ data: {} })
    await scm.completeInstallCallback({ installation_id: '12', state: 's' })
    expect(mc.get).toHaveBeenCalledWith('/scm/github/callback', { params: { installation_id: '12', state: 's' } })
  })
  it('listVisibleRepos 拼 connId 解包 repos', async () => {
    mc.get.mockResolvedValue({ data: { repos: [{ full_name: 'o/r' }] } })
    expect((await scm.listVisibleRepos('c1'))[0].full_name).toBe('o/r')
    expect(mc.get).toHaveBeenCalledWith('/scm/connections/c1/visible-repos')
  })
  it('listBranches 拼 full_name（不 encode 斜杠）', async () => {
    mc.get.mockResolvedValue({ data: { branches: [{ name: 'main', commit_sha: 'abc' }] } })
    await scm.listBranches('c1', 'org/repo')
    expect(mc.get).toHaveBeenCalledWith('/scm/connections/c1/repos/org/repo/branches')
  })
  it('createProjectBind POST connections/{id}/projects', async () => {
    mc.post.mockResolvedValue({ data: { project_id: 'p', job_id: 'j' } })
    const r = await scm.createProjectBind('c1', { project_id: 'p', name: 'P', repo_external_id: 1, repo_full_name: 'o/r', ref: 'main' })
    expect(mc.post).toHaveBeenCalledWith('/scm/connections/c1/projects', expect.objectContaining({ project_id: 'p' }))
    expect(r.job_id).toBe('j')
  })
  it('getIndexStatus / getSyncHealth / reindex / deleteConnection 路径正确', async () => {
    mc.get.mockResolvedValue({ data: { job_id: 'j', status: 'running', progress: null, error: null } })
    await scm.getIndexStatus('p1'); expect(mc.get).toHaveBeenCalledWith('/projects/p1/index-status')
    mc.get.mockResolvedValue({ data: { project_id: 'p1', status: 'ready', job_counts: {} } })
    await scm.getSyncHealth('p1'); expect(mc.get).toHaveBeenCalledWith('/projects/p1/sync-health')
    mc.post.mockResolvedValue({ data: { job_id: 'j2' } })
    await scm.reindex('p1'); expect(mc.post).toHaveBeenCalledWith('/projects/p1/reindex')
    mc.delete.mockResolvedValue({ data: null })
    await scm.deleteConnection('c1'); expect(mc.delete).toHaveBeenCalledWith('/scm/connections/c1')
  })
})
