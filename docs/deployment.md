# Deployment

Mise is a static SPA that builds to a `dist/` directory. It can be deployed to Vercel, Docker, or any static host.

For a full setup walkthrough including prerequisites, environment variables, and Supabase configuration, see [README.md](../README.md).

## Hosting: Vercel

Auto-deploys are configured via GitHub Actions:

| Trigger | Environment | Notes |
|---------|-------------|-------|
| Push to `main` | Production | Full production deploy with `--prod` flag |
| Pull Request | Preview | Unique preview URL per PR, commented on the PR |

## One-time Setup

### 0. Create Supabase Project (required for social features)

Supabase powers authentication and all social/sync features. The app builds and
runs without it (local-only mode), but social features require a live project.

#### Step-by-step (board action required)

1. Go to [supabase.com](https://supabase.com) and create a new project.
   - **Name**: `mise` (or any name)
   - **Region**: pick the region closest to your users
   - **Password**: generate a strong database password and store it in your
     password manager

2. Once the project is ready, navigate to **Settings → API** and note:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon / public key** → `VITE_SUPABASE_ANON_KEY`

3. Run the database migrations. From the Supabase **SQL editor**, paste and run
   each file in `supabase/migrations/` in order (they are prefixed by timestamp,
   so sort ascending):

   ```
   supabase/migrations/
     20260316000001_initial_schema.sql
     20260316000002_rls_policies.sql
     20260316000003_auth_config.sql
     20260316000004_sync_tables.sql
     20260316000005_storage.sql
     20260316000006_households.sql
     20260316000007_friend_invites.sql
     20260316000008_input_constraints.sql
     20260316000009_engagement_notifications.sql
     20260316000010_groups.sql
     20260316000011_notification_triggers.sql
     20260316000012_admin_role.sql
     20260316000013_app_settings.sql
     20260316000014_stories.sql
     20260316000015_reposts.sql
     20260317000001_direct_messages.sql
     20260318000001_security_fixes.sql
     20260318000002_server_rate_limit.sql
   ```

   **Or** use the Supabase CLI (requires Docker):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

4. (Optional) Bootstrap the first admin user. In the SQL editor, set the config
   variable and run `supabase/seed.sql`:
   ```sql
   SET app.initial_admin_email = 'your@email.com';
   -- then paste contents of supabase/seed.sql
   ```

5. Create a `.env.local` at the repo root:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```

6. Add the same values as GitHub Actions secrets (see step 2 below).

#### Supabase auth settings

In the Supabase dashboard → **Authentication → URL Configuration**, set:
- **Site URL**: your production domain (e.g. `https://mise.yourdomain.com`)
- **Redirect URLs**: add `https://mise.yourdomain.com/**`

#### Local development with Supabase CLI

To run a full Supabase stack locally (requires Docker):

```bash
# Start (uses supabase/config.toml)
pnpm supabase:start

# Apply all migrations fresh
pnpm supabase:reset

# Push incremental migrations
pnpm supabase:migrate

# View status + local credentials
pnpm supabase:status

# Stop
pnpm supabase:stop
```

`supabase start` prints local credentials including `API URL` and `anon key`.
Set those in `.env.local` to point your dev server at the local stack.

#### Regenerating TypeScript types

After schema changes, regenerate `src/types/supabase.ts`:

```bash
# Replace YOUR_PROJECT_ID with your Supabase project ref
pnpm supabase:types
```

---

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

| Secret | Required | Value |
|--------|----------|-------|
| `VERCEL_TOKEN` | Yes | Vercel API token ([create here](https://vercel.com/account/tokens)) |
| `VERCEL_ORG_ID` | Yes | From `.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | Yes | From `.vercel/project.json` → `projectId` |
| `VITE_SUPABASE_URL` | Yes* | Supabase project URL — from Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Yes* | Supabase anon/public key — from Settings → API |
| `VITE_SENTRY_DSN` | Optional | Sentry DSN for error tracking |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry auth token for source map uploads |
| `SENTRY_ORG` | Optional | Sentry organization slug |
| `SENTRY_PROJECT` | Optional | Sentry project slug (default: `meal-planner-pwa`) |
| `VITE_VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |

*Required for social features. App deploys and works offline without them.

### 3. Configure Vercel project settings

In the Vercel dashboard for your project:
- **Build Command**: `pnpm build`
- **Output Directory**: `dist`
- **Framework Preset**: None (static)

The `vercel.json` at the repo root handles:
- SPA routing (all paths → `index.html`)
- Long-lived cache headers for hashed assets (`/assets/*`)
- Security headers

## Hosting: Docker

A `Dockerfile` and `docker-compose.yml` are included for self-hosted deployments. The image is a two-stage build: Node 22 builds the app, nginx serves the static output.

**Build args** (Vite inlines `VITE_*` at build time — they must be passed as build args, not runtime env vars):

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-ref.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t mise .

docker run -p 80:80 mise
```

**Or with Docker Compose** (reads from `.env.local` or shell environment):

```bash
docker compose up
```

The app is served on port 80. nginx is configured via `nginx.conf` at the repo root (SPA fallback routing, gzip compression, cache headers).

## Hosting: Any static host

```bash
pnpm build
```

Serve the `dist/` directory from Netlify, Cloudflare Pages, S3 + CloudFront, or any host that supports SPAs. Configure a catch-all rule to serve `index.html` for all unmatched routes.

---

## Environment Variables

Supabase credentials are injected at build time via `VITE_` prefix. The app works
fully offline without these — they only enable optional social/sync features.

To add environment variables to Vercel previews:
```bash
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_ANON_KEY preview
```

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs two jobs in parallel on every
PR and push to `main`:

**Job: `ci`** — Lint, Typecheck, Test, Build
1. **Lint** — ESLint checks
2. **Typecheck** — `tsc --noEmit`
3. **Test** — Vitest unit tests (Supabase mocked; no real backend needed)
4. **Build** — Vite production build
5. **Bundle size check** — fails if JS or CSS exceeds budget
6. **Bundle report** — `dist/stats.html` uploaded as a GitHub Actions artifact

**Job: `db-migrations`** — Verify DB Migrations (runs against local Supabase via Docker)
1. **supabase start** — spins up local Postgres + GoTrue + Storage in Docker
2. **supabase db reset** — applies all migrations in `supabase/migrations/` from scratch
3. **supabase db lint** — checks for schema issues (RLS missing, function security, etc.)
4. **supabase stop** — tears down containers (always runs, even on failure)

Both jobs must pass before the deploy workflow runs.

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

## Self-Hosting with Docker

Mise ships as a static SPA served by nginx inside a Docker container. You can run it on any Linux server, VPS, or home server.

### Prerequisites

- Docker 24+ and Docker Compose v2
- A `.env` file with your build-time variables (see below)

### Environment Variables

Create a `.env` file at the repo root (never commit this file):

```env
# Required for social features — app works offline without these
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_APP_VERSION=1.0.0
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=meal-planner-pwa
```

> **Important:** `VITE_*` variables are inlined at _build time_ by Vite. They must be present before running `docker build` — not just at runtime. The Dockerfile uses `ARG` + `ENV` to pass them through to the build stage.

### Build and Run

```bash
# Build the image (reads .env via docker-compose)
docker compose build

# Start the container
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

The app will be available at `http://localhost` (port 80).

To rebuild after a code change:
```bash
docker compose build --no-cache && docker compose up -d
```

### Building with explicit build args (without Compose)

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  -t mise:latest .

docker run -d -p 80:80 --name mise mise:latest
```

### Reverse Proxy (optional)

To run behind nginx or Caddy with TLS on a custom domain, proxy to port 80 of the container. Example Caddy snippet:

```
mise.yourdomain.com {
    reverse_proxy localhost:80
}
```

Supabase auth requires the **Site URL** and **Redirect URLs** in the Supabase dashboard to match your production domain (see [Supabase auth settings](#supabase-auth-settings)).

### Health Check

The container exposes a health check at `GET /` (HTTP 200). Docker Compose polls it every 30 s; unhealthy containers restart automatically (`restart: unless-stopped`).

---

## Rollback

To roll back to a previous deployment:
```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```
