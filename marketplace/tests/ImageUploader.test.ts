import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

const parseExifMock = vi.fn()
vi.mock('exifr', () => ({ parse: parseExifMock }))

const fetchMock = vi.fn()
const getSessionMock = vi.fn()

vi.stubGlobal('ref', ref)
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api.test' } }))
vi.stubGlobal('useSupabaseClient', () => ({ auth: { getSession: getSessionMock } }))

const ImageUploader = (await import('../app/components/ImageUploader.vue')).default

const UPLOADED = { id: 'img-1', publicUrl: 'https://cdn/img.jpg', storagePath: 'listings/img.jpg' }

const file = (name: string, type: string) => new File(['x'], name, { type })

const render = (uploaded: typeof UPLOADED[] = []) =>
  mount(ImageUploader, { props: { listingId: 'listing-1', uploaded } })

// Drives the hidden file input, which is what a real "browse" selection does.
async function selectFiles(wrapper: ReturnType<typeof render>, files: File[]) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('ImageUploader', () => {
  beforeEach(() => {
    parseExifMock.mockReset()
    fetchMock.mockReset()
    getSessionMock.mockReset()
    // No EXIF by default — the component treats this as "proceed".
    parseExifMock.mockResolvedValue(undefined)
    fetchMock.mockResolvedValue(UPLOADED)
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })

  it('renders the drop-zone guidance', () => {
    expect(render().text()).toContain('Drop photos here')
  })

  it('renders uploaded thumbnails', () => {
    const wrapper = render([UPLOADED])
    expect(wrapper.find('img').attributes('src')).toBe(UPLOADED.publicUrl)
  })

  it('emits remove with the image id when the remove button is clicked', async () => {
    const wrapper = render([UPLOADED])
    await wrapper.find('button[aria-label="Remove photo"]').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['img-1'])
  })

  it('uploads an accepted file and emits uploaded', async () => {
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg')])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/consignment/seller/listings/listing-1/images')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toEqual({ Authorization: 'Bearer tok' })
    expect(wrapper.emitted('uploaded')?.[0]).toEqual([UPLOADED])
  })

  it('sends no Authorization header when there is no session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg')])
    expect(fetchMock.mock.calls[0][1].headers).toEqual({})
  })

  it('rejects a disallowed MIME type without calling the API', async () => {
    const wrapper = render()
    await selectFiles(wrapper, [file('doc.pdf', 'application/pdf')])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('"doc.pdf" is not an accepted type')
  })

  it('enforces the MIME allow-list on drop, which bypasses the input accept filter', async () => {
    const wrapper = render()
    await wrapper.find('div.border-dashed').trigger('drop', {
      dataTransfer: { files: [file('evil.svg', 'image/svg+xml')] },
    })
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('not an accepted type')
  })

  it('uploads a valid dropped file', async () => {
    const wrapper = render()
    await wrapper.find('div.border-dashed').trigger('drop', {
      dataTransfer: { files: [file('a.webp', 'image/webp')] },
    })
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('warns and skips upload when EXIF shows the photo is older than 15 minutes', async () => {
    // Relative to real time and with no OffsetTimeOriginal, so the component
    // compares the raw date and the result does not depend on the host timezone.
    parseExifMock.mockResolvedValue({ DateTimeOriginal: new Date(Date.now() - 30 * 60 * 1000) })

    const wrapper = render()
    await selectFiles(wrapper, [file('old.jpg', 'image/jpeg')])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('minutes ago')
    expect(wrapper.text()).toContain('within the last 15 minutes')
  })

  it('uploads when EXIF shows the photo is recent', async () => {
    parseExifMock.mockResolvedValue({ DateTimeOriginal: new Date(Date.now() - 60 * 1000) })
    const wrapper = render()
    await selectFiles(wrapper, [file('fresh.jpg', 'image/jpeg')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-anchors the capture time when an explicit EXIF UTC offset is present', async () => {
    // Exercises the OffsetTimeOriginal branch: exifr yields a local-time Date,
    // which the component cancels out before re-anchoring to the recorded offset.
    parseExifMock.mockResolvedValue({
      DateTimeOriginal: new Date(Date.now() - 60 * 60 * 1000),
      OffsetTimeOriginal: '+05:30',
    })
    const wrapper = render()
    await selectFiles(wrapper, [file('offset.jpg', 'image/jpeg')])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('within the last 15 minutes')
  })

  it('ignores a malformed EXIF offset string', async () => {
    parseExifMock.mockResolvedValue({
      DateTimeOriginal: new Date(Date.now() - 30 * 60 * 1000),
      OffsetTimeOriginal: 'not-an-offset',
    })
    const wrapper = render()
    await selectFiles(wrapper, [file('bad-offset.jpg', 'image/jpeg')])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('within the last 15 minutes')
  })

  it('proceeds when EXIF parsing throws, leaving the cutoff to the server', async () => {
    parseExifMock.mockRejectedValue(new Error('corrupt header'))
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces the API message on upload failure', async () => {
    fetchMock.mockRejectedValue({ data: { message: 'Photo too large' } })
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg')])
    expect(wrapper.text()).toContain('Photo too large')
    expect(wrapper.emitted('uploaded')).toBeUndefined()
  })

  it('falls back to data.error, then to a generic message', async () => {
    fetchMock.mockRejectedValue({ data: { error: 'Rejected by moderation' } })
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg')])
    expect(wrapper.text()).toContain('Rejected by moderation')

    fetchMock.mockRejectedValue(new Error('offline'))
    await selectFiles(wrapper, [file('b.jpg', 'image/jpeg')])
    expect(wrapper.text()).toContain('Upload failed')
  })

  it('processes multiple files sequentially', async () => {
    const wrapper = render()
    await selectFiles(wrapper, [file('a.jpg', 'image/jpeg'), file('b.png', 'image/png')])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('uploaded')).toHaveLength(2)
  })

  it('continues past a rejected file to upload the valid ones', async () => {
    const wrapper = render()
    await selectFiles(wrapper, [file('bad.pdf', 'application/pdf'), file('good.jpg', 'image/jpeg')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('uploaded')).toHaveLength(1)
  })

  it('ignores a change event with no files', async () => {
    const wrapper = render()
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: null, configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores a drop event with no dataTransfer files', async () => {
    const wrapper = render()
    await wrapper.find('div.border-dashed').trigger('drop', { dataTransfer: { files: null } })
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
