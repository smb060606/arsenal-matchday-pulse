# Arsenal Matchday Pulse – Repository Re-Evaluation (PR #9 and Working Tree)

Date: 2025-10-16  
Branch: feat/match-windows-compare  
HEAD: 1302aee5d397ce193e387688469b67b79af71c8d (2025-10-16 13:58:04 -0700)  
PR Reviewed: https://github.com/smb060606/arsenal-matchday-pulse/pull/9

## Executive Summary

- PR #9 is effectively identical to current HEAD on feat/match-windows-compare (0/0 ahead/behind).  
- Working tree is clean (no uncommitted changes).  
- Test status:
  - Simple suite: 14 passed, 0 failed.
  - Vitest suite: 115 passed, 0 failed.
- Core features implemented:
  - Bluesky ingestion, match windows (pre/live/post) with 15-min bins and injury-time handling.
  - Compare view API/UI and match page wiring for kickoff-based windows.
  - Admin account overrides (include/exclude, global/match scope, precedence) with CRUD API and Manage UI.
  - Accounts registry schema and monthly re-evaluation endpoint + GitHub Actions workflow.
  - Budget planner API/UI with platform cost/config awareness and override transparency.
  - Twitter parity scaffold (selection with overrides precedence, planner integration) and a mock SSE endpoint.
- Primary gaps:
  - Real Twitter data resolution and fetch (handle → user_id, followers, createdAt, activity metrics).
  - Threads parity (selection pipeline, overrides-aware selection, SSE route, budget integration).
  - Cost-to-cap mapping (derive X per platform from budget and access pricing).
  - Public “accounts used” visibility in UI across phases should be verified/augmented.

The project is in a strong state with solid infra, tests, and admin controls; remaining work centers on Twitter/Threads data integrations and cost-aware selection.

---

## Repository and PR State

- Local branch: feat/match-windows-compare
- Remote: origin https://github.com/smb060606/arsenal-matchday-pulse.git
- PR #9 fetched as `pr-9` and compared:
  - rev-list HEAD...pr-9 => 0 0 (identical)
- Working tree: clean (no modified or untracked files)

Commands run:
- git status -sb; git remote -v; git log -n 15
- git fetch origin pull/9/head:pr-9; git log pr-9 -n 10
- git diff --stat HEAD...pr-9; git diff --name-status HEAD...pr-9

---

## Test Results

- npm test (simple suite via simple-test.js)
  - Passed: 14 | Failed: 0
- npx vitest run --reporter=verbose
  - Files: 13 passed
  - Tests: 115 passed
  - Duration: ~0.9s

Coverage areas include:
- Config validation (bsky), service logic (bskyService), match window helpers, SSE endpoint behavior for Bluesky, page components (home, match, accounts), API endpoints (accounts, summaries, comments), Bluesky auth challenge store, etc.

---

## Feature Audit vs Requirements

1) Platform-specific live streams (matchdays, PL matches):
- Bluesky:
  - SSE: src/routes/live/bsky/stream.sse/+server.ts
  - Windows: enforced via matchWindow helpers and live bins; summary aligns with windows.
  - Summaries include accountsUsed (commit message: feat(summaries): include accountsUsed).
- Twitter:
  - SSE mock: src/routes/live/twitter/stream.sse/+server.ts (emits synthetic payloads).
  - Service scaffold: src/lib/services/twitterService.ts (override-aware selection parity).
  - Missing: real API integrations for user resolution and tweet fetching.
- Threads:
  - Not yet implemented; overrides summary surfaced in planner, but no service/SSE.

2) Eligibility constraints: accounts ≥3 years old and ≥500 followers, prioritize active accounts
- Bluesky: computeEligibility in bskyService (tests confirm thresholds and behavior).
- Twitter: computeEligibility implemented using TWITTER_MIN_FOLLOWERS (500) and TWITTER_MIN_ACCOUNT_MONTHS (36), but actual metrics currently unknown due to placeholder resolution; bypass via include overrides supported.
- Prioritize active accounts: sorting by followersCount where available; additional activity-based sorting can be added when activity metrics are available per platform.

3) Visibility of accounts used
- Summaries API: includes accountsUsed for Bluesky.
- Planner API/UI:
  - Route: src/routes/api/accounts/plan/+server.ts (selected accounts and override summaries per platform).
  - Page: src/routes/accounts/plan/+page.svelte (renders overrides for Twitter and Threads; shows selections when configured).
