# Braisely

**Everything in its place.** A social recipe platform and meal planner PWA.

[![CI](https://github.com/tijoba7/meal-planner-pwa/actions/workflows/ci.yml/badge.svg)](https://github.com/tijoba7/meal-planner-pwa/actions/workflows/ci.yml)
[![Deploy](https://github.com/tijoba7/meal-planner-pwa/actions/workflows/deploy.yml/badge.svg)](https://github.com/tijoba7/meal-planner-pwa/actions/workflows/deploy.yml)

---

## Overview

Braisely is a progressive web app for collecting recipes, planning weekly meals, and generating shopping lists. It works fully offline with local-first storage (IndexedDB), with optional Supabase sync for social features — following, sharing recipes, stories, direct messages, and household coordination.

**Key features:**
- Recipe import from URL (AI-powered scraper) or manual entry
- Weekly meal planner with drag-and-drop scheduling
- Shopping list generation from meal plan
- Step-by-step cooking mode
- Social feed, follows, likes, reposts, and stories
- Direct messages between users
- Household groups for shared meal planning
- Works offline — PWA installable on any device

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| PWA | vite-plugin-pwa + Workbox |
| Local DB | Dexie (IndexedDB) |
| Backend | Supabase (auth, sync, social) |
| Testing | Vitest + Playwright |

---

## Quick Start

```bash
git clone https://github.com/tijoba7/meal-planner-pwa.git && cd meal-planner-pwa
pnpm install
pnpm dev
```

The app runs at `http://localhost:5173` in local-only mode (no Supabase needed for basic recipe/planner features). To enable social features and sync, follow the setup below.

---

## Prerequisites

- **Node.js 22+** — check with `node --version`
- **pnpm** — install with `npm install -g pnpm`
- **Supabase account** — free tier at [supabase.com](https://supabase.com) (required for social features)

---

## Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | For social features | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | For social features | Supabase anon/public key (safe to expose in browser) |
| `VITE_VAPID_PUBLIC_KEY` | For push notifications | VAPID public key — generate with `npx web-push generate-vapid-keys` |
| `VITE_SENTRY_DSN` | Optional | Sentry DSN for error tracking |
| `VITE_APP_VERSION` | Optional | Release tag shown in Sentry (e.g. git SHA) |
| `SENTRY_AUTH_TOKEN` | Build-time only | Sentry auth token for source map uploads |
| `SENTRY_ORG` | Build-time only | Sentry organization slug |
| `SENTRY_PROJECT` | Build-time only | Sentry project slug |

The app builds and works fully offline without any of these set.

---

## Supabase Setup

### 1. Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a name (e.g. `braisely`), region closest to your users, and a strong database password
3. Wait ~2 minutes for the project to initialize

### 2. Get your credentials

Dashboard → **Settings → API**:
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon / public** key → `VITE_SUPABASE_ANON_KEY`

### 3. Run migrations

**Option A — Supabase CLI** (requires Docker):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B — SQL editor** (no Docker needed):

Open `supabase/combined_migration.sql`, copy the entire contents, paste into the Supabase SQL editor, and run it.

### 4. Configure authentication

Dashboard → **Authentication → Providers → Email**:
- Enable email auth: **On**
- Confirm email: **Off** (disable for frictionless signup)

Dashboard → **Authentication → URL Configuration**:
- **Site URL**: your production domain (e.g. `https://braisely.yourdomain.com`)
- **Redirect URLs**: `https://braisely.yourdomain.com/**`

For local development, add `http://localhost:5173/**` to Redirect URLs.

### 5. Create the first admin user

1. Sign up in the running app (or via `supabase.auth.signUp`)
2. In the Supabase SQL editor, run:

```sql
SET app.initial_admin_email = 'your@email.com';
```

Then paste and run the contents of `supabase/seed.sql`.

---

## Admin Configuration

After your first login, go to `/admin` in the app to configure:

**AI Recipe Scraper**
- Provider: choose OpenAI, Anthropic, or other supported LLM
- Model: recommended model for your provider
- API Key: your LLM API key (stored in Supabase, not exposed to browser)

**Feature Flags**
- Toggle experimental features on/off per environment

**Notification Defaults**
- Default notification preferences for new users

---

## Deployment

### Option 1: Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project → connect the repo
3. Add environment variables in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (any other optional vars from the table above)
4. Deploy — Vercel auto-detects Vite and uses `pnpm build` / `dist/`

Auto-deploys on every push to `main`. PRs get preview deployments.

For CI/CD via GitHub Actions, see [docs/deployment.md](docs/deployment.md).

### Option 2: Docker

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-ref.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t braisely .

docker run -p 80:80 braisely
```

Or with Docker Compose (env vars are read from `.env.local` or shell environment):

```bash
docker compose up
```

The container serves the built app on port 80 via nginx. See `docker-compose.yml` and `nginx.conf` for configuration.

### Option 3: Any static host

```bash
pnpm build
```

Serve the `dist/` directory from any static host (Netlify, Cloudflare Pages, S3 + CloudFront, etc.).

The `dist/` output is a standard SPA — configure your host to serve `index.html` for all routes (catch-all / 404 fallback).

---

## Development

### Available scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server at localhost:5173 |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview production build locally |
| `pnpm typecheck` | TypeScript type check (no emit) |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:coverage` | Unit tests with coverage report |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm bundle:check` | Check bundle size against budgets |
| `pnpm supabase:start` | Start local Supabase stack (requires Docker) |
| `pnpm supabase:reset` | Reset local DB and re-apply all migrations |
| `pnpm supabase:migrate` | Push incremental migrations to linked project |
| `pnpm supabase:types` | Regenerate `src/types/supabase.ts` from schema |

### Local Supabase (optional)

To run the full backend stack locally:

```bash
pnpm supabase:start   # starts Postgres, Auth, Storage in Docker
pnpm supabase:reset   # applies all migrations from scratch
pnpm supabase:status  # prints local credentials
```

Set the printed `API URL` and `anon key` in `.env.local` to point your dev server at the local stack.

### Project structure

```
src/
  components/     # Reusable UI components
  contexts/       # React contexts (auth, theme, etc.)
  hooks/          # Custom hooks
  lib/            # Utilities, DB client, API helpers
  pages/          # Route-level page components
  types/          # TypeScript types (incl. supabase.ts)
  sw.ts           # Service worker (PWA, push notifications)

supabase/
  migrations/     # SQL migrations (apply in order)
  combined_migration.sql  # All migrations in one file
  seed.sql        # Admin user bootstrap
```

### Bundle size budgets

| Asset | Budget (gzipped) |
|-------|-----------------|
| Total JS (excl. workbox) | 220 KB |
| Total CSS | 20 KB |

---

## License

MIT
