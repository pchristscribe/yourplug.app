import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModerationBadge from '../app/components/ModerationBadge.vue'
import type { ModerationDecision } from '../app/types/listings'

const render = (status: ModerationDecision) =>
  mount(ModerationBadge, { props: { status } })

describe('ModerationBadge', () => {
  it.each([
    ['PENDING', 'Under Review'],
    ['APPROVED', 'Approved'],
    ['REJECTED', 'Rejected'],
    ['FLAGGED', 'Flagged'],
  ] as const)('renders the %s label as "%s"', (status, label) => {
    expect(render(status).text()).toBe(label)
  })

  it('applies the status-specific colour class', () => {
    expect(render('APPROVED').classes().join(' ')).toContain('text-green-800')
    expect(render('REJECTED').classes().join(' ')).toContain('text-brand')
  })

  it('always applies the shared pill classes', () => {
    const classes = render('PENDING').classes()
    expect(classes).toContain('rounded-pill')
    expect(classes).toContain('text-xs')
  })

  it('falls back to the raw value for an unrecognised status', () => {
    // Guards the `?? props.status` branch — an enum value added server-side
    // before the client knows about it should still render legibly.
    const wrapper = render('MYSTERY' as ModerationDecision)
    expect(wrapper.text()).toBe('MYSTERY')
  })

  it('applies no colour class for an unrecognised status', () => {
    const wrapper = render('MYSTERY' as ModerationDecision)
    expect(wrapper.classes().join(' ')).not.toContain('bg-green-100')
  })

  it('updates when the status prop changes', async () => {
    const wrapper = render('PENDING')
    await wrapper.setProps({ status: 'FLAGGED' })
    expect(wrapper.text()).toBe('Flagged')
  })

  it('is SSR-safe: renders via the server renderer without browser globals', async () => {
    const { createSSRApp } = await import('vue')
    const { renderToString } = await import('vue/server-renderer')
    const html = await renderToString(createSSRApp(ModerationBadge, { status: 'APPROVED' }))
    expect(html).toContain('Approved')
  })
})
