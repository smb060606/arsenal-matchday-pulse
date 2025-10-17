Project Rules: Arsenal Matchday Fan Stream

Summary
- Build a public blog that reflects Arsenal fan sentiment on Premier League matchdays.
- Separate live streams per platform: Bluesky, Twitter/X, Threads (Threads only if fully productizable—no mocks).
- Sentiment windows: Pre-match (T-120 to KO), Live (KO to FT, 15-min bins; collapse halftime), Post-match (FT to +60).
- Transparency: Show list of accounts used per match/platform.
- Persistence: Save per-phase summaries (pre/live/post) with sentiment/topics/samples/accounts; provide public history view.

Eligibility & Source Accounts
- Only include accounts that:
  - Are at least 3 years old, and
  - Have ≥ 500 followers.
- Prioritize the most active accounts (posting frequency and matchday activity).
- Re-evaluate accounts monthly; stale or low-activity accounts should be rotated out automatically.
- Admin overrides (include/exclude) supported with precedence:
  - match EXCLUDE > match INCLUDE > global EXCLUDE > global INCLUDE.
  - Overrides can be scoped (global or per match) and can expire; expired entries are ignored.

Budget & Platform Constraints
- Budget cap: ≤ $50/month per platform for data access/calls.
- Use an admin-only Cost-to-Cap estimator to compute X (max number of accounts) per platform based on pricing and request rates.
- Do not expose the estimator publicly; admin-only APIs/pages must be guarded (admin secret or service role).
- Threads must not be implemented unless it can be fully productized under the budget; no mock data or mock APIs.
- Twitter/X integration should only be enabled when access cost reliably fits within budget; otherwise keep disabled.
- Bluesky can be used (current code supports it); still honor budget-driven account cap.

Data Windows & Streaming
- Pre-match window: 2 hours before KO.
- Live window: From kickoff to full-time, aggregate in 15-minute bins; collapse halftime break appropriately.
- Post-match window: 1 hour after full-time.
- Implement independent SSE streams for each platform; the blog should present separate live streams per platform.

Transparency & Methodology
- Show “Accounts Used” for the current match/platform in the live view.
- Public methodology page should document:
  - Eligibility criteria
  - Override precedence rules
  - Time windows (pre/live/post)
  - Budget constraints & platform status
  - Data accessibility and any limitations

Persistence & Public History
- Persist summaries per platform and phase (pre/live/post) including:
  - summary_text, sentiment, topics, samples, accounts_used, generated_at
- Public API and page to query/display historical summaries by matchId with optional platform/phase filters.
- Live page should also surface accounts used, in real-time if possible.

Security & Operations
- Supabase: Use RLS; writes via admin/service role only in server-side routes (never in client).
- Secrets: ADMIN_TOKEN/ADMIN_SECRET are for server-side only; never expose via client bundle.
- Admin endpoints:
  - Summaries save endpoint (Bearer ADMIN_TOKEN)
  - Accounts overrides CRUD (guarded by admin secret)
  - Accounts plan/cap estimator (admin-only)
- Logging sufficient to audit budget usage and estimator assumptions (admin-only).

Testing & CI
- Maintain and expand Vitest coverage for:
  - Overrides precedence and expiry filtering
  - Accounts registry maintenance and staleness logic
  - SSE payload parsing and live page behavior
  - Summaries persistence (admin POST) and public history (GET)
  - Budget estimator edge cases
- CI should run tests on push/PR via GitHub Actions; treat failures as blockers.

Productization Constraints
- No mocks for Threads; disable until official, budget-compliant access exists.
- Keep estimator and planner views admin-only; never public.
- Respect budget caps strictly; automatically limit account count X to avoid overruns.

Developer Guidelines
- Feature branches: use feat/*; current branch for recent work: feat/match-windows-compare.
- Commit messages: conventional commits (feat, fix, chore, test, docs, ci).
- Keep changes isolated per PR; include tests for new features and bug fixes.
- Favor small, composable server routes (+server.ts) and clearly typed payloads.
- Ensure live UX is resilient to partial data or transient upstream failures.

Quick Reference (Do / Don’t)
- DO: Enforce eligibility filters; show accounts list in UI; persist summaries; guard admin routes.
- DO: Compute X (account cap) using admin-only estimator under $50/mo per platform and a safety buffer.
- DON’T: Implement Threads with mock data; DON’T leak admin tokens; DON’T exceed budget via unbounded polling.

Local Commands (for workflows)
- Run tests: npx vitest run
- Dev server: npm run dev
- Lint/format (if configured): npm run lint / npm run format

Context Pointers (files)
- Budget estimator: src/lib/config/budget.ts (+ tests)
- Admin-only planner API: src/routes/api/accounts/plan/+server.ts
- Overrides: src/lib/services/accountOverrides.ts and routes/api/admin/accounts/overrides/+server.ts (+ tests)
- Bluesky stream: src/routes/live/bsky/stream.sse/+server.ts (+ tests)
- Summaries: supabase/migrations/004_create_match_summaries.sql; routes/api/admin/summaries/save/+server.ts; routes/api/summaries/history/+server.ts (+ tests)
- History page: src/routes/history/[matchId]/+page.svelte, +page.ts (+ tests)
- Live match page: src/routes/match/[id]/+page.svelte

Change Management
- Before pushing, ensure tests pass locally.
- Keep admin-only features behind appropriate guards; perform manual checks for accidental exposure.
- If budget or platform pricing changes, update estimator constants and re-run admin planning.
