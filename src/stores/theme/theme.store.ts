import { defineStore } from 'pinia'

const THEME_KEY = 'dualpact-theme'
const PRIVACY_KEY = 'dualpact-privacy-values'

export type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

function applyPrivacy(hideValues: boolean) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dp-hide-values', hideValues)
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
    hideValues: ((): boolean => {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(PRIVACY_KEY) === '1'
      }
      return false
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

      const storedPrivacy =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(PRIVACY_KEY) === '1'
          : false
      this.hideValues = storedPrivacy
      applyPrivacy(storedPrivacy)
    },

    togglePrivacy() {
      this.hideValues = !this.hideValues
      applyPrivacy(this.hideValues)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PRIVACY_KEY, this.hideValues ? '1' : '0')
      }
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
