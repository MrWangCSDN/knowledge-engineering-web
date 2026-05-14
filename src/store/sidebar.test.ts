import { describe, it, expect, beforeEach } from 'vitest'
import { useSidebarStore } from './sidebar'

describe('useSidebarStore', () => {
  beforeEach(() => {
    // 每个 case 前清掉 localStorage 并把 store 重置为默认值
    localStorage.clear()
    useSidebarStore.setState({ recentExpanded: true, projectExpanded: {} })
  })

  it('默认 recentExpanded 为 true', () => {
    expect(useSidebarStore.getState().recentExpanded).toBe(true)
  })

  it('toggleRecent 翻转 recentExpanded', () => {
    useSidebarStore.getState().toggleRecent()
    expect(useSidebarStore.getState().recentExpanded).toBe(false)
    useSidebarStore.getState().toggleRecent()
    expect(useSidebarStore.getState().recentExpanded).toBe(true)
  })

  it('isProjectExpanded 未记录的 id 默认返回 true（默认展开）', () => {
    expect(useSidebarStore.getState().isProjectExpanded('any-project-id')).toBe(true)
  })

  it('toggleProject: 第一次调把展开状态写为 false', () => {
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
  })

  it('toggleProject: 第二次调翻回 true', () => {
    useSidebarStore.getState().toggleProject('p1')
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(true)
  })

  it('多个工程的折叠状态相互独立', () => {
    useSidebarStore.getState().toggleProject('p1')
    expect(useSidebarStore.getState().isProjectExpanded('p1')).toBe(false)
    expect(useSidebarStore.getState().isProjectExpanded('p2')).toBe(true)
  })

  it('折叠状态写入 localStorage（key=ke-sidebar-expanded）', () => {
    useSidebarStore.getState().toggleProject('p1')
    const raw = localStorage.getItem('ke-sidebar-expanded')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    // zustand persist 的格式：{ state: {...}, version: 0 }
    expect(parsed.state.projectExpanded.p1).toBe(false)
  })
})
