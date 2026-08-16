# Engineering log

Durable record of how the infrastructure works, what to avoid, and what is still open.

**Read the Gotchas section before touching databases, crons, or deploys.** Most entries there
cost hours to find and are invisible from the code alone.

**Update this file** at the end of any session that changes architecture, infrastructure, or
data flow. A `Stop` hook in `.claude/settings.json` will remind you; the hook fires whether or
not anyone remembered.

Last substantive update: **2026-08-15**.

---

## 1. Current architecture

### Databases

| role | where | notes |
|---|---|---|
| **Primary** | Neon, `ep-wispy-shape-a197ohmj-pooler`, ap-southeast-1 (Singapore) | PostgreSQL 17.10, 144 public tables, ~71 MB. Serves all app traffic. |
| **Hot standby** | Supabase, project `exyllklglworcqcqzxfj`, pooler ap-northeast-1:6543 | PG 17.6. Schema-identical to the primary, 144 tables, 144 primary keys. Kept current by replication, not backups. |
| **Shadow** | Hostinger VPS, Mumbai, `postgres:17` container on `127.0.0.1:5433` | PG 17.11. Nightly full reload. Not in the replication topology; not yet serving anything. |
| **Routing flag** | Turso (`libsql`), `db_failover_flag.active_provider` | Single row. Decides which Postgres serves traffic. Currently `neon`. |
| **Archive** | Turso (138 tables) + Cloudflare R2 (`db-backups/`) | PK-less snapshots, written by `src/lib/db-backup.ts`. Correct for an archive; not restorable as a live database. |

**Auth lives on the primary**, in `user_auth` and `profiles` — both keyed on `email`, not `id`.
Supabase is a standby, *not* an auth provider. Any doc claiming otherwise predates 2026-08-14.

### How a query is routed

`src/lib/db.ts` exports a `sql` proxy that resolves the active provider per call:

- Until `SUPABASE_DATABASE_URL` is set, it always resolves to the primary with no Turso lookup.
- With both configured, `resolveActiveProvider()` reads the Turso flag (5 s cache) and returns
  the matching driver. On a Turso read failure it falls back to the last known-good value, then
  to `DB_PROVIDER_FALLBACK` (default `neon`).
- `src/lib/db/pg-shim.ts` normalises every driver to the same interface, which is why ~300
  existing `sql\`...\`` call sites never changed when providers were added.

### Replication (primary → standby)

`src/lib/db/replication-poll.ts`, two tiers over one PK-matched upsert path:

- **Tier 1** — 13 tables including `profiles` and `user_auth`, every few seconds.
- **Tier 2** — every other replicable table, hourly, drained in slices via
  `?tier=full&offset=N` because planning a table costs several round trips and all ~137 cannot
  fit in one function invocation.
- The primary key comes from `information_schema`, **not** assumed to be a column named `id`.
- `NEVER_REPLICATE` covers control-plane tables: replication cursors, failover state, backup
  bookkeeping, and `schema_migrations` (each database records what *it* ran).
- One table cannot sync incrementally: `learning_content_migration_map` has no timestamp column.

### Scheduling

Crons are declared in **`.github/workflows/crons.yml`**, not `vercel.json` (deleted — see
Gotchas). A `401` aborts the run loudly rather than reporting green.

`.github/workflows/content-review.yml` drains the content-review queue hourly, because those
jobs exceed the platform's function ceiling. `video-render.yml` exists for the same reason.

### Backups (`vps/`)

- `backup.sh` — nightly `pg_dump` of the primary to VPS disk **and** R2. Retention 7 daily /
  4 weekly / 6 monthly, weekly and monthly as hardlinks so a snapshot costs disk once.
  Refuses to keep a dump under 1 MB or one `pg_restore --list` cannot parse.
- `restore-test.sh` — weekly, restores the newest dump into a throwaway database and asserts
  row counts on `profiles`, `user_auth`, `orders`, `payments`, `entitlements`,
  `user_subscriptions`. Fails if the newest dump is over 48 h old.
- `shadow-refresh.sh` — nightly reload of the VPS from the primary. **This is not a backup.**
  It mirrors, so anything deleted on the primary is deleted here the next night.

### VPS proxy (`vps/`)

Netlify Functions have no static egress IPs, so a Postgres port would have to accept the whole
internet. Instead Postgres stays on a private Docker network and Traefik routes TLS to a small
authenticated proxy at `api.japanesewithavnish.com`. `src/lib/db/http-driver.ts` speaks to it
and implements the same `PgDriver` interface. `queryBatch()` sends many statements per round
trip — **measured 9.6× faster than sequential in production**.

---

## 2. Gotchas

Each carries the measurement that found it. Do not take these on trust — but do not re-derive
them from scratch either.

**Netlify's function ceiling is ~30 s, not ~10 s.** An 18.4 s request returns 200; a 502
arrived at exactly 30.55 s. I asserted "~10 s" for most of 2026-08-15 and designed against the
wrong number. Measure before designing around a limit.

