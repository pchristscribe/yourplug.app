import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const signOutMock = vi.fn()
const navigateToMock = vi.fn()
const user = ref<{ email: string } | null>(null)

vi.stubGlobal('useSupabaseClient', () => ({ auth: { signOut: signOutMock } }))
vi.stubGlobal('useSupabaseUser', () => user)
vi.stubGlobal('navigateTo', navigateToMock)

const DefaultLayout = (await import('../app/layouts/default.vue')).default

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const render = () =>
  mount(DefaultLayout, { global: { stubs: { NuxtLink } }, slots: { default: '<p>page body</p>' } })

describe('default layout', () => {
  beforeEach(() => {
    signOutMock.mockReset()
    navigateToMock.mockReset()
    user.value = null
  })

  it('renders the brand and primary navigation', () => {
    const text = render().text()
    expect(text).toContain('Plug Market')
    expect(text).toContain('Browse')
    expect(text).toContain('Sell')
    expect(text).toContain('Dashboard')
  })

  it('renders slotted page content', () => {
    expect(render().text()).toContain('page body')
  })

  it('shows a sign-in link when signed out', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Sign in')
    expect(wrapper.text()).not.toContain('Sign out')
  })

  it('shows the signed-in email and a sign-out button when a user is present', () => {
    user.value = { email: 'seller@example.com' }
    const wrapper = render()
    expect(wrapper.text()).toContain('seller@example.com')
    expect(wrapper.text()).toContain('Sign out')
    expect(wrapper.text()).not.toContain('Sign in')
  })

  it('signs out and redirects to /login', async () => {
    user.value = { email: 'seller@example.com' }
    const wrapper = render()
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('links sign-in to /login', () => {
    const hrefs = render().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/login')
  })
})