- Recommendation: surface “accounts used in this match” on match UI explicitly for each platform; verify integration for Bluesky and mirror when Twitter/Threads integrations are completed.

4) Time window: 2 hrs pre-match, live, and 1 hr post-match
- Implemented: match window utils and summaries alignment, bins for live, and pre/post window handling per commits:
  - feat(live-summary), feat(summaries), feat(match), feat(compare)
- Verify end-to-end presentation across match page and compare view (tests cover matchWindow helpers and SSE parsing).

5) Budget limit: ≤ $50/month per platform; determine X (top N accounts) based on cost
- Config: src/lib/config/budget.ts
  - BUDGET_PER_PLATFORM_DOLLARS defaults to 50.
  - Bluesky cost treated as $0 for public reads; status: ok.
  - Twitter and Threads: unconfigured unless env set (status: unconfigured).
- Planner: src/routes/api/accounts/plan/+server.ts
  - Uses getPlatformCostConfig to show platform status and cost notes.
  - For bsky: selected up to BSKY_MAX_ACCOUNTS (safe cost).
  - For twitter: selection only if cost configured; currently no cost, so status unconfigured.
- Gap: derive X from cost model (pricing → requests/account → safe cap). See “Proposed Cost-to-Cap Model” below.

6) Admin controls and re-evaluation
- Overrides API: src/routes/api/admin/accounts/overrides/+server.ts
  - Auth: Authorization: Bearer ADMIN_TOKEN
  - Endpoints: GET/POST/DELETE
- Overrides service: src/lib/services/accountOverrides.ts
  - Precedence: match EXCLUDE > match INCLUDE > global EXCLUDE > global INCLUDE
  - Expiry, bypass eligibility, notes included.
- Manage UI: src/routes/accounts/manage/+page.svelte
- Registry: supabase/migrations/003_create_accounts_registry.sql
- Re-evaluation endpoint/workflow:
  - API: src/routes/api/admin/accounts/revalidate/+server.ts (Bearer ADMIN_TOKEN)
  - GitHub Action: .github/workflows/account-revalidate.yml

---

## Key Files Reviewed

- Budget/Planner:
  - src/lib/config/budget.ts
  - src/routes/api/accounts/plan/+server.ts
  - src/routes/accounts/plan/+page.svelte
- Overrides:
  - src/lib/services/accountOverrides.ts
  - src/routes/api/admin/accounts/overrides/+server.ts
  - src/routes/accounts/manage/+page.svelte
- Bluesky:
  - src/lib/services/bskyService.ts (+ tests)
  - src/routes/live/bsky/stream.sse/+server.ts (+ tests)
  - src/lib/utils/matchWindow.ts (+ tests)
- Twitter:
  - src/lib/config/twitter.ts
  - src/lib/services/twitterService.ts (scaffold)
  - src/routes/live/twitter/stream.sse/+server.ts (mock stream)
- Summaries/Compare:
  - src/routes/api/summaries/latest/+server.ts (+ tests)
  - src/routes/compare/[matchId]/+page.svelte, +page.ts

---

## Gaps and Risks

- Twitter/X:
  - Official API pricing likely exceeds $50/month (Basic starts at ~$100/month historically); selection is scaffold-only.
  - Need compliant approach under budget. Alternatives (e.g., 3rd-party “scrapers”) often violate TOS; avoid.
  - Without API, eligibility/metrics are unknown; current code treats createdAt as null, followersCount undefined → reduces eligibility confidence.
- Threads:
  - No ingestion pipeline implemented yet; planner shows overrides summary only if configured.
- Cost-to-Cap Mapping:
  - Current planner shows cost notes; only Bluesky returns selections by max accounts due to $0 assumption.
  - Need to translate configured monthly cost to “max accounts X” and/or request rate caps per platform.
- Public visibility:
  - Ensure match pages explicitly show “accounts used” list per platform with timestamps/sections pre/live/post, matching transparency requirement.

---

## Proposed Cost-to-Cap Model (X Determination)

Given budget B = $50/month/platform, and pricing that is usually request-count or tier-based:

1) Tier-based APIs (fixed monthly price threshold):
   - If monthly cost <= B: status ok; set X by operational/request safety limits, not budget.
   - If monthly cost > B: status unconfigured (do not enable).

