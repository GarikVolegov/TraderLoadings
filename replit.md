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

- **Dashboard**: Real-time clock with active trading session indicator, lot-size calculator (customizable divisor via Settings), daily missions with XP/levels
- **Backtest (FX Replay style)**: Chart replay on real historical data (TradingView lightweight-charts). Candlestick replay with Play/Pause/Step controls (1x/2x/5x/10x speed). BUY/SELL trade placement with click-to-set SL/TP on chart. Auto-closes trades on SL/TP hit during replay. Session management, trade history, real-time P&L and stats (win rate, pips, W/L). Manual trade entry mode also available. Data from Yahoo Finance (EUR/USD, GBP/USD, XAU/USD, US30, NAS100, BTC/USD, etc.), cached 1 hour on backend.
- **Journal (Diario)**: Trade journal entries with images, plus Idee and Obiettivi tabs. Awards 75 XP per entry + auto-completes "Journaling del Trade" mission
- **Checklist**: Customizable pre-trade checklist with progress tracking
- **News**: Real-time macro news (gold/USD/forex) via RSS feeds (Seeking Alpha, CNBC) with optional Perplexity AI enhancement. Server cache 10min, manual refresh bypasses cache. Keyword filter: gold/XAU/USD/DXY/Fed/CPI/inflation/treasury/nonfarm
- **Settings**: Profile with XP/level + avatar (upload from device or AI-generated via gpt-image-1) + unique username validation, account auth (Replit Auth), binaural audio player (5 presets: Alpha 10Hz, Theta 6Hz, Beta 18Hz, Gamma 40Hz, Deep Focus 14Hz with auto-start), font selector (Inter/JetBrains Mono/Roboto/Space Grotesk/IBM Plex Sans), background darkness slider (0-90%), customizable background image upload, **Trading settings** (customize session names/times/visibility, lot calculator divisor)
- **Chat E2EE**: End-to-end encrypted chat between friends. ECDH key exchange (P-256), AES-GCM encryption, private keys stored in IndexedDB. Friendship system with search, requests, accept/reject, remove. Real-time polling (3-5s). Unread badge in nav.
- **Auth**: Replit Auth (OIDC/PKCE) — sessions stored in DB `sessions` table. Multi-user data isolation via userId column on all data tables
- **Audio**: Binaural beats with stereo panning (left/right ear separation). Auto-starts Alpha mode on first user interaction

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
│   ├── integrations-openai-ai-server/  # OpenAI AI integration (gpt-image-1 for avatars)
│   └── replit-auth-web/    # Auth hook for browser (useAuth)
├── scripts/
└── ...
```

## DB Tables

- `profile` — trader name (unique per authenticated user), avatarUrl, XP, level, userId. Has partial unique index on `lower(name)` where `user_id IS NOT NULL`
- `missions` — daily missions with XP rewards, userId
- `journal_entries` + `journal_images` — trading journal, userId
- `ideas` — ideas (type=idea) and goals (type=goal) for journal tabs, userId
- `checklist_items` — customizable pre-trade checklist, userId
- `user_settings` — background URL/type, fontChoice, backgroundDarkness, tradingSessions (JSON), lotDivisor, calendarCurrencies, calendarImpacts, userId
- `backtest_sessions` — name, pair, timeframe, strategy, userId, createdAt
- `backtest_trades` — sessionId (FK), direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pips, notes, tradeDate
- `friendships` — userId, friendId, status (pending/accepted), createdAt. Unique index on (userId, friendId)
- `chat_messages` — senderId, receiverId, ciphertext (base64), iv (base64), read flag, createdAt
- `user_public_keys` — userId (unique), publicKeyJwk (JSON string), createdAt
- `sessions` + `users` — Replit Auth sessions

## API Routes

All mounted at `/api`. All data routes filter by `req.user?.id` for multi-user isolation:
- `GET/PUT /profile`, `GET /profile/check-name?name=X`, `POST /profile/avatar` (upload), `POST /profile/avatar/generate` (AI)
- `GET /missions`, `POST /missions/:id/complete`
- `GET/POST /journal`, `GET/PUT/DELETE /journal/:id`, `POST /journal/:id/images`, `DELETE /journal/:id/images/:imageId`
- `GET/POST /ideas`, `PUT/DELETE /ideas/:id`
- `GET/POST /checklist`, `PUT/DELETE /checklist/:id`
- `GET /news` — Macro news via RSS feeds (Seeking Alpha, CNBC) + optional Perplexity AI. Cached 10min, `?nocache=1` bypasses cache
- `GET /calendar` — Weekly economic calendar from Forex Factory. Cached 30min, `?nocache=1` bypasses cache. Client-side filtering by currency and impact
- `GET /leaderboard` — Trader leaderboard ranked by XP
- `GET/PUT /settings`, `POST /settings/background`
- `GET /friends/search?q=`, `POST /friends/request`, `GET /friends/requests`, `PATCH /friends/requests/:id`, `GET /friends`, `DELETE /friends/:id`
- `POST /chat/keys`, `GET /chat/keys/:userId`, `POST /chat/messages`, `GET /chat/messages/:friendId`, `GET /chat/unread`
- `GET /backtest/sessions`, `POST /backtest/sessions`, `DELETE /backtest/sessions/:id`
- `GET /backtest/sessions/:id/trades`, `POST /backtest/sessions/:id/trades`, `DELETE /backtest/trades/:id`
- `GET /backtest/candles?symbol=EURUSD&interval=H1` — historical OHLC data from Yahoo Finance, cached 1h
- `GET /auth/user`, `GET /login`, `GET /callback`, `GET /logout`

## Secrets Required

- `PERPLEXITY_API_KEY` — (optional) Perplexity AI for enhanced macro news. RSS feeds work without it.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-provisioned by Replit AI Integrations for avatar generation
- `DATABASE_URL` — auto-provided by Replit
- `REPL_ID` — auto-provided by Replit

## Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client after OpenAPI changes
- `pnpm --filter @workspace/db run push` — push schema to DB
- `pnpm run typecheck` — full project typecheck

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` with `composite: true`. Run `pnpm run typecheck` from root for full typecheck. When adding a new lib, add it to both root `tsconfig.json` and the consuming app's `tsconfig.json` references array.
