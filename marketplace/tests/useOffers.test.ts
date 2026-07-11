import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.fn()
const getAuthHeadersMock = vi.fn().mockResolvedValue({ Authorization: 'Bearer tok' })

vi.stubGlobal('ref', ref)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:3001' } }))
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useAuthHeaders', () => ({ getAuthHeaders: getAuthHeadersMock }))

const { useOffers } = await import('../app/composables/useOffers')

describe('useOffers', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('fetchMyOffers stores results and clears loading', async () => {
    fetchMock.mockResolvedValue([{ id: 'o1', amount: 10 }])
    const { offers, loading, error, fetchMyOffers } = useOffers()
    await fetchMyOffers()
    expect(offers.value).toEqual([{ id: 'o1', amount: 10 }])
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('fetchMyOffers captures failures in error', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('boom')))
    const { error, fetchMyOffers } = useOffers()
    await fetchMyOffers()
    expect(error.value).toBe('boom')
  })

  it('submitOffer posts to the correct endpoint and rethrows on failure', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('rejected')))
    const { error, submitOffer } = useOffers()
    await expect(submitOffer('listing1', { amount: 5 })).rejects.toThrow('rejected')
    expect(error.value).toBe('rejected')
  })

  it('withdrawOffer removes the offer from state on success', async () => {
    fetchMock.mockResolvedValueOnce([{ id: 'o1' }, { id: 'o2' }]).mockResolvedValueOnce(undefined)
    const { offers, fetchMyOffers, withdrawOffer } = useOffers()
    await fetchMyOffers()
    await withdrawOffer('o1')
    expect(offers.value).toEqual([{ id: 'o2' }])
  })

  it('withdrawOffer rethrows and sets error on failure without mutating state', async () => {
    fetchMock.mockResolvedValueOnce([{ id: 'o1' }]).mockImplementationOnce(() => Promise.reject('network down'))
    const { offers, error, fetchMyOffers, withdrawOffer } = useOffers()
    await fetchMyOffers()
    await expect(withdrawOffer('o1')).rejects.toBe('network down')
    expect(error.value).toBe('Failed to withdraw offer')
    expect(offers.value).toEqual([{ id: 'o1' }])
  })

  it('initiateCheckout returns the checkout URL', async () => {
    fetchMock.mockResolvedValue({ checkoutUrl: 'https://stripe.test/session' })
    const { initiateCheckout } = useOffers()
    await expect(initiateCheckout('o1')).resolves.toEqual({ checkoutUrl: 'https://stripe.test/session' })
  })

  it('initiateCheckout rethrows and sets error on failure', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('checkout down')))
    const { error, initiateCheckout } = useOffers()
    await expect(initiateCheckout('o1')).rejects.toThrow('checkout down')
    expect(error.value).toBe('checkout down')
  })
})