2) Request-based (pay-per-request):
   - Estimate per-account request rate r (requests/account/min) during active windows.
   - Total match minutes covered M = pre (120) + live (~105 incl. HT) + post (60) ≈ 285 min.
   - Per-match requests per account ≈ r * M.
   - Expected matches per month (PL): ~6–8 for Arsenal; use env MATCHES_PER_MONTH (default 8).
   - Monthly requests per account ≈ r * M * MATCHES_PER_MONTH.
   - Given cost per 1k requests (C_1k), monthly cost per account ≈ (r * M * MATCHES_PER_MONTH / 1000) * C_1k.
   - Solve for X so Σ_cost_accounts(X) ≤ B. Use a safety buffer (e.g., 20%).

Implementation outline:
- Extend budget.ts with platform pricing parameters (env) and an estimator function.
- In /api/accounts/plan, compute maxAccountsAllowed from estimator instead of hard config caps.
- Show “why” details in plan payload (requests estimate, buffer, per-match cost).

---

## Recommendations and Next Steps

1) Twitter under $50/month (compliance-first)
   - Keep platform “unconfigured” unless org provides a compliant API tier at ≤ $50.
   - If API remains unavailable, support Twitter via:
     - Manual dataset ingestion (e.g., CSV or admin-uploaded JSON snapshots) to power summaries for research-only comparison.
     - Or defer Twitter live stream and focus on Bluesky + Threads until compliant affordable access exists.

2) Threads integration (priority)
   - Create src/lib/config/threads.ts with thresholds mirroring requirements (≥500 followers, ≥36 months).
   - Add threadsService.ts with:
     - resolveAllowlistProfiles (via official Threads API if available)
     - computeEligibility, selectEligibleAccounts with overrides precedence.
     - getAccountsSnapshot for planner.
   - Add SSE route: src/routes/live/threads/stream.sse/+server.ts (mock first, then integrate real).
   - Update planner API/UI to select Threads accounts when cost configured.

3) Twitter real metrics (optional, gated by cost)
   - Implement resolver to fetch user_id, followersCount, createdAt for allowlist accounts.
   - Fill accounts_registry for Twitter and update re-evaluation endpoint to refresh metrics monthly.
   - Replace SSE mock with summarization based on tweets fetched (respect rate/cost).

4) Cost-to-cap code path
   - Add estimator to derive X (max accounts) from budget and pricing vars.
   - Reflect in /api/accounts/plan outputs and UI with justification.
   - Default Bluesky to its static cap since cost is $0.

5) Transparency and UI polish
   - Ensure match page and compare page display the explicit “accounts used” list per platform for each phase (pre/live/post).
   - Surface override chips and reasons inline with selections in admin planner view (exists) and optionally a public “methodology” panel.

6) Testing additions
   - Unit tests for accountOverrides precedence and expiry handling.
   - API tests for overrides CRUD.
   - Tests for accountsRegistry stale logic.
   - Tests for planner budget estimator once introduced.
   - Threads service tests mirroring Bluesky tests when implemented.

7) Documentation
   - Update README/TESTING with:
     - ADMIN_TOKEN (overrides API) vs ADMIN_SECRET (planner API guard).
     - Budget env vars and pricing estimator usage.
     - Re-evaluation workflow configuration (APP_BASE_URL, ACTION secret passing).
     - Methodology and transparency commitments.

---

## Blog Platform Recommendation

- Host the SvelteKit app itself as the “blog” on Vercel or Netlify:
  - Pros: Real-time SSE support, tight integration with streams and admin tools, zero friction for UI customization and transparency pages.
  - Add a “Blog/Insights” route for long-form posts summarizing matchday sentiment snapshots; publish after each match using existing summaries APIs.

Alternative CMS options (if needed for editorial workflow):
- Ghost: Powerful blogging with membership options; integrate via API for embedding live components.
- Hashnode/Medium: Simpler distribution but less control for live components and SSE.
Given live nature and transparency requirements, SvelteKit-hosted blog is recommended.

---

## Suggested Project Names (for branding consistency)

- ArsenalMatchdayPulse (current)
- GoonerMatchdayPulse
- EmiratesEcho
- CannonCastLive
- NorthBankPulse
- GunnersLiveWire
- ArsenalFanStream
- MatchdayGooners
- HighburyLiveSentiment
- RedWhiteSentiment
