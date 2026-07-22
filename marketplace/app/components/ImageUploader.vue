<template>
  <div class="space-y-3">
    <div
      @dragover.prevent
      @drop.prevent="onDrop"
      class="border-2 border-dashed border-gray-300 rounded-card p-8 text-center cursor-pointer hover:border-brand transition-colors"
      @click="fileInput?.click()"
    >
      <p class="text-ink-muted text-sm">Drop photos here or <span class="text-brand font-medium">browse</span></p>
      <p class="text-ink-subtle text-xs mt-1">JPEG, WebP, PNG — max 5MB — must be taken within 15 minutes</p>
      <input ref="fileInput" type="file" accept="image/jpeg,image/webp,image/png" multiple class="hidden" @change="onFileChange" />
    </div>

    <div v-if="uploading" class="text-sm text-ink-muted">Uploading…</div>

    <div v-if="freshnessWarning" class="rounded-input bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
      ⚠️ {{ freshnessWarning }}
    </div>

    <div v-if="uploadError" class="rounded-input bg-brand-muted border border-brand p-3 text-sm text-brand">
      {{ uploadError }}
    </div>

    <div v-if="uploaded.length > 0" class="grid grid-cols-3 gap-2">
      <div v-for="img in uploaded" :key="img.id" class="relative aspect-square rounded-input overflow-hidden">
        <img :src="img.publicUrl" class="h-full w-full object-cover" :alt="img.storagePath" />
        <button
          @click="$emit('remove', img.id)"
          aria-label="Remove photo"
          class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/70"
        >✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Explicit vue import (rather than Nuxt auto-import) so the component also
// works under plain vitest/SSR test environments
import { ref } from 'vue'
import { parse as parseExif } from 'exifr'

const props = defineProps<{
  listingId: string
  uploaded: { id: string; publicUrl: string; storagePath: string }[]
}>()

const emit = defineEmits<{
  uploaded: [image: { id: string; publicUrl: string; storagePath: string }]
  remove: [imageId: string]
}>()

const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const freshnessWarning = ref('')
const uploadError = ref('')

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

const ALLOWED_MIME = ['image/jpeg', 'image/webp', 'image/png']

async function processFile(file: File) {
  freshnessWarning.value = ''
  uploadError.value = ''

  // The client-side freshness check is advisory only: EXIF DateTimeOriginal
  // carries no timezone, so this local-time comparison can be off by hours
  // across timezones. Parse OffsetTimeOriginal when present to disambiguate;
  // the server enforces the authoritative cutoff either way, so a photo that
  // slips past this warning is still rejected server-side.
  try {
    const exif = await parseExif(file, ['DateTimeOriginal', 'OffsetTimeOriginal'])
    if (exif?.DateTimeOriginal) {
      let captured = new Date(exif.DateTimeOriginal)
      const offset: unknown = exif.OffsetTimeOriginal
      if (typeof offset === 'string') {
        const m = offset.match(/^([+-])(\d{2}):(\d{2})$/)
        if (m) {
          const offsetMin = (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10))
          // exifr parsed in local time; cancel out the browser's own offset,
          // then re-anchor to the recorded EXIF offset
          captured = new Date(captured.getTime() - captured.getTimezoneOffset() * 60000 - offsetMin * 60000)
        }
      }
      const deltaSec = (Date.now() - captured.getTime()) / 1000
      if (deltaSec > 900) {
        freshnessWarning.value = `This photo appears to have been taken ${Math.round(deltaSec / 60)} minutes ago. Only photos taken within the last 15 minutes will be accepted.`
        return
      }
    }
  } catch {
    // no EXIF — proceed; server will handle
  }

  uploading.value = true
  try {
    const token = await getToken()
    const form = new FormData()
    form.append('file', file)

    const res = await $fetch<{ id: string; publicUrl: string; storagePath: string }>(
      `${apiBase}/api/consignment/seller/listings/${props.listingId}/images`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }
    )
    emit('uploaded', res)
  } catch (err: unknown) {
    const apiErr = err as { data?: { error?: string; message?: string } }
    uploadError.value = apiErr?.data?.message ?? apiErr?.data?.error ?? 'Upload failed'
  } finally {
    uploading.value = false
  }
}

// Process files sequentially: concurrent processFile calls race on the
// shared uploading/freshnessWarning/uploadError refs (each call resets them).
async function processFiles(files: File[]) {
  for (const file of files) {
    if (!ALLOWED_MIME.includes(file.type)) {
      uploadError.value = `"${file.name}" is not an accepted type (JPEG, WebP, PNG)`
      continue
    }
    await processFile(file)
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files) return
  const list = Array.from(files)
  input.value = ''
  void processFiles(list)
}

function onDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files) return
  // Drag-and-drop bypasses the input's `accept` filter — enforce it here too.
  void processFiles(Array.from(files))
}
</script>
