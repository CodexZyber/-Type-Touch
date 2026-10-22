# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tensor MacTober Touch Type Championship — a live typing-contest web app (Next.js 14 App Router, TypeScript, Tailwind, PostgreSQL via `pg`). Students register and take timed typing attempts during a LIVE event; a leaderboard ranks best qualifying attempts; the top `finalists_count` advance to a Grand Final; a host runs everything from `/admin`.

## Commands

```bash
npm run dev            # dev server on :3000
npm run build          # production build (also type-checks)
npx tsc --noEmit       # type-check only
npm run admin:setup    # generate admin credentials into .env.local (add `-- --force` to rotate)
docker compose --env-file .env.local up -d --build   # Postgres + app (app on 127.0.0.1:3000)
docker compose --env-file .env.local up -d db        # Postgres only, for `npm run dev`
```

- There is no test suite and no ESLint config/dependency — `npm run lint` will prompt to set one up rather than lint.
- `npm run build` writes to `.next/`; don't run it while `next dev` is running from the same directory (it breaks the dev server). Build in a copy instead.
- `admin:setup` prints the plaintext password once and stores only a scrypt hash; it also rotates `ADMIN_SESSION_SECRET`, logging out all admin sessions.

## Architecture

### Data layer: one service, two backends
`src/lib/store/event-store.ts` (`EventService`) is the single data-access layer used by every API route. Each method has a **Postgres path** (raw SQL through the `pg` pool in `src/lib/db/postgres.ts`) and an **in-memory fallback** (`MemoryDataStore`, kept on `globalThis.__tensorStore`). Postgres is used only when `DATABASE_URL` is set. When changing store logic, update **both** paths and keep their behavior consistent. Postgres errors propagate (no silent fallback to memory).

- `src/lib/db/postgres.ts` sets pg type parsers so NUMERIC/BIGINT come back as numbers and timestamps as ISO strings. Guard UUID columns with `isUuid()`: clients may hold stale non-UUID ids from memory mode.
- Event config updates write only columns in `EVENT_UPDATABLE_COLUMNS` (keys are interpolated into SQL).
- Realtime: `src/lib/realtime/live.ts` is an in-process SSE hub. Every ranking-affecting write in the store calls `rankingsChanged()` → `notifyChange()`, which debounces (~400ms), builds ONE snapshot (event + qualifier leaderboard + Grand Final standings + finalist progress) and writes it to every `/api/live` connection. Browsers use `useLiveFeed()` (`src/lib/hooks/useLiveFeed.ts`), which falls back to 5s polling if the stream fails. Finalists POST `/api/attempts/progress` once a second while typing in the final; it is ephemeral (never stored) and broadcast as `progress` events. Single-process only: if the app is ever run as multiple processes, the hub needs Postgres LISTEN/NOTIFY or similar.
- Leaderboard ranking in Postgres mode is the SQL function `get_event_leaderboard(event_id, round)`; in memory mode it is reimplemented in TS inside `EventService.getLeaderboard`. These two must stay in sync. `round` is `QUALIFIER` or `FINAL`; the FINAL board only counts finalists (`events.finalist_ids`) and attempts inside the final window. `EventService.getFinalStandings` wraps it to list every finalist (seed order) with their final rank, best final attempt and live progress.

### Database
Schema lives in `db/init/001_schema.sql`, which the `db` compose service runs automatically on first start (empty volume only — apply later changes manually with `psql`). Incremental changes for existing databases go in `db/migrations/NNN_*.sql` (idempotent `ADD COLUMN IF NOT EXISTS` style) **and** are folded into `001_schema.sql` for fresh installs; `002_keystroke_metrics.sql` adds `raw_wpm`, `total_keystrokes`, `incorrect_keystrokes`, `corrections`; `003_grand_final.sql` adds the `events.final_*`/`finalist_ids` columns, `attempts.round`, and redefines `get_event_leaderboard` with a round parameter; `004_passages_and_timelines.sql` adds `events.passage_mode`/`final_passage`, `attempts.consistency`/`timeline`, and extends the leaderboard function with `best_raw_wpm`/`best_consistency`/`best_attempt_id`. All must be applied to production before deploying code that depends on them. Tables `events`, `participants`, `attempts`; functions `get_server_time()`, `get_event_leaderboard()`; seed event. IDs are UUIDs with DB defaults — don't generate string IDs for inserts. Types mirroring the tables are in `src/types/index.ts`. `supabase/migrations/` is the legacy Supabase schema and is no longer used.

