import { defineStore } from 'pinia'

const THEME_KEY = 'dualpact-theme'

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: ((): Theme => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_KEY) as Theme | null
        if (stored === 'light' || stored === 'dark') return stored
      }
      return 'light'
    })(),
  }),

  getters: {
    isDark(state): boolean {
      return state.theme === 'dark'
    },
  },

  actions: {
    init() {
      const stored =
        typeof localStorage !== 'undefined'
          ? (localStorage.getItem(THEME_KEY) as Theme | null)
          : null
      const theme: Theme = stored === 'dark' ? 'dark' : 'light'
      this.theme = theme
      applyTheme(theme)
    },

    toggle() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
      applyTheme(this.theme)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, this.theme)
      }
    },

    setTheme(theme: Theme) {
      this.theme = theme
      applyTheme(theme)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, theme)
      }
    },
  },
})
