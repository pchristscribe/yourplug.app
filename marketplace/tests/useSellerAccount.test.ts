import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.fn()
const getAuthHeadersMock = vi.fn().mockResolvedValue({ Authorization: 'Bearer tok' })
const navigateToMock = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:3001' } }))
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useAuthHeaders', () => ({ getAuthHeaders: getAuthHeadersMock }))
vi.stubGlobal('navigateTo', navigateToMock)

const { useSellerAccount } = await import('../app/composables/useSellerAccount')

describe('useSellerAccount', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigateToMock.mockReset()
  })

  it('fetchStripeStatus stores onboarded/hasAccount on success', async () => {
    fetchMock.mockResolvedValue({ onboarded: true, hasAccount: true })
    const { onboarded, hasAccount, error, fetchStripeStatus } = useSellerAccount()
    await fetchStripeStatus()
    expect(onboarded.value).toBe(true)
    expect(hasAccount.value).toBe(true)
    expect(error.value).toBeNull()
  })

  it('fetchStripeStatus surfaces failures without forcing onboarded=false', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')))
    const { onboarded, error, fetchStripeStatus } = useSellerAccount()
    await fetchStripeStatus()
    expect(error.value).toBe('down')
    // Default state, not silently coerced by the failure
    expect(onboarded.value).toBe(false)
  })

  it('goToOnboarding navigates to the returned URL on success', async () => {
    fetchMock.mockResolvedValue({ url: 'https://stripe.test/onboard' })
    const { goToOnboarding } = useSellerAccount()
    const result = await goToOnboarding()
    expect(result).toEqual({ success: true })
    expect(navigateToMock).toHaveBeenCalledWith('https://stripe.test/onboard', { external: true })
  })

  it('goToOnboarding reports alreadyOnboarded without navigating', async () => {
    fetchMock.mockResolvedValue({ alreadyOnboarded: true })
    const { goToOnboarding } = useSellerAccount()
    const result = await goToOnboarding()
    expect(result).toEqual({ success: true, alreadyOnboarded: true })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('goToOnboarding returns a failure result when the request throws', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('boom')))
    const { goToOnboarding } = useSellerAccount()
    const result = await goToOnboarding()
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('goToOnboarding returns a failure result for an unexpected empty response', async () => {
    fetchMock.mockResolvedValue({})
    const { goToOnboarding } = useSellerAccount()
    const result = await goToOnboarding()
    expect(result).toEqual({ success: false, error: 'Could not start Stripe onboarding. Try again.' })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('fetchStripeStatus falls back to a default message for non-Error rejections', async () => {
    fetchMock.mockImplementation(() => Promise.reject('down'))
    const { error, fetchStripeStatus } = useSellerAccount()
    await fetchStripeStatus()
    expect(error.value).toBe('Failed to load Stripe status')
  })
})