### Event lifecycle & rules (enforced server-side in EventService)
- Status: `NOT_STARTED` → `LIVE` (start sets `start_time`/`end_time` from `event_duration`) → `ENDED`. Pause returns to `NOT_STARTED`. `getActiveEvent` auto-flips LIVE→ENDED once `end_time` passes.
- Grand Final: a second round tracked by `final_status`/`final_start_time`/`final_end_time`/`final_duration`/`finalist_ids`. `startFinal` (PATCH `/api/event` `{action:'start_final'}`) requires the qualifier round to be `ENDED`, freezes the top `finalists_count` of the qualifier board into `finalist_ids`, and opens a `final_duration`-minute window; `endFinal` closes it; `resetEvent` clears it. Attempts carry `round` (`QUALIFIER`|`FINAL`); `submitAttempt` with `round:'FINAL'` requires `final_status === 'LIVE'` and a seeded finalist, and `max_attempts` is counted per round. Restarting the final needs no deletion: old final attempts fall outside the new window.
- Config (`updateEvent`) is rejected while the qualifier round or the Grand Final is LIVE.
- Passages: `src/lib/passages.ts` holds the library. With `passage_mode = 'random'` (default) `startEvent` rotates `passage` to a fresh library text (a resume after pause keeps it) and `startFinal` sets `final_passage` to a different one; `'custom'` uses the host's `passage`/`final_passage` (blank final → random). Scoring and the typing UI use `passageForRound()`: the final is typed and scored against `final_passage`.
- Each attempt stores a per-second `timeline` (`[{t, wpm, raw, errors}]`, recorded client-side, sanitized by `sanitizeTimeline`) and a `consistency` score derived from it (`calculateConsistency`); both are informational and never affect WPM/accuracy. Charts (`src/components/charts/*`) are inline SVG, single-axis, indigo = net WPM, teal `#0d9488` = raw burst, red = mistypes.
- `submitAttempt` requires LIVE, enforces `max_attempts` (null = unlimited), and scores the attempt server-side with `computeAttemptMetrics` in `src/lib/utils/typing.ts` (TypeSprint/Monkeytype convention): correct/incorrect characters are recomputed from `typedText` vs the event passage (client counts are not trusted); net WPM = `(correct chars/5)/minutes` over the actual elapsed time (sub-second, capped at `test_duration`); `raw_wpm` counts all typed chars; **accuracy is keystroke-based** = `(total_keystrokes - incorrect_keystrokes)/total_keystrokes`, where the client tracks keystrokes via `diffKeystrokes` and backspacing never undoes a mistype. The server clamps the client's keystroke counters so they can't be lower than what the final text implies. `incorrect_keystrokes` = mistypes, `incorrect_characters` = uncorrected typos. `qualified` when accuracy ≥ `minimum_accuracy`. The live HUD uses the same function.
- Admin control actions and config saves both go through `PATCH /api/event` (`{action}` for start/pause/end/reset, otherwise `{updates}`).

### Time
All timing is server-authoritative: clients compute `serverOffsetMs` from `currentServerTime`/`serverTime` in API responses and add it to `Date.now()`. Countdown helpers are in `src/lib/utils/timer.ts`.

### Admin auth
Custom, not Supabase Auth. `src/lib/auth/admin-auth.ts` does scrypt password verification, HMAC-signed session cookie (`mactober_admin_session`), and IP-based login rate limiting. `src/middleware.ts` only checks the cookie *exists* for `/admin/*` pages; real verification is `requireAdminSession(request)`, which every admin-only API route must call.

