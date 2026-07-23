import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const goToOnboardingMock = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('useSellerAccount', () => ({ goToOnboarding: goToOnboardingMock }))

const StripeOnboardBanner = (await import('../app/components/StripeOnboardBanner.vue')).default

const render = (show = true) => mount(StripeOnboardBanner, { props: { show } })

describe('StripeOnboardBanner', () => {
  beforeEach(() => {
    goToOnboardingMock.mockReset()
    goToOnboardingMock.mockResolvedValue({ success: true })
  })

  it('renders nothing when show is false', () => {
    expect(render(false).find('button').exists()).toBe(false)
  })

  it('renders the prompt and button when show is true', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Complete your Stripe setup')
    expect(wrapper.find('button').text()).toBe('Set up payouts')
  })

  it('calls goToOnboarding when the button is clicked', async () => {
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    expect(goToOnboardingMock).toHaveBeenCalledTimes(1)
  })

  it('disables the button and shows a loading label while onboarding is in flight', async () => {
    let resolve: (v: { success: boolean }) => void = () => {}
    goToOnboardingMock.mockReturnValue(new Promise((r) => { resolve = r }))

    const wrapper = render()
    await wrapper.find('button').trigger('click')

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').text()).toBe('Loading…')

    resolve({ success: true })
    await flushPromises()

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('button').text()).toBe('Set up payouts')
  })

  it('shows no error message on success', async () => {
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('surfaces the error returned by goToOnboarding', async () => {
    goToOnboardingMock.mockResolvedValue({ success: false, error: 'Stripe is down' })
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Stripe is down')
  })

  it('falls back to a generic message when the failure carries no error text', async () => {
    goToOnboardingMock.mockResolvedValue({ success: false })
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not start Stripe onboarding')
  })

  it('clears a previous error when retrying', async () => {
    goToOnboardingMock.mockResolvedValue({ success: false, error: 'Stripe is down' })
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    goToOnboardingMock.mockResolvedValue({ success: true })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('re-enables the button after a failure so the seller can retry', async () => {
    goToOnboardingMock.mockResolvedValue({ success: false, error: 'nope' })
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })
})
