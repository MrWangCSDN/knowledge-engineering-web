import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeStore {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

/**
 * 主题 store：持久化到 localStorage，并同步切换 <html> 的 class。
 * 保持与 src/index.css 中 `.dark` 选择器联动。
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (t) => {
        document.documentElement.classList.toggle('dark', t === 'dark')
        set({ theme: t })
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light'
        get().setTheme(next)
      },
    }),
    {
      name: 'ke-web-theme',
      onRehydrateStorage: () => (state) => {
        // rehydrate 后同步 DOM
        if (state?.theme === 'dark') {
          document.documentElement.classList.add('dark')
        }
      },
    },
  ),
)
