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

**`CREATE TABLE IF NOT EXISTS` cannot repair schema drift.** The Turso archive schema was
generated with it, so once a migration added a column to the primary, the archive could never
catch up: regenerating and reapplying appeared to succeed while every insert failed with
`table X has no column named Y`. Twelve tables had drifted this way by 2026-08-16
(`profiles.is_test_user`, `posts.blog_category`, `vocabulary.transitivity` and others), and
none of it surfaced while Turso was simultaneously misconfigured and failing for a different
reason. The generator now emits `DROP TABLE IF EXISTS` + `CREATE TABLE`, which is safe only
because Turso is a pure snapshot target rewritten in full on every run — apply it immediately
before a backup, never on its own. **Any migration that adds a column silently breaks the
Turso archive until the schema is regenerated.**

**One oversized table can deadlock a resumable job.** Committing progress per batch is not
enough if a single item exceeds the platform's timeout: `content_events` (5,332 rows) takes
**123 seconds** to archive — 27 sequential Turso round trips plus a 3.7 MB R2 upload — against
a ~30s ceiling, so the run wedged on it and 502'd forever. Per-item commits fix the batch
case; work genuinely larger than an invocation has to move off the platform entirely. Eight
tables exceed 2,000 rows here; the largest is 11,550.

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
- **`writeToTurso` has no retry, and the largest tables need dozens of sequential calls.**
  `examples` is 11,550 rows at 200 rows per chunk — **58 HTTP round trips**, any one of which
  fails the whole table (`turso: fetch failed`, observed 2026-08-16). The chunk loop should
  retry a failed chunk a couple of times with backoff before giving up; without it the biggest
  and most valuable tables are the ones most likely to be missing from the archive. R2 is
  unaffected — it is a single upload per table.

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


---

## 2026-08-16 — Video Studio round 2

Seven tracks on `feat/video-studio-round-2`. What matters later is the traps, not the features.

### Gotchas found

**`npm run db:migrate` had never worked against Neon.** `getDriverFor("neon")` returned the
`neon()` HTTP function cast `as unknown as PgDriver`. That function's `.transaction()` takes an
**array of queries**; `PgDriver` declares it callback-style. The cast typechecked and threw
`transaction() expects an array of queries` the first time anything called it — which was
migration 147, because no app code had ever used `sql.transaction()`. Ordinary queries still go
over HTTP; only the transaction path now checks out a `pg.Pool`, preferring `DATABASE_URL_DIRECT`.

**Chunking a large generation makes the timeout WORSE, not better.** Splitting whole-scope
generation into scene-aligned batches is correct — a level is 2,820 slots that no single
8,000-token response could carry — but it turns one slow call into 71. Measured against the live
API: a 4-item topic is 1 call / 3.2 s; a 3-lesson submodule is 3 calls (one retry) / **31.4 s**,
already past the ~30 s ceiling. `MAX_BATCHES_PER_REQUEST = 2` is that measurement, not a guess.
Oversized scopes are refused before spending, and `generating_script` is only set *after* the
guard — setting it first is how a project gets stranded in that status forever.

**Ordering by the JLPT level string puts N1 first.** `ORDER BY jlpt_level` is alphabetical, so a
thematic search on a beginner-focused site returned 鳩 鶏 鶴 鷹 — every one N1. Any query ranking
content for learners needs an explicit `CASE WHEN 'N5' THEN 1 …`.

**`ILIKE '%term%'` is unusable for meaning search.** Measured: `cat` 96 rows (category, indicate,
educate), `one` 240 (money, phone, alone), `hand` 32. Word boundaries (`~* '\yterm\y'`) cut those
to 2, 114 and 15. What boundaries cannot fix is semantics — an expanded bird set still matches
俯瞰 "bird's-eye view" — so a human confirm step is structural, not polish.

**`ON CONFLICT` must restate a partial index's predicate.** `idx_video_bgm_external` is
`UNIQUE (source, external_id) WHERE external_id IS NOT NULL`. `ON CONFLICT (source, external_id)`
alone fails with "no unique or exclusion constraint matching"; the `WHERE` clause has to be
repeated in the conflict target.

