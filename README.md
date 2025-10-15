# Arsenal Matchday Pulse

This repository powers a SvelteKit app that synthesizes Arsenal fan sentiment during matchdays across social platforms (Bluesky, X/Twitter, Threads). It provides livestream SSE feeds, transparency pages, and (in this phase) authentication scaffolding and comments.

Branching and PR workflow
- Base branch: main
- Feature branches:
  - feat/bsky-ingestor-sse (PR #2): Bluesky ingestion, SSE stream, accounts API, match page AI summary panel, repo hygiene fixes
  - feat/ai-summaries-bsky-threshold (PR #3): GPT-based summaries API (timeout + rate-limit), Bluesky follower threshold lowered, post-match test SSE
  - feat/auth-comments-phase1 (WIP; no PR yet): Supabase client, Bluesky verification endpoints, in-memory comments API, email utility (Resend)

This Checkpoint (feat/auth-comments-phase1)
- Supabase client scaffolding
  - src/lib/supabaseClient.ts: lazy client from PUBLIC_SUPABASE_URL/SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY
- Bluesky verification (handle ownership proof)
  - src/lib/auth/bskyVerifyStore.ts
    - createChallenge(handle) → AMP-XXXXXX code (TTL default 10m)
    - getChallenge/clearChallenge
    - verifyPostContainsCode(handle, code, windowMinutes): checks recent posts via AppView (no auth)
  - POST /api/auth/bsky/create-challenge
    - Body: { handle }
    - Returns { ok, handle, code, createdAt, expiresAt, instructions }
  - POST /api/auth/bsky/verify-challenge
    - Body: { handle }
    - Verifies code in recent posts; if found, clears challenge and returns { ok, handle }
    - TODO: Link/create user in Supabase + issue session/magic link (future checkpoint)
- Comments API (temporary in-memory)
  - src/routes/api/comments/+server.ts
  - GET ?matchId=... → { matchId, count, comments }
  - POST { matchId, text, parentId?, platform?, user? } → { ok, comment }
  - NOTE: This is a temporary placeholder; will be replaced by persisted Supabase schema with auth and moderation
- Email utility (Resend)
  - src/lib/email/resend.ts
  - sendEmailNotification(payload) guarded by RESEND_API_KEY; no-op in dev if unset

Previously shipped highlights (PR #2, #3)
- Bluesky ingestion, SSE streams, accounts transparency
- AI summaries: /api/summaries/latest with timeout and in-memory rate-limiting; prompt uses dynamic sinceMin to match input window
- SSE improvements: interval parsing clamp, non-overlapping loop, readable stream cancel() cleanup

Environment variables
- Public/Supabase
  - PUBLIC_SUPABASE_URL (or SUPABASE_URL)
  - PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)
- OpenAI (for summaries API; in PR #3)
  - OPENAI_API_KEY
  - OPENAI_MODEL (default: gpt-5)
  - SUMMARIES_TIMEOUT_MS (default: 15000)
  - SUMMARIES_RATE_WINDOW_MS (default: 60000)
  - SUMMARIES_RATE_MAX (default: 4)
- Resend (emails)
  - RESEND_API_KEY
  - RESEND_FROM (default notifications@matchday-pulse.dev)
- Bluesky verification
  - BSKY_VERIFY_TTL_MS (default: 600000)

Local development
- Install deps:
  - npm install
- Dev server:
  - npm run dev
- Build:
  - npm run build
- Preview:
  - svelte-kit preview --port 4173 --host
- Tests:
  - Quick smoke: npm run test:simple
  - Vitest unit tests:
    - npm run test:run unit
    - npm run test:run unit services
    - npm run test:run unit routes
    - npm run test:run all

API quick reference for this checkpoint
- POST /api/auth/bsky/create-challenge
  - body: { "handle": "example.bsky.social" }
  - response: { ok, handle, code, createdAt, expiresAt, instructions }
- POST /api/auth/bsky/verify-challenge
  - body: { "handle": "example.bsky.social" }
  - response: { ok, handle } or { error, reason }
- GET /api/comments?matchId=xxx
  - response: { matchId, count, comments }
- POST /api/comments
  - body: { matchId, text, parentId?, platform?, user? }
  - response: { ok, comment }

Notes
- Bluesky post-match test SSE (from PR #3): /live/bsky/test-latest.sse with validated params and cancel support
- Summaries API rate limiting and timeout exist to protect cost; these are in-memory for now (stateless backends will need Redis or DB-based limiter)

Testing added for this checkpoint
- Unit tests (see src/routes/api/auth/bsky/**/server.test.ts, src/routes/api/comments/server.test.ts, and src/lib/auth/bskyVerifyStore.test.ts)
- Runner supports pattern filtering via npm run test:run [command] [pattern] (e.g., npm run test:run unit routes)

Next Phase (WIP): Comments persistence to Supabase (feat/comments-persistence)
- Summary of changes
  - Server-side Supabase admin client (service role): src/lib/supabaseAdmin.ts
  - Shared types: src/lib/types/comment.ts
  - Comments API now persists to Supabase with in-memory fallback:
    - src/routes/api/comments/+server.ts (GET/POST)
  - Moderation endpoint (server-gated via ADMIN_SECRET and service role):
    - POST src/routes/api/comments/moderate/+server.ts
  - SQL migration for comments table with RLS:
    - supabase/migrations/001_create_comments.sql
  - Example environment file:
    - .env.example

- Setup instructions
  1) Copy env file
     - cp .env.example .env
     - Set:
       - PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
       - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only)
       - ADMIN_SECRET (random strong string for moderation endpoint)
  2) Apply the SQL migration
     - Option A: Supabase SQL Editor
       - Open your project → SQL → paste supabase/migrations/001_create_comments.sql → Run
     - Option B: Supabase CLI (if configured)
       - supabase db push  (ensure the CLI is connected to your project)
  3) Restart dev server (port policy)
     - npm run dev (project is configured to run at http://localhost:5173 and fail if occupied; see CLINE_RULES.md)

- Endpoint usage
  - List comments
    - GET /api/comments?matchId=2025-10-19-CHE-ARS
  - Post comment
    - POST /api/comments
      {
        "matchId": "2025-10-19-CHE-ARS",
        "text": "COYG! That press is on fire.",
        "platform": "combined",
        "parentId": null,
        "user": {"id":"u1","handle":"@gooner","displayName":"Gooner"}
      }
  - Moderate (delete) comment
    - POST /api/comments/moderate
      Headers: x-admin-token: $ADMIN_SECRET
      Body: { "id": "COMMENT_UUID" }

- Fallback behavior
  - If Supabase is not configured or the DB call fails, the API uses an in-memory map (per process) to store/read comments so local dev can continue.

- Security notes
  - Do NOT expose SUPABASE_SERVICE_ROLE_KEY to the browser.
  - The moderation endpoint requires the ADMIN_SECRET header and runs only on the server using the service role.
  - RLS policies allow selects of active comments and open inserts; updates/deletes are restricted to service role for moderation.
  - Consider adding per-user rate limiting and spam protections in a future phase.

- Dev server port policy
  - Enforced by CLINE_RULES.md and package.json/vite.config.ts:
    - Always use http://localhost:5173
    - StrictPort enabled (no automatic fallback)
