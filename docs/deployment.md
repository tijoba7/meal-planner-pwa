# Deployment

Mise is a static SPA that builds to a `dist/` directory and deploys to Vercel.

## Hosting: Vercel

Auto-deploys are configured via GitHub Actions:

| Trigger | Environment | Notes |
|---------|-------------|-------|
| Push to `main` | Production | Full production deploy with `--prod` flag |
| Pull Request | Preview | Unique preview URL per PR, commented on the PR |

## One-time Setup

### 1. Create Vercel project

```bash
# Install Vercel CLI
pnpm add -g vercel

# Link project (run from repo root)
vercel link
```

This creates `.vercel/project.json` with your `projectId` and `orgId`.

### 2. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Vercel API token ([create here](https://vercel.com/account/tokens)) |
| `VERCEL_ORG_ID` | From `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` → `projectId` |
| `VITE_SUPABASE_URL` | Your Supabase project URL (optional) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (optional) |
| `VITE_SENTRY_DSN` | Sentry DSN for error tracking (optional) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map uploads (optional) |
| `SENTRY_ORG` | Sentry organization slug (optional) |
| `SENTRY_PROJECT` | Sentry project slug (optional, default: `meal-planner-pwa`) |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public key for push notifications (optional) |

### 3. Configure Vercel project settings

In the Vercel dashboard for your project:
- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Framework Preset**: None (static)

The `vercel.json` at the repo root handles:
- SPA routing (all paths → `index.html`)
- Long-lived cache headers for hashed assets (`/assets/*`)
- Security headers

## Environment Variables

Supabase credentials are injected at build time via `VITE_` prefix. The app works
fully offline without these — they only enable optional social/sync features.

To add environment variables to Vercel previews:
```bash
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
```

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs on every PR and push to `main`:

1. **Lint** — ESLint checks
2. **Typecheck** — `tsc --noEmit`
3. **Test** — Vitest unit tests
4. **Build** — Vite production build
5. **Bundle size check** — fails if JS > 150 KB or CSS > 20 KB (gzipped)
6. **Bundle report** — `dist/stats.html` uploaded as a GitHub Actions artifact

All steps must pass before the deploy workflow runs.

### Bundle size budgets

| Asset | Budget (gzipped) |
|-------|-----------------|
| Total JS (excl. workbox) | 220 KB |
| Total CSS | 20 KB |

Run locally with `pnpm bundle:check`. The build also generates `dist/stats.html` — an
interactive treemap of the bundle via `rollup-plugin-visualizer`.

## Lighthouse CI

Lighthouse scores are checked on every PR (`.github/workflows/lighthouse.yml`).

Thresholds (`.lighthouserc.json`):

| Category | Minimum |
|----------|---------|
| Performance | 90 |
| Accessibility | 95 |
| Best Practices | 90 |
| PWA | 90 |

## Error Tracking (Sentry)

Error tracking is opt-in via environment variables. The app works fine without Sentry configured.

**What's captured:**
- Unhandled JS errors and promise rejections
- React error boundary crashes (via `ErrorBoundary` component)
- Performance traces (10% sample rate in production)

**Source maps** are uploaded to Sentry during production builds (deploy.yml) when `SENTRY_AUTH_TOKEN` is set. Each deploy is tagged with the git SHA via `VITE_APP_VERSION`.

**Environment tagging**: Sentry automatically tags events with `development`, `preview`, or `production` based on `import.meta.env.MODE`.

**To set up alerts**: In the Sentry dashboard, go to Alerts → Create Alert Rule → select "Number of errors" and set your threshold (e.g., > 10 errors/hour).

## Push Notifications

Push notifications are opt-in and require a VAPID key pair.

### One-time key generation

```bash
npx web-push generate-vapid-keys
```

This outputs a `publicKey` and `privateKey`. Store them as follows:

| Key | Where |
|-----|-------|
| Public key | `VITE_VAPID_PUBLIC_KEY` env var (build-time, browser-safe) |
| Private key | Server only — Supabase Edge Function secret or equivalent |

Without `VITE_VAPID_PUBLIC_KEY` the push subscription flow is disabled; the app works normally.

### How it works

1. User grants notification permission (requested by the app on sign-in).
2. The browser subscribes via `pushManager.subscribe()` using the VAPID public key.
3. The subscription object is sent to your push server.
4. Your server uses the private key to send push messages to the subscription endpoint.
5. The service worker (`src/sw.ts`) receives the push event and shows a notification.
6. Tapping the notification opens or focuses the relevant app URL.

### Notification payload format

```json
{ "title": "Mise", "body": "Your meal plan was updated.", "url": "/meal-plan" }
```

`url` is optional and defaults to `/`.

## Rollback

To roll back to a previous deployment:
```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```