**`maxDuration` is a Vercel directive.** No evidence Netlify honours it: the route that died at
30.55 s declared none, while `replication-poll` declares 60 and has never been observed running
that long. Do not add it and assume it took effect.

**`pg_restore` refuses archives from a newer major version.** The VPS shipped `postgres:16`
while the primary was 17.10, which would have failed every restore in the migration. Match the
major version.

**A custom-format dump must be seekable.** `pg_restore --list /dev/stdin < file` fails —
a pipe cannot seek. Give the container a real file path (bind mount) instead of streaming.

**Next.js patches global `fetch`.** Without `cache: "no-store"`, a query response can be served
from its data cache — which presented as a **1 ms round trip to Singapore**, physically
impossible. In `src/lib/db/http-driver.ts` this is a correctness issue, not a performance one:
a cached POST means serving stale rows. Never remove it.

**Both Postgres drivers parse `json`/`jsonb`.** What comes back is a JS value, never JSON text,
so it must be re-serialised on write. An array otherwise renders as a Postgres array literal
(`{a,b}`) and a JSON string arrives bare — each rejected as `invalid input syntax for type
json`. This alone broke 11 tables.

**Netlify env changes need a redeploy** to reach already-running functions. Setting a variable
in the dashboard is not enough.

**`raw.githubusercontent.com` caches for 5 minutes** (`cache-control: max-age=300`). Fetching a
file immediately after pushing it serves the old one. Use a cache-buster or wait.

**A `.gitignore` negation cannot re-include a file inside an excluded directory.** Git does
not descend into an ignored directory at all, so `!docs/FILE` under `docs/` silently does
nothing — the file stays untracked and `git status` never mentions it. Exclude the *contents*
(`docs/*`) to keep the directory walkable. This file was invisible to git until that was
fixed; `docs/` has been ignored since the first commit on 2026-02-26.

**Claude Code hooks need a nested `hooks` array.** `.claude/settings.json` carried three
entries in a flat `{matcher, command, timeout}` shape, which fails schema validation
(`required: ["hooks"]`), so **none of them had ever fired** — while `CLAUDE.md` claimed "the
graph auto-updates on file changes (via hooks)". `PreCommit` is also not a valid event, and
`timeout` is in **seconds**, not milliseconds. Config written in a shape the platform does not
parse is the same failure as `vercel.json`: it looks configured and does nothing.

**Replication copies table by table, so children can land before parents.** `video_events`
sorts before `video_renders`. Inserts run with `session_replication_role = replica` inside a
transaction to suppress FK triggers.

**Large batches over a long-haul link stall.** `REPLICATION_BATCH_SIZE=10000` died with
`ETIMEDOUT` mid-statement; 2000 is safe for a backfill.

**Supabase's pooler needs a tenant-qualified username** (`postgres.<project-ref>`), and
`db.<ref>.supabase.co` is **IPv6-only** — unreachable from Netlify and most IPv4 networks. Use
the pooler host: `:6543` transaction mode, `:5432` session mode for DDL and `pg_dump`.

**An attempt limit enforced only after work completes is not a limit.** `claimNextJob` had no
`attempt_count < max_attempts` guard; the check lived in `failJob`, which never ran when the
platform killed the invocation. One job reached attempt 31 of 3 while 491 others were never
claimed. Enforce limits in the *claim*, not the completion path.

---

## 3. Decisions

Each commit message carries the full reasoning; this is the index.

| decision | commit |
|---|---|
| Crons run from GitHub Actions, not `vercel.json` | `fix(infra): revive dead cron schedules…` |
| Supabase rebuilt from a primary `pg_dump`, not by replaying 148 hand-written migrations | Phase 1, 2026-08-14 |
| Replication keys off the real PK, not a column named `id` | `fix(db): replicate every table by its real primary key…` |
| `writeToSupabase` retired; the standby is maintained by upsert, not snapshots | same commit |
| `schema_migrations` ledger, applied to both providers by `npm run db:migrate` | `feat(db): add a migration ledger…` |
| Neon Auth removed entirely (0 sessions, no UI entry point) | `chore: remove unused Neon Auth integration` |
| VPS gets its own `postgres:17`; `shared-postgres` (PG16) untouched | `feat(vps): app Postgres 17 + HTTPS SQL proxy…` |
| Traefik + existing `mytlschallenge` resolver, not Nginx + certbot | same commit |
| Content-review draining moved to GitHub Actions | `fix(content-review): unblock the queue…` |
| Phase 3 (VPS cutover) deliberately deferred | see Backlog |

---

## 4. Timeline

### 2026-08-14 → 15 — database and cron overhaul *(verified: I did this work)*

- **Found:** all 7 cron jobs declared in `vercel.json` while the site runs on Netlify, which
  never reads it. Nothing had been scheduled since **2026-07-15**. Backups, replication,
  newsletters, re-engagement and the review worker were all silently dead.
- **Found:** Supabase was 44 tables behind, had 17 primary keys against the primary's 144, and
  `profiles`/`user_auth` were **not replicated at all** — 20 vs 15 and 14 vs 11 rows. Failing
  over would have lost 5 profiles and 3 sets of login credentials.
