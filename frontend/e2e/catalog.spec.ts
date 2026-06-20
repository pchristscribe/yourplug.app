import { test, expect } from '@playwright/test'

test.describe('Product Catalog', () => {
  test('homepage loads and shows title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/yourplug/)
  })

  test('search bar is visible on homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[type="search"], input[placeholder*="Search" i]')).toBeVisible()
  })

  test('product detail route works', async ({ page }) => {
    const response = await page.goto('/products/00000000-0000-0000-0000-000000000000')
    expect(response?.status()).toBeLessThan(500)
  })

  test('seasonal pages load', async ({ page }) => {
    const response = await page.goto('/seasonal/summer')
    expect(response?.status()).toBeLessThan(500)
  })

  test('CSP is present via header or meta tag', async ({ page }) => {
    const response = await page.goto('/')
    const csp = await response?.headerValue('content-security-policy')
    if (!csp) {
      const metaCsp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
      expect(metaCsp).toBeTruthy()
    }
  })
})
