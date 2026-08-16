<!-- engineering log -->
## Read this first: docs/ENGINEERING_LOG.md

**Before touching databases, crons, deploys, or `vps/` — read
[docs/ENGINEERING_LOG.md](docs/ENGINEERING_LOG.md).** It holds the current architecture, the
open backlog, and a Gotchas section of traps that are invisible from the code and cost hours
each to find (Netlify's real ~30s function ceiling, Next.js caching `fetch` responses and
serving stale rows, `pg_restore` refusing newer-major archives, and more).

### Current state, in brief

- **Neon is the primary.** Supabase is a schema-identical **hot standby**, selected by a flag
  in Turso — it is *not* an auth provider. Auth lives in `user_auth` and `profiles` on the
  primary, both keyed on `email`, not `id`.
- **Crons run from `.github/workflows/crons.yml`**, never `vercel.json` (Netlify does not read
  it; assuming otherwise cost a month of dead backups).
- Long-running work (content review, video render) runs in GitHub Actions, not in a Netlify
  function — jobs exceed the ~30s ceiling.
- A Hostinger VPS holds a nightly-refreshed shadow database behind an HTTPS proxy. It serves
  no traffic yet.

Any doc that contradicts the above predates 2026-08-14 and is wrong.

### Update it

At the end of any session that changes **architecture, infrastructure, or data flow**, append
to `docs/ENGINEERING_LOG.md`: what changed, why, and any new gotcha with the measurement that
found it. Record what you got *wrong* too — the log's value is in the traps, and a corrected
assumption is worth more than a tidy summary. A `Stop` hook reminds you; do not rely on it.

Review the Open Backlog section weekly.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