- Rebuilt Supabase from a verified `pg_dump`; parity reached 144/144 tables.
- Generalised replication to the real primary key; `profiles` and `user_auth` now in tier 1.
- Added the `schema_migrations` ledger (150 migrations baselined on both providers).
- Removed Neon Auth: schema, code, and env.
- Stood up VPS PostgreSQL 17 + HTTPS proxy; measured **212–231 ms vs Neon's 259–274 ms** from a
  deployed Netlify function, and **9.6×** for batched queries.
- Added backups with retention and a weekly restore test.
- Fixed the content-review queue jam and moved draining to GitHub Actions.
- Tightened Supabase security: `anon` previously held full privileges on every table with RLS
  as the sole guard; it now has none.

### Before 2026-08-14 — *[reconstructed]* from commit messages only

I did not do this work. Entries below are inferred from 78 commit messages and are **not
verified against code**. Fidelity is uneven: Feb–Mar messages are descriptive; 16 of July's and
8 of August's commits read only `changes`, `push` or `done` and support no honest
reconstruction. Where a period is thin, that reflects the record, not the effort.

- **2026-02-26 → 02-27** *[reconstructed]* — MVP: admin panel, coupons, newsletter, JLPT tabs,
  homepage, blog, quiz/learn/store/checkout/library, product admin.
- **2026-03-03 → 03-19** *[reconstructed]* — Order detail and payment emails; **Neon and R2
  migration**; chatbot, analytics, social, SEO, sitemap ping; DeepSeek/Gemini model selector;
  contact pages; curriculum lesson hub generation; Learn navigation.
- **2026-06-17 → 06-18** *[reconstructed]* — Sales pages hidden from public; feedback widget.
  Only 2 commits this month.
- **2026-07-05 → 07-21** *[reconstructed]* — The largest burst (34 commits): adaptive placement
  quiz, Kana Practice Portal, JLPT kanji definitions, curriculum browser redesign, guest access
  locks, legal overhaul, rate limiting, unified Learn listing UI, Netlify config added. 14
  migrations. 16 commits carry no usable message.
- **2026-08-06 → 08-13** *[reconstructed]* — SEO fixes (`og:url` fallback, leaked admin review
  note), feedback changes, long-video work. 8 commits carry no usable message.

---

## 5. Open backlog

### Database / infrastructure

- **Phase 3 — VPS cutover, deferred.** Provider rename `neon` → `vps` (21 strings, 9 files),
  only meaningful at cutover. A checkpoint agent fires 2026-08-22
  (`trig_01Kj4CXkpbCwJFo4qa7tG5iX`).
- **The reproducible ~645 ms second call** on the VPS proxy, in both latency runs. A second
  connection establishing before undici's pool settles. Matters on a platform that cold-starts.
- **Re-derive the latency bar.** The agreed ~20% came from a *cold-connect* 262 ms figure for
  Neon; warm Neon measures 259–274 ms from Netlify.
- **Batching** — `queryBatch()` is 9.6× faster and **works on Neon today with no cutover**.
  The highest user-visible win outstanding. Find pages issuing many sequential queries.
- **`learning_content_migration_map`** — no timestamp column, cannot sync incrementally.
- **Retire `users`** — 0 rows in both providers while `profiles`/`user_auth` hold the real data.
  Left in `TIGHT_REPLICATION_TABLES` as a trap for the next reader.

- **Turso archive writes are failing — every table, every run.** `backup_sync_log` shows
  `turso: Turso not configured` × 138 on the latest run: `TURSO_DB_URL` /
  `TURSO_DB_AUTH_TOKEN` are set locally but **not in Netlify**, so the entire Turso archive
  tier has written nothing since backups resumed. R2 is unaffected. Found 2026-08-15 by the
  first run of the weekly report — exactly the kind of silent failure it exists for.
  Note Turso also holds `db_failover_flag`; routing still works because that is read with
  credentials from a different code path, but this needs the env vars set in Netlify.
- **One table still reports a replication error** on the standby. Surfaced by the weekly
  report; check `replication_poll_state WHERE last_error IS NOT NULL`.

### Application

- **491 queued content-review jobs.** Needs `DEEPSEEK_API_KEY` as a GitHub Actions secret, then
  draining. ~7 LLM calls per job; the `$5` daily cap will pace it over several days.
- **The poison job** that failed 7 times on a `grammar` entity needs *inspecting*, not
  retrying. The reaper now removes it, but the underlying cause will recur.
- **`sheets-export` returns `{"status":"not_configured"}`** and has been no-opping every 30
  minutes. Configure it or drop it from the schedule.
- **`reengagement-nudge` processes 1 of 17 eligible per daily run** — 17 days to clear. Not a
  timeout (8.8 s); a throughput choice.
- **`site_settings.progression_rules` contains the literal string `"[object Object]"`** in the
  primary. Something stringified an object instead of serialising it. Replication copies it
  faithfully; it is an app bug.
