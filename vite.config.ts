import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  // Fail-fast: deployment builds require all critical env vars.
  // Gated on DEPLOY=true so local dev and CI-only builds are unaffected.
  if (mode === 'production' && process.env.DEPLOY === 'true') {
    const env = loadEnv(mode, process.cwd(), '')
    const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SENTRY_DSN']
    const missing = required.filter((k) => !env[k])
    if (missing.length > 0) {
      throw new Error(
        `Deployment build requires the following env vars:\n` +
        missing.map((k) => `  - ${k}`).join('\n') +
        `\n\nSet them in your deployment environment or .env.production file.`
      )
    }
  }

  return {
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use injectManifest so our custom sw.ts controls caching + background sync + push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'mise',
        short_name: 'mise',
        description: 'Cook, share, and enjoy. A social recipe platform for food lovers.',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Use iife format so rolldown does not set `inlineDynamicImports: true`
        // (which emits a deprecation warning in Vite v8). iife produces a
        // single-file classic SW — functionally identical for this codebase.
        rollupFormat: 'iife',
      },
    }),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
    // Upload source maps to Sentry during production builds.
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT env vars.
    // No-ops silently when auth token is absent (local/CI without secrets).
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true, // suppress output when not configured
      telemetry: false,
    }),
  ],
  build: {
    sourcemap: 'hidden', // upload to Sentry but don't expose source to browsers
    // Sentry bundle is ~440 kB; raise the limit so it doesn't warn.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      checks: {
        // vite-plugin-pwa + Sentry dominate plugin time; this metric adds no
        // actionable signal for this project.
        pluginTimings: false,
      },
    },
  },
  server: {
    headers: {
      // Prevent the app from being embedded in iframes on other origins
      'X-Frame-Options': 'SAMEORIGIN',
      // Stop browsers from MIME-sniffing response content types
      'X-Content-Type-Options': 'nosniff',
      // Don't send referrer info to third-party URLs
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Restrict powerful features (camera used for recipe photo capture)
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    },
  },
  }
})
