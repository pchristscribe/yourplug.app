<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Policy — yourplug',
  description: 'Learn how yourplug collects, uses, and protects your personal information.',
  robots: 'index, follow',
})
</script>

<template>
  <main class="max-w-3xl mx-auto py-10 px-4 sm:px-6">
    <!-- Back link -->
    <NuxtLink
      to="/"
      class="inline-flex items-center text-brand dark:text-brand-hover hover:text-brand-active dark:hover:text-accent transition-colors duration-base mb-8"
    >
      ← Back to Products
    </NuxtLink>

    <article class="bg-surface dark:bg-surface-raised rounded-card shadow-card p-8 sm:p-10 space-y-10">
      <!-- Header -->
      <header>
        <h1 class="text-3xl font-bold text-ink dark:text-ink-inverse mb-2">
          Privacy Policy
        </h1>
        <p class="text-sm text-ink-muted dark:text-ink-subtle">
          Effective date: June 18, 2026
        </p>
      </header>

      <!-- Introduction -->
      <section>
        <p class="text-ink dark:text-ink-inverse leading-relaxed">
          yourplug ("we", "us", or "our") operates an affiliate marketing platform curating products for gay men. This Privacy Policy explains what personal information we collect, why we collect it, and how you can exercise your rights. By using our site you agree to the practices described here.
        </p>
      </section>

      <!-- Data we collect -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          1. Data We Collect
        </h2>
        <div class="space-y-4">
          <div>
            <h3 class="font-semibold text-ink dark:text-ink-inverse mb-1">
              OAuth Profile Data
            </h3>
            <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
              When you sign in via Google, GitHub, or Discord we receive your display name, email address, and avatar URL. We do not receive your password — authentication is handled entirely by those providers.
            </p>
          </div>
          <div>
            <h3 class="font-semibold text-ink dark:text-ink-inverse mb-1">
              Click &amp; Affiliate Tracking
            </h3>
            <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
              When you click an affiliate link we record which link you clicked, the timestamp of the click, an anonymized one-way hash of your IP address (not the raw IP), and your approximate country derived from that IP. We never store your raw IP address in our database.
            </p>
          </div>
          <div>
            <h3 class="font-semibold text-ink dark:text-ink-inverse mb-1">
              Cookies
            </h3>
            <ul class="list-disc list-inside text-ink-muted dark:text-ink-subtle space-y-1">
              <li><span class="font-medium text-ink dark:text-ink-inverse">Session cookies</span> — required for authentication; set on sign-in, cleared on sign-out.</li>
              <li><span class="font-medium text-ink dark:text-ink-inverse">Analytics cookies</span> — optional; used to understand how visitors use the site. A consent banner lets you opt out before any analytics cookie is set.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Why we collect it -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          2. Why We Collect It
        </h2>
        <ul class="list-disc list-inside text-ink-muted dark:text-ink-subtle space-y-2">
          <li><span class="font-medium text-ink dark:text-ink-inverse">Personalization</span> — to show you relevant product recommendations and remember your preferences.</li>
          <li><span class="font-medium text-ink dark:text-ink-inverse">Analytics</span> — to understand which products and categories are most popular so we can improve the catalog.</li>
          <li><span class="font-medium text-ink dark:text-ink-inverse">Affiliate commission tracking</span> — FTC regulations require us to track which affiliate links generate purchases so we can accurately report and receive commissions from our affiliate partners.</li>
        </ul>
      </section>

      <!-- Third parties -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          3. Third-Party Services
        </h2>
        <p class="text-ink-muted dark:text-ink-subtle mb-4 leading-relaxed">
          We use the following third-party services, each with their own privacy policies:
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4 font-semibold text-ink dark:text-ink-inverse">Service</th>
                <th class="py-2 font-semibold text-ink dark:text-ink-inverse">Purpose</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Supabase</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Database hosting and OAuth authentication</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Sentry</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Error monitoring and performance tracing</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Dub.co</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Affiliate link tracking and click analytics</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">DHgate, AliExpress, Amazon, Wish</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Affiliate programs — purchases made on those platforms are governed by their own privacy policies</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Your rights -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          4. Your Rights
        </h2>
        <p class="text-ink-muted dark:text-ink-subtle mb-3 leading-relaxed">
          You may request access to, correction of, or deletion of your personal data at any time. To exercise any of these rights, email us at:
        </p>
        <a
          href="mailto:p.christopherschreiber@gmail.com"
          class="inline-block text-brand dark:text-brand-hover hover:underline font-medium"
        >
          p.christopherschreiber@gmail.com
        </a>
        <p class="text-ink-muted dark:text-ink-subtle mt-3 leading-relaxed">
          We will respond within 30 days. To opt out of analytics cookies, use the consent banner shown on your first visit or clear your browser cookies.
        </p>
      </section>

      <!-- CCPA -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          5. California Residents (CCPA)
        </h2>
        <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
          Under the California Consumer Privacy Act you have the right to know what personal information we collect, the right to delete it, and the right to opt out of the sale of your personal information. <strong class="text-ink dark:text-ink-inverse">We do not sell personal information.</strong> To submit a "Do Not Sell My Personal Information" request or to exercise any other CCPA right, contact us at the email above.
        </p>
      </section>

      <!-- GDPR -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          6. EU / EEA Residents (GDPR)
        </h2>
        <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
          If you are located in the European Union or European Economic Area, you have the following rights under the GDPR:
        </p>
        <ul class="list-disc list-inside text-ink-muted dark:text-ink-subtle space-y-1 mt-3">
          <li>Right of access to your personal data</li>
          <li>Right to rectification of inaccurate data</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to restriction of processing</li>
          <li>Right to data portability</li>
          <li>Right to object to processing based on legitimate interests</li>
        </ul>
        <p class="text-ink-muted dark:text-ink-subtle mt-3 leading-relaxed">
          Our lawful basis for processing is your consent (for optional analytics) and legitimate interests (for affiliate commission tracking required by our affiliate agreements). Exercise any GDPR right by emailing us at the address in Section 4.
        </p>
      </section>

      <!-- Cookies detail -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          7. Cookie Details
        </h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="py-2 pr-4 font-semibold text-ink dark:text-ink-inverse">Cookie</th>
                <th class="py-2 pr-4 font-semibold text-ink dark:text-ink-inverse">Type</th>
                <th class="py-2 font-semibold text-ink dark:text-ink-inverse">Purpose</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle font-mono text-xs">sb-access-token</td>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Required</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Supabase OAuth access token — authenticates your session</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle font-mono text-xs">sb-refresh-token</td>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Required</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Supabase OAuth refresh token — renews your session without re-login</td>
              </tr>
              <tr>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle font-mono text-xs">_analytics</td>
                <td class="py-2 pr-4 text-ink-muted dark:text-ink-subtle">Optional</td>
                <td class="py-2 text-ink-muted dark:text-ink-subtle">Page-view and click analytics — only set after consent</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Changes -->
      <section>
        <h2 class="text-xl font-semibold text-ink dark:text-ink-inverse mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
          8. Changes to This Policy
        </h2>
        <p class="text-ink-muted dark:text-ink-subtle leading-relaxed">
          We may update this Privacy Policy from time to time. When we do, we will revise the "Effective date" at the top of this page. Your continued use of the site after any change constitutes acceptance of the updated policy.
        </p>
      </section>

      <!-- Footer note -->
      <footer class="pt-4 border-t border-gray-100 dark:border-gray-700">
        <p class="text-sm text-ink-subtle dark:text-ink-muted">
          Questions? Contact us at
          <a
            href="mailto:p.christopherschreiber@gmail.com"
            class="text-brand dark:text-brand-hover hover:underline"
          >p.christopherschreiber@gmail.com</a>.
        </p>
      </footer>
    </article>
  </main>
</template>
