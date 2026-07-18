import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AffiliateDisclosure from '../app/components/AffiliateDisclosure.vue'

describe('AffiliateDisclosure', () => {
  it('defaults to the inline variant', () => {
    const wrapper = mount(AffiliateDisclosure)
    expect(wrapper.text()).toContain('This is an affiliate link')
  })

  it('badge variant renders the compact accessible badge', () => {
    const wrapper = mount(AffiliateDisclosure, { props: { variant: 'badge' } })
    const badge = wrapper.find('[aria-label="Affiliate product"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('role')).toBe('note')
    expect(badge.text()).toBe('Affiliate')
  })

  it('inline variant renders the per-link disclosure box', () => {
    const wrapper = mount(AffiliateDisclosure, { props: { variant: 'inline' } })
    expect(wrapper.text()).toContain('Disclosure:')
    expect(wrapper.text()).toContain('at no additional cost to you')
  })

  it('footer variant renders the site-wide FTC disclosure', () => {
    const wrapper = mount(AffiliateDisclosure, { props: { variant: 'footer' } })
    expect(wrapper.text()).toContain('FTC Disclosure:')
    expect(wrapper.text()).toContain('affiliate marketing programs')
  })

  it('only renders one variant\'s content at a time', () => {
    const wrapper = mount(AffiliateDisclosure, { props: { variant: 'badge' } })
    expect(wrapper.text()).not.toContain('FTC Disclosure')
    expect(wrapper.text()).not.toContain('Disclosure:')
  })
})
