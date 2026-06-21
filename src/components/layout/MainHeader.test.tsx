import { act } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MainHeader } from './MainHeader'
import { useProjectStore } from '@/store/projects'

// flag 强制为开，验证徽章挂载点（生产默认关 → 徽章自身返 null，不影响现状）
vi.mock('@/config/features', () => ({ isProjectStatusEnabled: () => true }))

// MainHeader useEffect 会调 listVisibleGroups()/groups api；mock 成空数组避免真实 HTTP
vi.mock('@/api/groups', () => ({ listVisibleGroups: () => Promise.resolve([]) }))

beforeEach(() => {
  localStorage.clear()
  useProjectStore.setState({
    projects: [],
    currentProjectId: null,
    isLoading: false,
    error: null,
  })
})

async function renderAt(path: string) {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/project/:projectId" element={<MainHeader />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return result
}

describe('MainHeader 工程状态徽章', () => {
  it('非 ready 当前工程 → 顶栏出现徽章', async () => {
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'mall-swarm', status: 'indexing',
        stats: { methods_count: 0, classes_count: 0, interpretation_progress: 0 },
        pipeline_at: null,
      }],
      currentProjectId: 'p1',
    })
    await renderAt('/project/p1')
    expect(screen.getByText('索引中')).not.toBeNull()
  })
})
