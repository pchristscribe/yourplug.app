import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppModal from '../../app/components/feedback/AppModal.vue'

// Stubbing Teleport renders its content inline, letting wrapper.find() work normally.
// Without this stub, teleported content goes to document.body and is invisible
// to Vue Test Utils' wrapper queries.
const TeleportStub = { template: '<div data-teleport><slot /></div>' }

const mountModal = (props = {}, slots = {}) =>
  mount(AppModal, {
    props: { modelValue: true, title: 'Confirm Action', ...props },
    slots: { default: '<p>Are you sure?</p>', ...slots },
    global: { stubs: { Teleport: TeleportStub } },
  })

describe('AppModal', () => {
  // ─── Visibility ───────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('is not visible when modelValue is false', () => {
      const wrapper = mount(AppModal, {
        props: { modelValue: false, title: 'Test' },
        slots: { default: 'body' },
        global: { stubs: { Teleport: TeleportStub } },
      })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('is visible when modelValue is true', () => {
      const wrapper = mountModal()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })
  })

  // ─── Content ──────────────────────────────────────────────────────────────

  describe('content', () => {
    it('renders the title', () => {
      const wrapper = mountModal({ title: 'Delete Product' })
      expect(wrapper.text()).toContain('Delete Product')
    })

    it('renders default slot content', () => {
      const wrapper = mountModal({}, { default: '<p>Custom body</p>' })
      expect(wrapper.text()).toContain('Custom body')
    })

    it('renders footer slot when provided', () => {
      const wrapper = mountModal({}, {
        default: 'body',
        footer: '<button>Confirm</button><button>Cancel</button>',
      })
      expect(wrapper.text()).toContain('Confirm')
      expect(wrapper.text()).toContain('Cancel')
    })

    it('does not render footer area when footer slot is absent', () => {
      const wrapper = mountModal()
      // Footer div has border-t and justify-end — only present when slot is provided
      const footerDivs = wrapper.findAll('.justify-end')
      expect(footerDivs).toHaveLength(0)
    })
  })

  // ─── Accessibility ────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      expect(mountModal().find('[role="dialog"]').exists()).toBe(true)
    })

    it('has aria-modal="true"', () => {
      expect(mountModal().find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    })

    it('has tabindex="-1" on the panel to accept programmatic focus', () => {
      expect(mountModal().find('[role="dialog"]').attributes('tabindex')).toBe('-1')
    })

    it('has aria-labelledby pointing to the title element', () => {
      const wrapper = mountModal({ title: 'My Modal' })
      const dialog = wrapper.find('[role="dialog"]')
      const labelId = dialog.attributes('aria-labelledby')
      expect(labelId).toBeTruthy()
      expect(wrapper.find(`#${labelId}`).exists()).toBe(true)
      expect(wrapper.find(`#${labelId}`).text()).toBe('My Modal')
    })
  })

  // ─── Close interactions ───────────────────────────────────────────────────

  describe('close interactions', () => {
    it('emits update:modelValue false when the X button is clicked', async () => {
      const wrapper = mountModal()
      await wrapper.find('button[aria-label="Close dialog"]').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('emits update:modelValue false when Escape is pressed on the modal container', async () => {
      const wrapper = mountModal()
      // @keydown="onKeydown" is on the .fixed.inset-0 wrapper div
      await wrapper.find('.fixed.inset-0').trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('emits update:modelValue false when overlay is clicked (closeOnOverlay=true)', async () => {
      const wrapper = mountModal()
      await wrapper.find('[aria-hidden="true"]').trigger('click')
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('does NOT emit close when overlay is clicked with closeOnOverlay=false', async () => {
      const wrapper = mountModal({ closeOnOverlay: false })
      await wrapper.find('[aria-hidden="true"]').trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  // ─── Size variants ────────────────────────────────────────────────────────

  describe('size variants', () => {
    it.each([
      ['sm', 'max-w-sm'],
      ['md', 'max-w-md'],
      ['lg', 'max-w-2xl'],
    ] as const)('size="%s" applies class "%s" to the panel', (size, expected) => {
      const wrapper = mountModal({ size })
      expect(wrapper.find('[role="dialog"]').classes()).toContain(expected)
    })

    it('defaults to max-w-md when size is not provided', () => {
      expect(mountModal().find('[role="dialog"]').classes()).toContain('max-w-md')
    })
  })

  // ─── Focus management ─────────────────────────────────────────────────────

  describe('focus management', () => {
    it('Tab key does not throw when fired on the modal container', async () => {
      const wrapper = mountModal({}, { default: '<button>First</button><button>Second</button>' })
      await expect(
        wrapper.find('.fixed.inset-0').trigger('keydown', { key: 'Tab', shiftKey: false })
      ).resolves.not.toThrow()
    })

    it('Shift+Tab does not throw when fired on the modal container', async () => {
      const wrapper = mountModal({}, { default: '<button>First</button><button>Second</button>' })
      await expect(
        wrapper.find('.fixed.inset-0').trigger('keydown', { key: 'Tab', shiftKey: true })
      ).resolves.not.toThrow()
    })
  })
})
