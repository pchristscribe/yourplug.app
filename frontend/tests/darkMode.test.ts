import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

const _lsStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => _lsStore[k] ?? null,
  setItem: (k: string, v: string) => { _lsStore[k] = v },
  removeItem: (k: string) => { delete _lsStore[k] },
  clear: () => { for (const k in _lsStore) delete _lsStore[k] },
})

// Mock Nuxt's useState to return a plain Vue ref
vi.stubGlobal('useState', (_key: string, init: () => boolean) => ref(init()))

// Mock window.matchMedia (not available in happy-dom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

import { useDarkMode } from '../app/composables/useDarkMode'

describe('useDarkMode', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  describe('init', () => {
    it('defaults to light mode when nothing is stored and system prefers light', () => {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false })
      const { isDark, init } = useDarkMode()

      init()

      expect(isDark.value).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('enables dark mode when system prefers dark and no stored preference', () => {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true })
      const { isDark, init } = useDarkMode()

      init()

      expect(isDark.value).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('enables dark mode when localStorage is set to "dark"', () => {
      localStorage.setItem('darkMode', 'dark')
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false })
      const { isDark, init } = useDarkMode()

      init()

      expect(isDark.value).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('stays light when localStorage is set to "light" even if system prefers dark', () => {
      localStorage.setItem('darkMode', 'light')
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true })
      const { isDark, init } = useDarkMode()

      init()

      expect(isDark.value).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  describe('toggle', () => {
    it('toggles from light to dark', () => {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false })
      const { isDark, toggle } = useDarkMode()

      expect(isDark.value).toBe(false)
      toggle()

      expect(isDark.value).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(localStorage.getItem('darkMode')).toBe('dark')
    })

    it('toggles from dark to light', () => {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false })
      const { isDark, init, toggle } = useDarkMode()

      localStorage.setItem('darkMode', 'dark')
      init()
      expect(isDark.value).toBe(true)

      toggle()

      expect(isDark.value).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(localStorage.getItem('darkMode')).toBe('light')
    })

    it('persists preference in localStorage on each toggle', () => {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false })
      const { toggle } = useDarkMode()

      toggle()
      expect(localStorage.getItem('darkMode')).toBe('dark')

      toggle()
      expect(localStorage.getItem('darkMode')).toBe('light')
    })
  })
})
