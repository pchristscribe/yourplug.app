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

  describe('SSR guards (window is undefined)', () => {
    // Capture real window so we can restore it after each test
    const realWindow = global.window

    beforeEach(() => {
      localStorage.clear()
      document.documentElement.classList.remove('dark')
      vi.stubGlobal('window', undefined)
    })

    afterEach(() => {
      vi.stubGlobal('window', realWindow)
    })

    it('init() returns early and does not update isDark when window is undefined', () => {
      // Put a 'dark' value in storage – init() would normally pick this up
      localStorage.setItem('darkMode', 'dark')
      const { isDark, init } = useDarkMode()

      init()

      // Guard fired: isDark must stay at its initial false value
      expect(isDark.value).toBe(false)
    })

    it('init() does not apply dark class to document when window is undefined', () => {
      localStorage.setItem('darkMode', 'dark')
      const { init } = useDarkMode()

      init()

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('init() does not read localStorage when window is undefined', () => {
      const getItemSpy = vi.spyOn(localStorage, 'getItem')
      const { init } = useDarkMode()

      init()

      expect(getItemSpy).not.toHaveBeenCalled()
    })

    it('applyDarkMode() does not add dark class to document when window is undefined', () => {
      const { toggle } = useDarkMode()

      // toggle() flips isDark then calls applyDarkMode(true); guard should prevent DOM change
      toggle()

      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('applyDarkMode() does not write to localStorage when window is undefined', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem')
      const { toggle } = useDarkMode()

      toggle()

      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('applyDarkMode() does not remove dark class from document when window is undefined', () => {
      // Simulate a pre-existing dark class (e.g. set server-side)
      document.documentElement.classList.add('dark')
      const { isDark, toggle } = useDarkMode()

      // Manually seed isDark as true so toggle goes dark→light
      isDark.value = true
      toggle()

      // Guard fired: existing 'dark' class must remain untouched
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('toggle() still mutates isDark state even when window is undefined', () => {
      const { isDark, toggle } = useDarkMode()

      expect(isDark.value).toBe(false)
      toggle()
      expect(isDark.value).toBe(true)
    })
  })
})
