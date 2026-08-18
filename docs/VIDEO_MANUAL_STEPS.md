# Video Studio — the two steps only you can do

Everything else in Video Studio runs itself. These two need a human or a machine this project
does not have, and both are deliberately gated so nothing reaches a published video without you
having looked at it first.

- [1. Mascot artwork](#1-mascot-artwork) — ~15 minutes, costs a few Gemini image calls
- [2. Cloned voice](#2-cloned-voice) — ~30 minutes of setup, then free on Kaggle or Colab

---

## 1. Mascot artwork

**Status:** 8 characters have artwork, 8 more are declared and waiting. The generator is verified
working — `cat-point` was generated and visually reviewed on 2026-08-16, and `GEMINI_API_KEY` is
live.

### Why it isn't automatic

Image generation is non-deterministic. Running it twice gives two different cats. So the script
never writes to `public/` on the same run that generates: it produces a contact sheet, you look at
it, and a second command copies **exactly the bytes you approved**.

The other reason to look: transparency is produced by keying out a magenta background afterwards,
because no text-to-image model reliably emits an alpha channel. A failed key leaves a coloured
halo that is invisible on a white page and obvious over video. The contact sheet renders on a
checkerboard for precisely this.

### What is waiting

| Character | Poses |
|---|---|
| cat (calico, moss-green haori, bell collar) | `point`, `bow` |
| shiba (cream happi coat, red sash) | `celebrate`, `wave` |
| crane (tancho, pale blue kimono) | `think`, `bow` |
| rabbit (white, lilac yukata) | `read`, `wave` |

### Run it

```bash
# 1. Generate everything missing. Writes ONLY to video-brand-preview/ (gitignored).
npm run video:mascots

# Or iterate on one cell while tuning a prompt:
npm run video:mascots -- --only cat:point
```

Open the contact sheet it prints:

```
video-brand-preview/mascots/_contact-sheet.png
```

Check each cell for: a clean edge on the checkerboard (no magenta or grey fringe), the right
animal, the right pose, and a silhouette distinct from the others — the corner slot draws these at
180px, where a facial expression is invisible but a whole-body pose reads fine.

```bash
# 2. Ship the bytes you just approved.
npm run video:mascots -- --promote
```

**Use `--promote`, not `--apply`.** `--apply` regenerates *and* writes, which means it ships a
different cast from the one on the contact sheet you approved — it makes the review step theatre.

### Then

Add the promoted ids to `GENERATED` in [`src/lib/video/mascots.ts`](../src/lib/video/mascots.ts).
That list is what the picker offers and what the render-time fallback trusts; a mascot referenced
without artwork renders as a broken image mid-video, so it is maintained by hand rather than read
from disk (this module is bundled for the browser and has no filesystem).

Requires `GEMINI_API_KEY` — set and verified working.

---

## 2. Cloned voice

**Status:** built and tested end to end apart from the GPU step, which needs your voice.
Runs free on Kaggle or Colab — no rental required.

### Why it can't run here

Chatterbox Multilingual is MIT-licensed (commercial use fine), covers Hindi and English, and
clones from a short sample. It also needs a GPU:

- The render worker runs on **CPU-only** GitHub Actions runners.
- This Mac is an **M1 with 8 GB**, below the model's practical floor — it will swap or fail.

So synthesis happens somewhere else, once, and the result is cached. Because TTS is already keyed
by content hash in R2 and `video_tts_assets`, a clip generated on a free notebook is simply *found*
by the renderer, which never loads a model.

### Step 1 — record reference audio (~10 minutes)

Two files, roughly 60 seconds each:

```
reference/avnish-en.wav
reference/avnish-hi.wav
```

What matters, in order:

1. **One room, one mic, no music, no background noise.** A cheap mic in a quiet room beats a good
   mic in a noisy one.
2. **No processing.** No compression, no EQ, no noise reduction — the model clones what it hears,
   including your de-esser.
3. **Read normally**, at the pace you would narrate a lesson. Not slowly, not performed.
4. **Vary the sentences.** A paragraph of ordinary prose, not one sentence repeated.
5. WAV, mono, 24kHz or higher.

Reading a couple of your own lesson introductions aloud is ideal — it is exactly the register the
videos need.

**Japanese is deliberately not clonable.** A voice cloned from English or Hindi audio reading
Japanese produces confident mispronunciation, which is the worst possible failure in a teaching
video. Japanese segments keep Google's native `ja-JP-Neural2-B` even in a project narrated by your
cloned voice — this is enforced in code, not left to configuration.

### Step 2 — get a GPU, free

The job is small: a five-minute video is roughly **2–3 minutes of GPU time**. Free tiers are more
than enough.

| | GPU | Quota | Session cap | Notes |
|---|---|---|---|---|
| **Kaggle** *(start here)* | T4 ×2 or P100 | **30 h/week, published** | 12 h | Needs a phone-verified account |
| **Colab** | T4 16 GB | ~15–30 h/week, undisclosed | up to 12 h | May refuse a GPU when busy |
| RunPod / Vast | any | paid | — | ~$0.20–0.40/h if you want it now |
| AWS | g4dn.xlarge | paid | — | **No free GPU tier.** ~$0.53/h on demand, ~$0.16/h spot |

**AWS free tier does not include GPU instances** — it covers t2/t3.micro only. If you want AWS,
it is a paid option like any other, and spot pricing is the cheapest form of it. Kaggle is free
and better for this.

Kaggle's quota is the reason to prefer it: it is published and fixed, so you know before you start
whether you have hours left. Colab's is dynamic and can decline a GPU entirely at peak times.

### Step 3 — set up credentials, once (~10 minutes)

The notebook reads the work queue and writes the audio cache, so it needs database and storage
access. **Give it a scoped role, not your production credentials** — this runs on a free platform
and the notebook itself lives in a public repo.

In the Neon SQL editor:

```sql
CREATE ROLE voice_clone LOGIN PASSWORD 'pick-something-long';
GRANT CONNECT ON DATABASE neondb TO voice_clone;
GRANT USAGE ON SCHEMA public TO voice_clone;

-- Read the work list and the storyboards it refers to.
GRANT SELECT ON video_voice_queue, video_storyboards TO voice_clone;

-- Write only the cache, and only the queue's own status columns.
GRANT INSERT ON video_tts_assets TO voice_clone;
GRANT UPDATE (status, error_message, claimed_at) ON video_voice_queue TO voice_clone;
```

If that credential ever leaks from a free notebook session, the blast radius is one cache table —
not your content, users or payments.

Then a **Cloudflare R2 API token** scoped to the render bucket (ideally to the `video/tts/`
prefix), and upload your two reference files once:

```bash
aws s3 cp reference/avnish-en.wav s3://$R2_BUCKET_NAME/reference/ --endpoint-url $R2_ENDPOINT
aws s3 cp reference/avnish-hi.wav s3://$R2_BUCKET_NAME/reference/ --endpoint-url $R2_ENDPOINT
```

`reference/` is gitignored. **Do not commit your voice sample** — this repo is public, and a clean
60-second sample is exactly what someone needs to clone you. That is the whole premise of this
feature.

### Step 4 — queue the work

On your machine, point the project's voices at `cloned:avnish-en` / `cloned:avnish-hi`, then:

```bash
npm run voice:clone -- --storyboard=<storyboard-uuid> --queue
```

This walks the storyboard, skips anything already cached, and writes the rest to
`video_voice_queue`. Japanese segments are never queued — see below.

**Why queue rather than call the GPU directly.** The renderer finds audio by a hash of
`` `${ssml} ${voiceName} ${speakingRate} ${pitch}` ``, a JavaScript template string. JS renders
`1.0` as `1`; Python renders it as `1.0`. Measured on this codebase, the same segment hashes to
`ec35440e…` in JS and `2b377a23…` in a naive Python reimplementation. A notebook computing its own
key would miss the cache on **every single clip**, and because a cache miss just means
"synthesize it", the render would quietly fall back to Google and look like cloning had done
nothing. So the hash is computed once, by the code the renderer itself uses, and stored in the
queue. The notebook never derives a key.

### Step 5 — run the notebook

Open [`notebooks/clone-voice.ipynb`](../notebooks/clone-voice.ipynb):

- **Kaggle** — *Create → Notebook → File → Import Notebook*, then *Settings → Accelerator → GPU*,
  and add your secrets under *Add-ons → Secrets*.
- **Colab** — *File → Upload notebook*, then *Runtime → Change runtime type → T4*, and add secrets
  via the key icon in the sidebar.

Six secrets, named exactly: `VOICE_DATABASE_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_BUCKET_URL`. **Never paste a secret into a cell** —
the notebook is committed to a public repo, and a cell is saved with its contents.

Cell 3 wants two pre-signed URLs for your reference audio, valid an hour:

```bash
aws s3 presign s3://$R2_BUCKET_NAME/reference/avnish-en.wav --expires-in 3600 --endpoint-url $R2_ENDPOINT
```

Then *Run all*. It installs Chatterbox (~3 min), loads the queue, and generates. Progress is
durable per row, so a session dying at hour 12 loses nothing.

### Step 6 — render

Re-render the project as normal. The worker finds every clip in the cache and never loads a model,
which is why CPU-only CI runners are fine.

### What this costs

Nothing on Kaggle or Colab, and near-nothing thereafter. The cache key includes the text, so you
only ever pay for lines never spoken before — re-rendering, re-cutting for another aspect ratio,
and changing subtitles all reuse the same audio.

### Japanese is deliberately not clonable

A voice cloned from English or Hindi audio reading Japanese produces confident mispronunciation,
which is the worst possible failure in a teaching video. Japanese segments keep Google's native
`ja-JP-Neural2-B` even in a project narrated by your cloned voice. This is enforced in
`voiceForSegment`, and the notebook asserts on it again before generating anything.

### Two things worth knowing

- **Chatterbox embeds a PerTh watermark** in all output. Harmless here, but it is there.
- **A cloned voice at 90% is worse than a clean synthetic one** across a five-minute lesson. Google
  stays the default until you have listened to a full render and chosen to switch. Nothing switches
  automatically.

If a cloned voice is requested where no provider is configured, synthesis fails with an instruction
rather than silently using a different voice — a video that changes narrator halfway is worse than
one that refuses to render.

### Troubleshooting

| Symptom | Cause |
|---|---|
| `assert torch.cuda.is_available()` fails | GPU not enabled. Kaggle: *Settings → Accelerator*. Colab: *Runtime → Change runtime type*. |
| Kaggle says the weekly quota is used up | Resets weekly. Switch to Colab, or wait — check the *Accelerator* panel for the countdown. |
| Colab never allocates a GPU | Its free quota is demand-dependent and can decline entirely. Use Kaggle. |
| Reference download asserts on size | The pre-signed URL expired — they last an hour. Re-presign. |
| Session died mid-run | Re-run the notebook. `done` rows stay done; only `pending` is picked up. |
| Some rows are `failed` | `SELECT error_message FROM video_voice_queue WHERE status='failed'`. Fix, set them back to `pending`, re-run. |
| **The render still uses the Google voice** | Almost always a hash mismatch. Check `SELECT COUNT(*) FROM video_tts_assets a JOIN video_voice_queue q USING (text_hash)` — if it is 0, something recomputed the key instead of using the queue's. |

---

## Quick reference

| Command | What it does | Safe to run repeatedly |
|---|---|---|
| `npm run video:mascots` | Generates missing mascots to `video-brand-preview/` | Yes — never touches `public/` |
| `npm run video:mascots -- --promote` | Copies approved pilot art into `public/mascots/` | Yes |
| `npm run voice:clone -- --storyboard=<id>` | Lists what needs generating | Yes — read-only |
| `npm run voice:clone -- --storyboard=<id> --queue` | Sends the work to the free-GPU notebook | Yes — dedupes on hash |
| `npm run voice:clone -- --storyboard=<id> --apply` | Generates now via `CHATTERBOX_URL` (rented box) | Yes — skips cached lines |
| `npm run bgm:import` | Previews Jamendo import | Yes — read-only |
| `npm run bgm:import -- --apply` | Imports music | Yes — dedupes on external id |
| `npm run video:verify-scopes` | Checks every scope resolves and batches | Yes — no LLM calls |
