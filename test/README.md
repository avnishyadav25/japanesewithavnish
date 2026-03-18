# E2E testing (Phase 10)

Run end-to-end tests against the app (e.g. `http://localhost:3001`) using Playwright or Browser MCP. Screenshots are saved under `test/screenshots/` with descriptive names.

## Prerequisites

1. **Env:** Copy `.env.example` and set:
   - `E2E_BASE_URL=http://localhost:3001` (or your dev URL)
   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — an admin user (must be in `ADMIN_EMAILS`)
   - `E2E_STUDENT_1_EMAIL` / `E2E_STUDENT_1_PASSWORD` (and optionally student 2 & 3) — test students that exist (sign up first or seed)
2. **Dev server:** Start the app (`npm run dev`) on the port used in `E2E_BASE_URL`.
3. **Playwright:** Install once with `npx playwright install chromium`.

## Run E2E

```bash
# From project root; load .env (e.g. dotenv or export vars)
E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD=xxx \
  E2E_STUDENT_1_EMAIL=s1@test.com E2E_STUDENT_1_PASSWORD=testpass123 \
  node test/e2e-full-flow.js
```

Or use Browser MCP in Cursor: follow flows in [docs/nihongo-navi-e2e-test-guide.md](../docs/nihongo-navi-e2e-test-guide.md) and capture screenshots manually.

## Screenshots

After a run, check `test/screenshots/` for:

- `home-hero.png` — Home hero
- `login-form.png` — Student login
- `learn-dashboard-rewards.png` — Dashboard (rewards, next steps, daily checkpoint)
- `tutor-chat.png` — Nihongo Navi chat
- `quiz-result-n5.png` — Quiz result
- `scoreboard.png` — Public scoreboard
- `admin-dashboard.png` — Admin dashboard
- `admin-students-list.png` — Admin Students
- `admin-prompts.png` — Manage AI Prompts
- `review-page.png` — Review (SRS) page
- `account-settings.png` — Account/settings (when logged in)
- `curriculum-browser.png` — Student curriculum (levels → modules → lessons)
- `curriculum-lesson.png` — A lesson page with “Mark complete”

Re-run e2e after major UI changes to refresh screenshots. To test with a logged-in student and admin, set `E2E_STUDENT_1_EMAIL`, `E2E_STUDENT_1_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` in .env (or export before running).
