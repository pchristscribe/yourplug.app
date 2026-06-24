<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="flex justify-center">
          <svg class="w-16 h-16 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          yourplug Admin
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Secure login with hardware security key, biometrics, or password
        </p>
      </div>

      <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
        <div v-if="authStore.error" class="mb-4 rounded-md bg-red-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">{{ authStore.error }}</p>
            </div>
          </div>
        </div>

        <!-- Login Tab -->
        <div v-if="!showRegister">
          <form class="space-y-6" @submit.prevent="handleLogin">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input
                  id="email"
                  v-model="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="admin@yourplug.app"
                />
              </div>
            </div>

            <div v-if="usePassword">
              <label for="password" class="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  v-model="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg v-if="!authStore.loading" class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span v-if="authStore.loading">Authenticating...</span>
                <span v-else-if="usePassword">Sign in with Password</span>
                <span v-else>Sign in with Security Key</span>
              </button>
            </div>

            <div class="text-center">
              <button
                type="button"
                :aria-pressed="usePassword"
                class="text-sm text-indigo-600 hover:text-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                @click="togglePasswordMode"
              >
                {{ usePassword ? 'Use security key instead' : 'Use password instead' }}
              </button>
            </div>
          </form>

          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500">
                  New admin?
                </span>
              </div>
            </div>

            <div class="mt-6">
              <button
                @click="showRegister = true"
                class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Register Security Key
              </button>
            </div>
          </div>
        </div>

        <!-- Register Tab -->
        <div v-else>
          <form class="space-y-6" @submit.prevent="handleRegister">
            <div>
              <label for="reg-email" class="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div class="mt-1">
                <input
                  id="reg-email"
                  v-model="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label for="device-name" class="block text-sm font-medium text-gray-700">
                Device name (optional)
              </label>
              <div class="mt-1">
                <input
                  id="device-name"
                  v-model="deviceName"
                  type="text"
                  class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g., YubiKey 5, MacBook Touch ID"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                <svg v-if="!authStore.loading" class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span v-if="authStore.loading">Registering...</span>
                <span v-else>Register Security Key</span>
              </button>
            </div>
          </form>

          <div class="mt-6">
            <button
              @click="showRegister = false"
              class="w-full text-center text-sm text-indigo-600 hover:text-indigo-500"
            >
              ← Back to login
            </button>
          </div>
        </div>

        <!-- Info Section -->
        <div class="mt-8 p-4 bg-blue-50 rounded-md">
          <h3 class="text-sm font-medium text-blue-800 mb-2">Supported Authenticators:</h3>
          <ul class="text-xs text-blue-700 space-y-1">
            <li>• YubiKey or other FIDO2 security keys</li>
            <li>• Touch ID / Face ID (Safari on Mac/iPhone)</li>
            <li>• Windows Hello (Edge/Chrome on Windows)</li>
            <li>• Android biometrics (Chrome on Android)</li>
          </ul>
          <div class="mt-3 pt-3 border-t border-blue-200">
            <NuxtLink
              to="/diagnostic"
              class="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Having trouble? Run the diagnostic tool →
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false
})

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const deviceName = ref('')
const showRegister = ref(false)
const usePassword = ref(false)

const togglePasswordMode = () => {
  usePassword.value = !usePassword.value
  authStore.error = null
  if (!usePassword.value) password.value = ''
}

const handleLogin = async () => {
  const success = usePassword.value
    ? await authStore.loginWithPassword(email.value, password.value)
    : await authStore.loginWithSecurityKey(email.value)
  if (success) {
    await navigateTo('/')
  }
}

const handleRegister = async () => {
  const success = await authStore.registerSecurityKey(email.value, deviceName.value || undefined)
  if (success) {
    showRegister.value = false
    authStore.error = null
    alert('Security key registered! You can now sign in.')
  }
}
</script>
