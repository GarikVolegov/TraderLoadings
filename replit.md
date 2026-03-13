# TraderLoading

## Overview

Professional forex/stock trading web dashboard. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Features

- **Dashboard**: Real-time clock with trading sessions (Asian/London/NY), lot-size calculator (formula: (€/pips)/11), daily missions with XP/levels
- **Journal (Diario)**: Trade journal entries with images, plus Idee and Obiettivi tabs
- **Checklist**: Customizable pre-trade checklist with progress tracking
- **News**: Real-time macro news (gold/USD/forex) via RSS feeds (Seeking Alpha, CNBC) with optional Perplexity AI enhancement. Server cache 10min, manual refresh bypasses cache.
- **Settings**: Profile with XP/level, account auth (Replit Auth), binaural audio player (persistent background audio), customizable background image upload
- **Auth**: Replit Auth (OIDC/PKCE) — sessions stored in DB `sessions` table

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── trader-dashboard/   # React+Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Auth hook for browser (useAuth)
├── scripts/
└── ...
```

## DB Tables

- `profile` — trader name, XP, level
- `missions` — daily missions with XP rewards
- `journal_entries` + `journal_images` — trading journal
- `ideas` — ideas (type=idea) and goals (type=goal) for journal tabs
- `checklist_items` — customizable pre-trade checklist
- `user_settings` — background image URL and type
- `sessions` + `users` — Replit Auth sessions

## API Routes

All mounted at `/api`:
- `GET/PUT /profile`
- `GET /missions`, `POST /missions/:id/complete`
- `GET/POST /journal`, `GET/PUT/DELETE /journal/:id`, `POST /journal/:id/images`, `DELETE /journal/:id/images/:imageId`
- `GET/POST /ideas`, `PUT/DELETE /ideas/:id`
- `GET/POST /checklist`, `PUT/DELETE /checklist/:id`
- `GET /news` — Macro news via RSS feeds (Seeking Alpha, CNBC) + optional Perplexity AI. Cached 10min, `?nocache=1` bypasses cache
- `GET/PUT /settings`, `POST /settings/background`
- `GET /auth/user`, `GET /login`, `GET /callback`, `GET /logout`

## Secrets Required

- `PERPLEXITY_API_KEY` — (optional) Perplexity AI for enhanced macro news. RSS feeds work without it.
- `DATABASE_URL` — auto-provided by Replit
- `REPL_ID` — auto-provided by Replit

## Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client after OpenAPI changes
- `pnpm --filter @workspace/db run push` — push schema to DB
- `pnpm run typecheck` — full project typecheck

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` with `composite: true`. Run `pnpm run typecheck` from root for full typecheck. When adding a new lib, add it to both root `tsconfig.json` and the consuming app's `tsconfig.json` references array.
