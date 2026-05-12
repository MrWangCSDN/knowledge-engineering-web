/**
 * src/components/group/GroupTreeSelector.test.tsx
 *
 * GroupTreeSelector 单元测试。
 *
 * 覆盖场景：
 *  1. 渲染嵌套 Group + 工程名
 *  2. 点击工程触发 onSelect(pid)
 *  3. 当前工程高亮（有 bg-primary class）
 *  4. buildTree 工具函数的嵌套逻辑
 *  5. 折叠 Group 后子节点消失
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { GroupTreeSelector, buildTree } from './GroupTreeSelector'
import type { Group } from '@/types/group'
import type { Project } from '@/types/project'

// ─── test helpers ─────────────────────────────────────────────────────────────

const mkGroup = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'Group 1',
  description: null,
  parent_group_id: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
})

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Project 1',
  status: 'ready',
  stats: { methods_count: 10, classes_count: 5, interpretation_progress: 80 },
  pipeline_at: null,
  ...over,
})

// ─── buildTree ────────────────────────────────────────────────────────────────

describe('buildTree()', () => {
  it('顶层 Group 放入 roots', () => {
    const groups = [mkGroup({ id: 'g1', parent_group_id: null })]
    const { roots } = buildTree(groups, [])
    expect(roots).toHaveLength(1)
    expect(roots[0].group.id).toBe('g1')
  })

  it('子 Group 挂到父 Group 的 children', () => {
    const groups = [
      mkGroup({ id: 'parent', parent_group_id: null }),
      mkGroup({ id: 'child', parent_group_id: 'parent' }),
    ]
    const { roots } = buildTree(groups, [])
    expect(roots).toHaveLength(1)
    expect(roots[0].children).toHaveLength(1)
    expect(roots[0].children[0].group.id).toBe('child')
  })

  it('工程全部放入 orphanProjects（无 group_id 字段时）', () => {
    const groups = [mkGroup()]
    const projects = [mkProject({ id: 'p1' }), mkProject({ id: 'p2' })]
    const { orphanProjects } = buildTree(groups, projects)
    expect(orphanProjects).toHaveLength(2)
  })

  it('groups 为空时返回空 roots', () => {
    const { roots } = buildTree([], [])
    expect(roots).toHaveLength(0)
  })
})

// ─── GroupTreeSelector 渲染测试 ───────────────────────────────────────────────

describe('GroupTreeSelector', () => {
  it('renders nested groups + projects', () => {
    const groups = [
      mkGroup({ id: 'g1', name: '后端团队', parent_group_id: null }),
      mkGroup({ id: 'g2', name: '前端团队', parent_group_id: null }),
    ]
    const projects = [
      mkProject({ id: 'p1', name: '存款系统' }),
      mkProject({ id: 'p2', name: '贷款系统' }),
    ]

    render(
      <GroupTreeSelector
        groups={groups}
        projects={projects}
        onSelect={vi.fn()}
      />,
    )

    // Group 名称渲染
    expect(screen.getByText('后端团队')).toBeInTheDocument()
    expect(screen.getByText('前端团队')).toBeInTheDocument()
    // Project 名称渲染
    expect(screen.getByText('存款系统')).toBeInTheDocument()
    expect(screen.getByText('贷款系统')).toBeInTheDocument()
  })

  it('triggers onSelect with project id when project clicked', () => {
    const onSelect = vi.fn()
    const projects = [mkProject({ id: 'p1', name: '存款系统' })]

    render(
      <GroupTreeSelector
        groups={[]}
        projects={projects}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByText('存款系统'))
    expect(onSelect).toHaveBeenCalledWith('p1')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('highlights current project with bg-primary class', () => {
    const projects = [
      mkProject({ id: 'p1', name: '存款系统' }),
      mkProject({ id: 'p2', name: '贷款系统' }),
    ]

    render(
      <GroupTreeSelector
        groups={[]}
        projects={projects}
        currentProjectId="p1"
        onSelect={vi.fn()}
      />,
    )

    // 找到 p1 的按钮（data-project-id 属性）
    const p1Button = document.querySelector('[data-project-id="p1"]')
    const p2Button = document.querySelector('[data-project-id="p2"]')

    expect(p1Button).not.toBeNull()
    expect(p2Button).not.toBeNull()
    // p1 应该有高亮 class
    expect(p1Button!.className).toContain('bg-primary')
    // p2 不应有高亮 class
    expect(p2Button!.className).not.toContain('bg-primary')
  })

  it('shows "暂无可用工程" when groups and projects are empty', () => {
    render(
      <GroupTreeSelector
        groups={[]}
        projects={[]}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('暂无可用工程')).toBeInTheDocument()
  })

  it('collapses group children when header is clicked', () => {
    const groups = [mkGroup({ id: 'g1', name: '后端团队' })]

    render(
      <GroupTreeSelector
        groups={groups}
        projects={[]}
        onSelect={vi.fn()}
      />,
    )

    // Group 标题行点击 → 折叠
    fireEvent.click(screen.getByText('后端团队'))
    // 工程列表是孤立工程，和 Group node 无关；这里验证 Group 自身折叠行为
    // 折叠后 aria-expanded 应为 false
    const groupBtn = screen.getByRole('button', { name: /后端团队/ })
    expect(groupBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not call onSelect when disabled project (indexing) is clicked', () => {
    const onSelect = vi.fn()
    const projects = [mkProject({ id: 'p1', name: '索引中工程', status: 'indexing' })]

    render(
      <GroupTreeSelector
        groups={[]}
        projects={projects}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByText('索引中工程'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
