# Mise

**Everything in its place.** A local-first meal planner and recipe PWA.

[![CI](https://github.com/YOUR_ORG/meal-planner-pwa/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/meal-planner-pwa/actions/workflows/ci.yml)
[![Deploy](https://github.com/YOUR_ORG/meal-planner-pwa/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_ORG/meal-planner-pwa/actions/workflows/deploy.yml)

## Overview

Mise is a progressive web app for planning meals and storing recipes. It works fully offline with local-first data storage (IndexedDB via Dexie), with optional Supabase sync for social features.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: Tailwind CSS 4
- **PWA**: vite-plugin-pwa + Workbox
- **Local DB**: Dexie (IndexedDB)
- **Backend** (optional): Supabase

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build for production
pnpm build
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for deployment instructions.

The app auto-deploys to Vercel on every push to `main`. PRs get preview deployments.

## Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These are optional — the app works fully offline without Supabase.
