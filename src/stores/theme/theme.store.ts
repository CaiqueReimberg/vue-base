import { defineStore } from 'pinia'

const THEME_KEY = 'dualpact-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: ((): Theme => {
      if (typeof document !== 'undefined') {
        const attr = document.documentElement.getAttribute('data-theme')
        if (attr === 'light' || attr === 'dark') return attr
      }
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_KEY) as Theme | null
        if (stored === 'light' || stored === 'dark') return stored
      }
      return getSystemTheme()
    })(),
  }),

  getters: {
    isDark(state): boolean {
      return state.theme === 'dark'
    },
  },

  actions: {
    init() {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) as Theme | null : null
      const theme = (stored === 'light' || stored === 'dark') ? stored : getSystemTheme()
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