**grep silently skips `src/lib/video/tts.ts`.** It contains Japanese characters, so `file` reports
it as `data` and grep treats it as binary — returning *nothing*, not an error. Several "that
function doesn't exist" conclusions were false negatives. Use `grep -a` on any file with CJK.

**Jamendo's `license_cc=commercial` is not a commercial-use filter.** It surfaces tracks you may
*buy* a licence for, whose CC url is still NonCommercial. Of 20 popular results for one query, 19
were `by-nc-*` and one was usable. Verify `license_ccurl` itself, and order by downloads rather
than popularity — the most popular tracks are overwhelmingly NC, so popularity spends the page on
results that get rejected.

### Still needs a human

See [VIDEO_MANUAL_STEPS.md](VIDEO_MANUAL_STEPS.md). Two gated steps: mascot artwork (generator
verified working 2026-08-16; 8 of 16 ids have art) and cloned voice (needs ~60 s reference audio
per language and an hourly GPU — an M1/8 GB is below Chatterbox's floor).

### Architecture changes

- **Migration 147**: `video_projects.captions` / `.branding` JSONB, `scope_kind` widened with
  `topic`, partial unique indexes on `video_content_links`.
- **Caption style is read at RENDER time from the project**, not from the storyboard's frozen
  copy — the opposite of branding, deliberately. Branding is frozen so a re-render reproduces what
  was approved; caption size is changed *because* the approved render was wrong. Restyling is
  therefore a re-cut with no LLM or TTS spend.
- **`video-render.yml` now passes `DEEPSEEK_API_KEY`**, which it never did. Every CI render logged
  "Social copy: skipped" while the same worker on a Mac generated it fine.
- **TTS has a provider registry** (`src/lib/video/ttsProvider.ts`). Nothing is registered by
  default, so Google is unchanged. Cloned voices are resolved from the voice *name*
  (`cloned:avnish-en`), because a project will mix a cloned English narrator with Google's native
  ja-JP — a voice cloned from English audio reading Japanese is confident mispronunciation.
  Generation happens off-box (`npm run voice:clone` against a GPU) and writes into the existing
  content-hash cache, so the CPU-only runner never loads a model.

---

## 2026-08-17 — Video Studio round 3

Backlog cleared. Full write-up in [VIDEO_PIPELINE_PLAYBOOK.md](VIDEO_PIPELINE_PLAYBOOK.md); the
traps are here.

### Gotchas

**Measure speech rates on SENTENCES, not on cached clips.** A TTS clip carries ~0.36s of fixed
onset and decay whatever its length, so `"cat"` alone reads at 4.43 c/s where a sentence reads at
16.36. The original constants were pooled over real cached clips — the Japanese set was 30 clips
totalling 169 characters, i.e. single words — so they measured mostly overhead and every duration
estimate ran long. Re-measured on 15 sentences per language, prediction error against four real
renders fell from 19.6% to 7.4%. `npm run video:measure-rates` reproduces it.

**Chunking a large generation makes the timeout worse, not better.** It converts one slow call into
many. Measured: a 2-batch submodule takes 31.4s against a ~30s ceiling. The request path caps at 2
batches and dispatches anything larger to `video-script.yml`.

**A client component importing one constant can drag `pg` into the browser bundle.** `blankScene.ts`
imported `newSceneId` from `storyboard.ts`, which reaches `src/lib/db` through `load-prompts`. The
production build failed with "Can't resolve 'fs'" — and `tsc` and `next lint` both passed first.
Run `npm run build` before committing anything a client imports.

**FCPXML time values must be exact rationals.** `300/30s`, never `10.0s`; a decimal is rejected or
silently rounded and the error accumulates into audio drift. All formats are 30fps, so every value
is `frames/30s` computed in integer frames.

**`ON CONFLICT` cannot infer a partial index without its predicate.** `idx_video_bgm_external` is
`UNIQUE (source, external_id) WHERE external_id IS NOT NULL`; the `WHERE` has to be restated in the
conflict target or Postgres rejects the statement.

**Postgres `unnest` into a uuid column needs a per-row cast.** Passing a `text[]` for `asset_id`
fails with "column is of type uuid but expression is of type text"; `a::uuid` inside the SELECT
keeps NULLs working where an array-level cast would not.

### Changes

- Migration 150: `narration_lang` CHECK widened for `hinglish` on storyboards and renders.
- **Hinglish** is a fourth narration language — romanised, `en-IN-Neural2-A`, emitted publicly as
  `hi-Latn` because `hinglish` is not a BCP-47 tag and it reaches `<track srcLang>` and schema.org
  `inLanguage`.
- `video-script.yml` generates scripts for scopes too large for a request. No Chromium, no ffmpeg —
  it writes text.
- `video_render_artifacts` is populated for the first time, with a real `from_cache` flag.
- Renders now write an `.fcpxml` timeline and a chapters file beside the video. Deliberately not a
  zip: a media bundle measured ~48MB per render duplicating a video already in R2.
- Scene-level regenerate and insert; Shorts cut from long videos, reusing cached narration.
- Regenerating a script no longer drops a project out of `render_ready`.

---

## 2026-08-18 — Video round 4: a Shorts register, beat sync, asset library

**What changed.** Vertical videos now generate and render under a separate `shorts` style preset:
items split into 2–3 short beats, a camera that keeps moving for the whole scene, real scene
transitions, a spoken hook, word-by-word captions, and cuts quantised to the music.
`video_projects.style_preset` (migration 151), `video_tts_assets.word_timings` (152),
`video_bgm_tracks.bpm/beat_offset_seconds/bpm_confidence`, and a new `video_assets` library.

**Why.** Format had *no effect on timing anywhere*: `buildTimeline` took a format and used it only
to read `fps`, and all four formats are 30fps, so a vertical render was frame-identical to a
landscape one. There was no Shorts path to improve.

### Gotchas found, each with the measurement

**A fixed-window beat quantiser silently never fires.** Scene lengths come from measured narration,
so consecutive scenes sit at a near-constant offset from the beat grid — five 2.833s scenes against
a 0.5s grid leave a remainder of 0.333s *every time*, outside a 150ms window at every cut. The
feature was fully implemented, passed review, and moved nothing. Window is now half a beat capped at
250ms: 5/5 cuts on the grid, was 0/5. **If a feature can do nothing without erroring, assert that it
did something.**

**Google TTS returns word timings only on `v1beta1`, and `v1` ignores `enableTimePointing`
silently.** No error, no warning, empty `timepoints`. Cost an hour of assuming the marks were wrong.

**Adding SSML marks would have invalidated the entire TTS cache.** The key is
`sha256(ssml + voice + rate + pitch)`; marks change the string but not one audio sample. 450 clips
would have been re-billed. The hash is now computed on the mark-free SSML with timings stored in a
separate column. There is an explicit assertion that the digest is unchanged.

**`tsconfig.json` excludes `scripts/`.** `tsc --noEmit`, `next lint` and `npm run build` were all
green while `scripts/lib/chromaMatte.ts` referenced an undefined `KEY_DISTANCE` — I had extracted a
helper and left the constant behind in the caller, so `npm run video:mascots` would have thrown
`ReferenceError` at the first pixel. A second bug in the same commit read `MASCOT_CHROMA.name`,
which does not exist. Added `tsconfig.scripts.json` + `npm run typecheck:scripts`, scoped to the
video-pipeline scripts because the older ones carry long-standing errors and a permanently-red check
gets ignored.

**Adding one column to a hand-written INSERT touches FOUR places, and missing any one fails
differently.** `style_preset` needed: the migration, the column list, a `$18` placeholder, a value
in the array, and `PROJECT_COLUMNS` for reads. I missed two of them in separate passes:

- **`PROJECT_COLUMNS`** — every read fell back to `lesson`, so the feature would have been silently
  inert. No error anywhere.
- **The values array** — `bind message supplies 17 parameters, but prepared statement "" requires
  18`. Every project creation 500'd. This one at least failed loudly, but only at runtime, in the
  browser, after the user had filled in the whole wizard.

**Neither is visible to tsc, lint or `npm run build`**, because the query is a string and the values
are a plain array. `db.query` is used here rather than a tagged template precisely so
`PROJECT_COLUMNS` can be spliced into `RETURNING` — that is a deliberate trade, and this is its
cost. When touching that INSERT, count the columns, the placeholders and the values, then actually
call `createProject` against the database. A round-trip assertion of
`db.style_preset === row.stylePreset` for vertical-only, mixed and landscape-only took a minute and
is the only thing that would have caught both.

**`TransitionKind` had been dead since the first version.** Declared in types.ts, written onto every
scene by `storyboard.ts` at 13 call sites, read by nothing. Every scene change in every video
shipped as a hard cut, including scenes whose storyboard said `fade`. Worth grepping for *readers*
of a field, not just writers.

### Corrected assumptions

- **"88% of vocabulary pages are thin (no examples)" is wrong and out of date.** Measured:
  5,215/5,215 published vocabulary items have an example. The real gaps were grammar (182) and
  kanji (644 with neither a sentence nor an example word — not the 2,068 that lack a *sentence*,
  because `KanjiStrokeScene` renders example words drawn from the vocabulary table).
- **The mascot intro was working against the thing its own docstring claimed.** It said the beat
  "buys the first-second hook a Reel lives or dies on" while being 2.5s of `durationMode: "fixed"`
  with `narration: []` — the most expensive place in a Short to say nothing.

### Content and cost

`npm run content:backfill-examples` wrote **817 of 822** missing examples for $0.043. Grammar
coverage went 366/548 → 547/548; the kanji gap went 644 → 4.

**The containment guard was wrong on its first version, and the failures looked like bad data.**
It required the sentence to contain the pattern as a literal substring, which rejected 23 items
that were all correct. Two distinct causes, only visible by reading the rejected output:

- **Conjugation.** `〜てくださる` is demonstrated by 「教えてくださいました」, which does not contain
  「てくださる」 anywhere. Patterns inflect; the citation form rarely survives into a sentence.
- **The "pattern" is often a lesson heading, not a string.** 「い-adjective (past, negative)」 has
  exactly one Japanese character in it — 「い」 — and 「昨日は寒くなかったです。」 is a textbook-perfect
  example that happens not to contain it. Same for 「Special case: いい → よい」 and
  「やゆよ + small ゃゅょ」.

Fixed by skipping the check for descriptive headings and matching literal patterns on a **60%
prefix** of their longest Japanese run, which survives inflection because Japanese conjugates at
the tail. Ten assertions cover both directions, including two sentences that must still be
rejected. **I nearly recorded this as a data-quality problem; it was my check.**

The 5 that remain need a human and will not resolve by retrying: four are rare kanji (膚, 准, 斥,
錮) where the model substitutes a common alternative every time — 肌 for 膚, 準 for 准 — and
rejecting that is correct, since a sentence without the character teaches nothing. The fifth is
`Vさせてもらう`, where the causative attaches per verb class (休む → 休**ま**せて, not 休**さ**せて) so
no fixed prefix of the citation form can match.

**Not automated on purpose:** `npm run video:assets` needs a human to look at the contact sheet
before `--promote`, because chroma-keyed AI art picks up edge fringing that is only visible over a
checkerboard.


---

## 2026-08-18 (later) — Asset gallery, stickers on screen, pacing on the project page

**What changed.** `video_assets` gained readers: an API route, a gallery on Music & Assets, and a
`StickerLayer` that draws a scene's frozen sticker in Shorts. All 16 mascots promoted. A Pacing
panel on the project page, split into a free re-cut and a paid rewrite, with apply-to-batch and a
lesson-to-Shorts conversion.

### Gotchas found

**`npm run x --flag` silently hands the flag to npm.** Two `--promote` runs did nothing but print a
`Unknown cli config` warning and run another pilot. It needs `npm run x -- --flag`. The script's own
tail message now prints the full command including the `--`.

**A pilot message told the user to use the flag the file's header warns against.** `generate-mascots.ts`
said "re-run with --apply" while its docblock explains --apply regenerates and ships a different
cast than the sheet just approved. The one line anyone reads after a run named the wrong flag.

**`GENERATED` was hand-maintained, which made promote a silent no-op.** Copying art into `public/`
without editing the array leaves the ids invisible to `isGenerated()`, so nothing selects them.
`--promote` now rewrites the block. The diff it prints was itself wrong first time — the regex
`GENERATED[^[]*\[` matched the `MascotId[]` **type annotation's** brackets and captured an empty
string, reporting all 16 as new. Anchor on the assignment, not the identifier.

**"Free" was a lie until measured.** The re-cut transform clones a Japanese segment to add a repeat,
and the claim is that it costs nothing because the clip is content-hashed. It was not: `buildSsml`
renders `leadInSeconds` as a `<break>` **inside the SSML**, so a clone with a lead-in no existing
segment used produced a different hash — three clones, two distinct hashes, one synthesis charge.
Fixed by copying the lead-in from an existing segment in the run. Asserted: every repeat count from
1 to 3, from both a 1× and a 2× starting point, resolves entirely from cache. **If a panel claims a
change is free, assert the hash, not the intent.**

**A flat default silently shortens content.** `examplesPerItem` replaced hardcoded slices that
differed per skeleton — kanji 2, grammar 3. A single default of 1 would have cut a third of the
content out of every grammar video with nothing failing. Defaults are now per-kind.

**Tag matching without scoring picks nonsense.** A "does any tag match" test gave a ramen lesson
`banana-sponge`, because both carry the tag "food" and it took whichever sorted first. Scoring by
specificity — slug words above tags, longer tags above short generic ones — gives 6/6 sensible.

**`video-doctor` reported a blocking problem on a healthy database** by asserting
`video_publications`/`video_publish_targets`, which migration 143 deliberately drops. A permanently
red doctor trains you to skip its output.

### Measured, and worth knowing before promising a feature

- Examples per item is only a meaningful control for **grammar**: 4.39 average, 67% have two or
  more. Vocabulary is 12% and kanji 16%, so the same slider does almost nothing there. The panel
  says so rather than offering a knob that quietly no-ops.
- 46 assets: 16 food, 14 object, 6 animal, 6 character, 4 texture. Textures and characters are
  excluded from scene decoration — a texture is a full-bleed background, and a second character
  competes with the corner mascot.


---

## 2026-08-18 (later still) — The Shorts preset never reached generation

**Nine of nine Shorts projects had lesson-shaped scripts.** Zero Shorts storyboards existed and no
sticker had ever been placed, while the admin badged the projects "SHORTS" and the wizard priced
them as Shorts.

**Cause.** `generateStoryboard` in the admin's generate route was never passed `stylePreset` or
`decorAssets`. I added them with a scripted edit that matched the `buildGenerationRequest` call
above it and did not match the real generation call, which is formatted differently. So **the cost
estimate was calculated for a Short and the video was built as a lesson.** The CLI worker did pass
them, which is why my smoke test through `npm run video:script` produced a correct Shorts storyboard
and I concluded the feature worked.

### Gotchas

**An optional config field with a legitimate default fails silently.** `stylePreset?:` meant a
caller that forgot it compiled and got `lesson` — a real value, not undefined. Making it
**required** turned the omission into a build error, and doing so immediately surfaced a *second*
call site (the generate preview) that had the same bug, so previews were lesson-priced too.

**Scoping the scripts typecheck left a hole exactly where it mattered.** `tsconfig.scripts.json`
did not include `video-script-worker.ts`, so when I tested that the new required field would fail
the build, it did not — and the same gap had already let two undefined functions ship: the worker
called `listDecorAssets` and `beatGridForTrack` with no import, because that file uses dynamic
imports inside `main()` and my top-level import line never matched. **The worker was broken at
runtime and the repair plan depended on it.** A partial typecheck is most dangerous where you
assume it is complete.

**Verify the artefact, not the estimate.** The generate route returned a correct Shorts cost while
producing a lesson. A test asserting the response would have passed.

**Decoration keyed on scene index makes one sticker hop.** Three beats teaching いぬ all match
`akita-loyal`, and alternating corners by index made the dog jump left/right/left across the cuts.
Keyed on the slug instead, a sticker keeps one corner.

### Version history

`video_storyboards.change_summary` (migration 153) records what changed at the moment of the
change, because `source` is too coarse — a re-cut, a rewrite and a preset switch are all
"human_edited" or "regenerated". `src/lib/video/storyboardDiff.ts` computes a diff for versions
predating the column; verified against a real four-version history, it reports the re-cut as
"3 → 4 Japanese clips" and the rewrites as word-count changes.

`STORYBOARD_COLUMNS` needed `parent_storyboard_id` **and** `change_summary` adding — the same
"column exists on the table but not in the SELECT list" failure that made `style_preset` read as
`lesson` everywhere. Adding a column touches the migration, the insert, the placeholder list, the
values array, the row type, the mapper and the SELECT list. Miss any one and it fails differently.

### Result

`npm run video:fix-shorts` regenerates any Shorts project whose script was built as a lesson, by
calling the worker rather than reimplementing generation, and refuses to report success on a project
that is still wrong. All nine now render as 6-scene Shorts with three stickers each.

---

## 2026-08-22 — Roadmap 6.1–6.10: the learning-system phases

**What changed.** Seven format templates as data; a recall round; attachment to lessons, modules and
submodules with validation; a `teaching` motion profile and emphasis primitives; teacher poses per
narration beat; level-adaptive pacing and prompts; reading and listening formats. Migrations 153–155.

### The recurring failure, now named in three places

**Configuration that looks wired and does nothing.** Four such fields already existed
(`Scene.pacingOverride`, `VocabListVisual.highlightSchedule`, `BLOCK_TYPE_TO_SCENE`,
`QuizQuestionVisual.thinkingSeconds`). I then produced a fifth: **five templates with no picker, no
column and no reader** — one commit from shipping. Caught only by asking "what selects this?"

`thinkingSeconds` is the instructive one: declared on the visual since the scene existed, while the
component derived its reveal from scene length alone. So "give them two seconds to answer" was
silently ignored, and a recall round is exactly that instruction. Fixed, and extracted as a pure
`quizRevealFrame()` **specifically so it can be asserted** — buried in a component body the only
proof would have been watching a video, which is how it stayed inert.

**Adding a column touches five places** — migration, INSERT, placeholder, values array, row
type/mapper, and `PROJECT_COLUMNS`. Missing the SELECT list made `style_preset` read as `lesson`
everywhere. `template_id` was round-tripped against the database rather than assumed.

### Corrections I had to make to my own claims

- **"main is 37 commits behind with none of the Shorts code" was false.** My `origin/main` ref was
  stale because I checked without fetching. Main had everything; PRs #33–35 were already merged.
- **"the nine Shorts were rendered by old lesson code" was mostly false.** PR #33 merged at 12:31
  IST and they rendered at 14:24–14:42, so they had the camera, transitions, reveal gate, word
  captions and title bar. Only stickers (PR #34, next day) were missing. **Check timestamps before
  claiming a render predates a feature.**
- **Template lengths** were written as "about ten/eleven minutes" for kanji and grammar before
  measuring. They are 5.7 and 6.0 at N5.

### Gotchas

**Motion profiles had to be decoupled from style presets.** They were the same thing, so giving
long-form any motion would have restyled every lesson ever rendered. `lesson` now returns an
identity camera — asserted at exactly 1.0000 — and a format opts in via its template.

**Emphasis must be a window in time.** A spotlight that is simply on is decoration; one bounded by
the narration segment that mentions the thing is teaching. `useSegmentWindow` reuses the beat frames
the camera already publishes, so it cannot drift from the audio.

**A skeleton that skips bad input hides a content gap.** Only 5 of 47 reading posts carry
`meta.sentences` (all N5), so a three-passage template produces one passage. Skipping is correct —
inventing a passage from the summary would be worse — but it is silent, and the estimate showing
0.8 minutes is the only signal.

### Still blocked on content, not code

- `dialogue`: zero published conversation posts.
- `kana_grid`: the `kana` table has no `post_id`, and every scope path resolves through posts. Needs
  a new scope kind.
- Reading beyond N5: 24 posts across N1–N4, none with sentences.
