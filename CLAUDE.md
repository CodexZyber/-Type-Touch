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
- No realtime: the leaderboard page polls every 3s.
- Leaderboard ranking in Postgres mode is the SQL function `get_event_leaderboard()`; in memory mode it is reimplemented in TS inside `EventService.getLeaderboard`. These two must stay in sync.

### Database
Schema lives in `db/init/001_schema.sql`, which the `db` compose service runs automatically on first start (empty volume only — apply later changes manually with `psql`). Incremental changes for existing databases go in `db/migrations/NNN_*.sql` (idempotent `ADD COLUMN IF NOT EXISTS` style) **and** are folded into `001_schema.sql` for fresh installs; `002_keystroke_metrics.sql` adds `raw_wpm`, `total_keystrokes`, `incorrect_keystrokes`, `corrections` and must be applied to production before deploying code that inserts them. Tables `events`, `participants`, `attempts`; functions `get_server_time()`, `get_event_leaderboard()`; seed event. IDs are UUIDs with DB defaults — don't generate string IDs for inserts. Types mirroring the tables are in `src/types/index.ts`. `supabase/migrations/` is the legacy Supabase schema and is no longer used.

### Event lifecycle & rules (enforced server-side in EventService)
- Status: `NOT_STARTED` → `LIVE` (start sets `start_time`/`end_time` from `event_duration`) → `ENDED`. Pause returns to `NOT_STARTED`. `getActiveEvent` auto-flips LIVE→ENDED once `end_time` passes.
- Config (`updateEvent`) is rejected while LIVE.
- `submitAttempt` requires LIVE, enforces `max_attempts` (null = unlimited), and scores the attempt server-side with `computeAttemptMetrics` in `src/lib/utils/typing.ts` (TypeSprint/Monkeytype convention): correct/incorrect characters are recomputed from `typedText` vs the event passage (client counts are not trusted); net WPM = `(correct chars/5)/minutes` over the actual elapsed time (sub-second, capped at `test_duration`); `raw_wpm` counts all typed chars; **accuracy is keystroke-based** = `(total_keystrokes - incorrect_keystrokes)/total_keystrokes`, where the client tracks keystrokes via `diffKeystrokes` and backspacing never undoes a mistype. The server clamps the client's keystroke counters so they can't be lower than what the final text implies. `incorrect_keystrokes` = mistypes, `incorrect_characters` = uncorrected typos. `qualified` when accuracy ≥ `minimum_accuracy`. The live HUD uses the same function.
- Admin control actions and config saves both go through `PATCH /api/event` (`{action}` for start/pause/end/reset, otherwise `{updates}`).

### Time
All timing is server-authoritative: clients compute `serverOffsetMs` from `currentServerTime`/`serverTime` in API responses and add it to `Date.now()`. Countdown helpers are in `src/lib/utils/timer.ts`.

### Admin auth
Custom, not Supabase Auth. `src/lib/auth/admin-auth.ts` does scrypt password verification, HMAC-signed session cookie (`mactober_admin_session`), and IP-based login rate limiting. `src/middleware.ts` only checks the cookie *exists* for `/admin/*` pages; real verification is `requireAdminSession(request)`, which every admin-only API route must call.

### Frontend
- Pages poll their APIs (contest/admin every 5s, leaderboard 3s, final 4s). Client components that hold editable or in-progress state must not let polled data overwrite it — e.g. the admin config form keeps a separate draft that is only rehydrated on first load, successful save, or discard.
- `src/components/contest/TypingInterface.tsx` is the typing engine: state machine `READY → TYPING → SUBMITTING → RESULT`, deadline-based timer in a ref (independent of keystrokes), a controlled `<textarea>` for input, passage rendered as per-character spans, paste/copy blocking and tab-switch counting. It's reused by `/final`.
- Participants are identified by a browser-stored session id and participant record in `localStorage` (no student accounts).

## Environment
`.env.local` (gitignored; template in `.env.example`): `POSTGRES_PASSWORD`, `DATABASE_URL` (host `localhost` for `npm run dev`; compose overrides it to host `db`), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL` (inlined at build time — rebuild the image after changing it).

## Deployment
Production: https://tensor-typing.98-70-53-61.sslip.io on a shared Azure VM (Ubuntu 24.04, `ssh -i ~/my-keys/ssh-key azureuser@98.70.53.61`) that also hosts another app (`algoleaderboard`, port 3000, its own DB) — never modify or remove its resources.
- No Docker on the VM. The app runs as the standalone build under systemd: `tensor-mactober.service` (`deploy/systemd/`), user `tensormactober`, code in `/opt/tensor-mactober/app`, env in `/opt/tensor-mactober/app.env` (root:tensormactober 640; `ADMIN_PASSWORD_HASH` is single-quoted so systemd keeps the `$`), listening on 127.0.0.1:3100.
- Database: native Postgres 16, database + role `tensor_mactober`, socket-only (`?host=/var/run/postgresql`); the socket is restricted to group `lbdb`, which the service user belongs to. `max_connections` is 30 shared with the other app, hence `PG_POOL_MAX=8`.
- nginx site `/etc/nginx/sites-available/tensor-mactober` (`deploy/nginx/`), certbot webroot cert. It overwrites `X-Forwarded-For` with `$remote_addr` (the admin login rate limiter trusts its first entry), serves HTTPS only (the admin cookie is `secure`), and has no per-IP rate limits (classrooms share a NAT IP).
- To redeploy: build in a copy of the repo (`npm ci && npm run build`, then copy `.next/static` into `.next/standalone/.next/static`), replace `/opt/tensor-mactober/app` with `.next/standalone`, `systemctl restart tensor-mactober`. Schema changes: apply with `psql` as `tensor_mactober`.
- `docker-compose.yml` (bundled `db` + `web`) is for local/self-contained runs; it isn't used on this VM. The in-memory fallback is per-process, so production requires Postgres.

## Repo notes
Files ending in `.backup`, `.save`, `.before_*`, `*_fix_backup`, `.batch_backup` under `src/` are stale manual backups, not live code — ignore them when searching or editing.
