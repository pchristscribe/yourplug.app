export const useDarkMode = () => {
  const isDark = useState<boolean>('darkMode', () => false)

  const applyDarkMode = (dark: boolean) => {
    if (typeof window === 'undefined') return
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', dark ? 'dark' : 'light')
  }

  const toggle = () => {
    isDark.value = !isDark.value
    applyDarkMode(isDark.value)
  }

  const init = () => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('darkMode')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark)
    isDark.value = shouldBeDark
    applyDarkMode(shouldBeDark)
  }

  return { isDark, toggle, init }
}