### Frontend
- Theme: Tensor School brand (tensorschool.com) — light `#f7f6fa` background, slate text, indigo-700 primary, amber only for podium gold. Tokens in `tailwind.config.ts` (`brand.*`), shared component classes in `src/app/globals.css` (`btn-primary`, `btn-secondary`, `ts-input`, `ts-label`, `ts-eyebrow`; `glass-panel`/`glass-panel-glow` are kept as plain white cards). Fonts (Plus Jakarta Sans / Inter) load via a Google Fonts `<link>` in `layout.tsx`, not `next/font`, so builds don't need network. Logo/favicon live in `public/`.
- Candidate-facing UI is deliberately minimal: navbar shows only Contest Arena and Leaderboard; `/final` and `/admin` are reached from the ended-state card and the footer "Host" link. Sign-in is name + student ID via `src/components/contest/RegisterModal.tsx`, shared by `/` and `/contest`. The leaderboard podium/highlighting uses the event's `finalists_count`, never a hardcoded 2.
- Pages poll their APIs (contest/admin every 5s, leaderboard 3s, final 4s). Client components that hold editable or in-progress state must not let polled data overwrite it — e.g. the admin config form keeps a separate draft that is only rehydrated on first load, successful save, or discard.
- `src/components/contest/TypingInterface.tsx` is the typing engine: state machine `READY → TYPING → SUBMITTING → RESULT`, deadline-based timer in a ref (independent of keystrokes), a controlled `<textarea>` for input, passage rendered as per-character spans, paste/copy blocking and tab-switch counting. It's reused by `/final`.
- Participants are identified by a browser-stored session id and participant record in `localStorage` (no student accounts).

## Environment
`.env.local` (gitignored; template in `.env.example`): `POSTGRES_PASSWORD`, `DATABASE_URL` (host `localhost` for `npm run dev`; compose overrides it to host `db`), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL` (inlined at build time — rebuild the image after changing it).

## Deployment
Production: https://tensor-typing.98-70-53-61.sslip.io on a shared Azure VM (Ubuntu 24.04, `ssh -i ~/my-keys/ssh-key azureuser@98.70.53.61`) that also hosts another app (`algoleaderboard`, port 3000, its own DB) — never modify or remove its resources.
- No Docker on the VM. The app runs as the standalone build under systemd: `tensor-mactober.service` (`deploy/systemd/`), user `tensormactober`, code in `/opt/tensor-mactober/app`, env in `/opt/tensor-mactober/app.env` (root:tensormactober 640; `ADMIN_PASSWORD_HASH` is single-quoted so systemd keeps the `$`), listening on 127.0.0.1:3100.
- Database: native Postgres 16, database + role `tensor_mactober`, socket-only (`?host=/var/run/postgresql`); the socket is restricted to group `lbdb`, which the service user belongs to. `max_connections` is 30 shared with the other app, hence `PG_POOL_MAX=8`.
- nginx site `/etc/nginx/sites-available/tensor-mactober` (`deploy/nginx/`), certbot webroot cert. It has a dedicated `location /api/live` with `proxy_buffering off` and a long read timeout for the SSE stream — copy the updated conf and `nginx -s reload` when deploying the live leaderboard. It overwrites `X-Forwarded-For` with `$remote_addr` (the admin login rate limiter trusts its first entry), serves HTTPS only (the admin cookie is `secure`), and has no per-IP rate limits (classrooms share a NAT IP).
- To redeploy: build in a copy of the repo (`npm ci && npm run build`, then copy `.next/static` into `.next/standalone/.next/static` **and** `public/` into `.next/standalone/public` — the standalone build omits both, and `public/` holds the logo and favicon), replace `/opt/tensor-mactober/app` with `.next/standalone`, `systemctl restart tensor-mactober`. Schema changes: apply with `psql` as `tensor_mactober`.
- `docker-compose.yml` (bundled `db` + `web`) is for local/self-contained runs; it isn't used on this VM. The in-memory fallback is per-process, so production requires Postgres.

## Repo notes
Files ending in `.backup`, `.save`, `.before_*`, `*_fix_backup`, `.batch_backup` under `src/` are stale manual backups, not live code — ignore them when searching or editing.
