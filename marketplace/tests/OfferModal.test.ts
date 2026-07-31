import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const submitOfferMock = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('useOffers', () => ({ submitOffer: submitOfferMock }))

const OfferModal = (await import('../app/components/OfferModal.vue')).default

// The Headless UI wrappers are Nuxt auto-imported globals; replace them with
// transparent pass-throughs so the form inside the panel is actually rendered.
const passthrough = { template: '<div><slot /></div>' }
const stubs = {
  HeadlessTransitionRoot: passthrough,
  HeadlessTransitionChild: passthrough,
  HeadlessDialog: passthrough,
  HeadlessDialogPanel: passthrough,
  HeadlessDialogTitle: { template: '<h2><slot /></h2>' },
}

const render = () =>
  mount(OfferModal, {
    props: { open: true, listingId: 'listing-1', askingPrice: 45 },
    global: { stubs },
  })

describe('OfferModal', () => {
  beforeEach(() => {
    submitOfferMock.mockReset()
    submitOfferMock.mockResolvedValue(undefined)
  })

  it('renders the title and the asking price as the amount placeholder', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Make an Offer')
    expect(wrapper.find('#offer-amount').attributes('placeholder')).toBe('Asking price: $45.00')
  })

  it('emits close when Cancel is clicked', async () => {
    const wrapper = render()
    await wrapper.find('button[type="button"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('rejects an empty amount without calling the API', async () => {
    const wrapper = render()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitOfferMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please enter a valid offer amount')
  })

  it('rejects an amount below the 0.01 minimum', async () => {
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(0)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitOfferMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please enter a valid offer amount')
  })

  it('submits a valid offer with the listing id and amount', async () => {
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(25.5)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitOfferMock).toHaveBeenCalledWith('listing-1', { amount: 25.5, message: undefined })
  })

  it('includes the message when one is entered', async () => {
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(30)
    await wrapper.find('#offer-message').setValue('Still available?')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitOfferMock).toHaveBeenCalledWith('listing-1', { amount: 30, message: 'Still available?' })
  })

  it('omits an empty message rather than sending an empty string', async () => {
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(30)
    await wrapper.find('#offer-message').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(submitOfferMock).toHaveBeenCalledWith('listing-1', { amount: 30, message: undefined })
  })

  it('emits submitted and close after a successful submission', async () => {
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(25)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('submitted')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('surfaces the API error message and does not emit submitted', async () => {
    submitOfferMock.mockRejectedValue({ data: { error: 'Offer too low' } })
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(1)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Offer too low')
    expect(wrapper.emitted('submitted')).toBeUndefined()
  })

  it('falls back to a generic error when the rejection carries no message', async () => {
    submitOfferMock.mockRejectedValue(new Error('network'))
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(20)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to submit offer')
  })

  it('disables the submit button while the request is in flight', async () => {
    let resolve: () => void = () => {}
    submitOfferMock.mockReturnValue(new Promise<void>((r) => { resolve = r }))

    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(20)
    await wrapper.find('form').trigger('submit')

    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Sending...')

    resolve()
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('re-enables submission after a failure so the buyer can retry', async () => {
    submitOfferMock.mockRejectedValue(new Error('boom'))
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(20)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('clears a previous error when resubmitting', async () => {
    submitOfferMock.mockRejectedValueOnce({ data: { error: 'Offer too low' } })
    const wrapper = render()
    await wrapper.find('#offer-amount').setValue(20)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Offer too low')

    submitOfferMock.mockResolvedValue(undefined)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Offer too low')
  })
})
