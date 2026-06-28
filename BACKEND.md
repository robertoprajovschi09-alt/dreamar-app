# drea.mar — Backend

**Phases shipped:**

- **Phase 0** — foundation: extensions, enums, core tenant tables, RLS
  multi-tenancy spine, plan-limit enforcement, seed for the 4 paid plans.
- **Phase 1** — Content Calendar, Approval Workflow, Task Management. Each
  module enforces tenant isolation and plan-feature gates at the schema layer.
- **Phase 2** — Video Performance Tracker (24 metric fields), Hook & Content
  Library (with live aggregate stats), Manual Analytics (platform-growth
  snapshots). Videos + analytics are client-portal-readable; hooks are
  internal.
- **Phase 3** — Business Impact Tracker (agency- or client-entered), Client
  Health Score (agency-internal history + current-health view). Closes a
  column-level leak by moving health off the `clients` row.
- **Phase 4** — AI layer: Monthly Reports (13 editable sections + version
  history, portal-visible once sent), Strategy Room (per-client chat), AI
  jobs queue + usage metering. Gated by `ai_reports` (Growth) and
  `ai_strategy_room` (Unlimited). Schema + integration architecture only —
  the actual Claude calls run in Edge Functions (Phase 7).
- **Phase 5** — Document Library (folders, documents, AI summaries) + Supabase
  **Storage** bucket with object-level RLS keyed off the path convention
  `{agency_id}/{client_id}/{file}`. Clients can upload to their own folder;
  folders + AI summaries stay internal.
- **Phase 6** — Niche dashboards: a `niche_config` registry (system defaults +
  agency overrides, resolved by `niche_config_for`), generic
  `client_niche_metrics` (jsonb KPIs), a dedicated `properties` table (real
  estate), and a config-driven `niche_items` table for the other niches'
  per-item lists. **Schema is now complete.**
- **Phase 7** — Edge Functions: Stripe webhook (subscription + tier sync),
  agency onboarding, and an AI worker (report/health/summary/strategy/hook
  jobs). The RPCs they call are tested in the DB harness; the pure logic
  (`_shared/*.mjs`) is unit-tested via `npm run test:fn`. Deploying needs live
  Stripe + Anthropic keys — see `supabase/functions/DEPLOY.md`.

## What's in here

```
supabase/
  config.toml              Supabase CLI project config
  migrations/
    20260620000001_extensions_and_enums.sql
    20260620000002_core_tables.sql
    20260620000003_rls_helpers.sql
    20260620000004_rls_policies.sql
    20260620000005_triggers_and_indexes.sql
    20260620000006_phase1_helpers.sql
    20260620000007_phase1_calendar.sql
    20260620000008_phase1_approvals.sql
    20260620000009_phase1_tasks.sql
    20260620000010_phase2_hooks.sql
    20260620000011_phase2_videos.sql
    20260620000012_phase2_analytics.sql
    20260620000013_phase3_business_impact.sql
    20260620000014_phase3_health_score.sql
    20260620000015_phase4_ai_reports.sql
    20260620000016_phase4_ai_strategy.sql
    20260620000017_phase4_ai_jobs.sql
    20260620000018_phase5_documents.sql
    20260620000019_phase5_storage.sql
    20260620000020_phase6_niche_config.sql
    20260620000021_phase6_niche_detail.sql
  seed.sql                 The 4 plans only (no demo tenant data)

scripts/
  db-shim.sql              Pre-migration Auth shim (local-dev only)
  db-shim-post.sql         Post-migration grants + test helpers
  test-migrations.mjs      pglite verification harness — `npm run test:db`
```

## Verify locally (no Supabase project needed yet)

```bash
npm install
npm run test:db
```

This runs the entire migration chain inside an in-process Postgres (via
pglite) and asserts the multi-tenancy promise. **Current run: 73 / 73 passing.**
A second suite — `npm run test:fn` — unit-tests the Edge Functions' pure
logic (health scoring, Stripe mapping, report parsing, credits): **10 / 10.**

Phase 0 (foundation):
- 9 migrations + seed apply cleanly
- `auth.users` → `public.profiles` trigger fires on signup
- Agency A only sees A's clients; B only sees B's
- A cross-tenant INSERT (user-A inserts a client into B) is rejected by RLS
- `agency_id` is immutable across UPDATE (belt-and-suspenders trigger)
- A Client Viewer sees only their assigned client, never the rest of the agency
- The Starter plan's 5-client cap blocks the 6th client
- `usage_counters` stays in sync with reality
- `plans` is publicly readable; anon gets zero tenant data

Phase 1 (calendar / approvals / tasks):
- Agency A only sees A's posts; B only sees B's
- A post's (agency_id, client_id) pair is forced to be consistent (trigger)
- Client Viewers see only posts for their assigned client
- Plan-feature gate: a **Starter** agency cannot insert `approvals` rows
- After upgrading to **Growth**, the same insert succeeds
- The post→approval sync trigger fires; `content_posts.approval_status`
  follows the approvals row
- A Client Viewer can decide their pending approval; `decided_by` /
  `decided_at` auto-stamp (and they cannot decide a different agency's)
- Tasks are agency-isolated; Client Viewers see zero tasks
- `tasks.completed_at` stamps on done, unstamps on un-done

Phase 2 (videos / hooks / analytics):
- The hook-stats trigger keeps `hooks.uses` + `hooks.avg_ai_score` live as
  videos link/unlink and as their `ai_score` is edited
- Videos are agency-isolated; Client Viewers can read their client's videos
  (portal) but cannot write them
- The Hook Library is internal — Client Viewers see zero hooks
- A video cannot reference a hook/post/client from another agency (trigger)
- `metric_snapshots` enforces one row per (client, platform, date)
- Client Viewers can read their client's analytics snapshots, not other clients'
- Deleting a video nulls `content_posts.video_id` (clean FK behaviour)

Phase 3 (business impact / health score):
- Impact entries are agency-isolated; a Client Viewer can submit their own
  `source='client'` form for their client, but cannot claim `source='agency'`
  or submit for another client
- **Column-leak fix**: `clients.health_score` / `clients.risk` columns are
  dropped (a Client Viewer can read their clients row, and RLS can't hide
  columns) — verified gone
- Health lives in agency-internal `client_health_scores`; a Client Viewer
  sees zero rows, including through the `client_current_health` view
  (security_invoker inherits the table's RLS)
- The health-risk trigger derives low/medium/high from the score when omitted
- The current-health view returns the latest snapshot per client

Phase 4 (AI reports / strategy / jobs):
- `ai_reports` is gated by the `ai_reports` feature (Starter blocked, Growth OK)
- A new report is seeded with the 13 spec sections in order
- Client portal: a Client Viewer can't see a draft report, but can once it's
  `sent`; `sent_at` stamps on first send
- `ai_strategy_room` is gated at the **Unlimited** tier (Growth blocked, even
  though Growth has ai_reports — verifies the two-tier gating)
- Strategy messages bump the thread's `last_message_at`; the Strategy Room is
  agency-internal (Client Viewers see zero threads/messages)
- `ai_usage` credits roll up into `usage_counters.ai_credits_used` (trigger)
- `ai_jobs` stamps `started_at` / `finished_at` as a job moves through the queue

Phase 5 (documents / storage):
- Documents are agency-isolated; a Client Viewer sees + can upload only their
  own client's documents; folders + `document_ai` summaries are internal
- **Storage object RLS** keyed off the path `{agency_id}/{client_id}/{file}`:
  an agency member sees its objects, a Client Viewer sees only their client's
  object, can upload into their own folder, and is blocked from the `_agency`
  folder and from any other agency

Phase 6 (niche dashboards):
- All 10 niches have a seeded system-default `niche_config`
- `niche_config_for` resolves override → default; an agency override wins only
  for that agency; the system default is unmodifiable by users
- `client_niche_metrics` (jsonb KPIs) is agency-isolated and portal-readable
- `properties` (real estate) and `niche_items` (typed jsonb attributes) are
  portal-readable, agency-write, and isolated across agencies

All checks must pass before any later phase ships. Run `npm run test:db`
after every migration change.

## Apply to a real Supabase project

You'll need:

1. A Supabase project (Cloud: https://supabase.com, or local via Docker).
2. The Supabase CLI: `npm install -g supabase`.

Then:

```bash
# Link this directory to your project (one-time)
supabase login
supabase link --project-ref <your-project-ref>

# Apply migrations and seed
supabase db push     # pushes migrations/*.sql
psql "$DB_URL" -f supabase/seed.sql   # seed the plans
```

For local Supabase dev (Docker required):

```bash
supabase start       # spins up Postgres + Studio + Auth + Storage
supabase db reset    # apply all migrations + seed against the local DB
```

The local Studio at http://127.0.0.1:54323 is the same UI you'd see on
supabase.com.

## What's NOT in here yet (intentional)

Phases 0–7 are written — **schema complete (23 tables, 1 view, ~43
functions/triggers, full RLS) and the Edge Functions are deploy-ready.** The
only thing left that can't be done offline:

- **Phase 8**: Front-end ↔ Supabase wiring — a typed client, swap the demo
  `lib/auth.tsx` for Supabase Auth, and replace each page's sample data with
  live queries page-by-page behind a feature flag. Needs a live Supabase
  project. The schema, RLS and Edge Functions already back it.

Phase 7 deploy steps (Stripe prices, secrets, webhook, cron) are in
`supabase/functions/DEPLOY.md`.

## What I'll need from you when we get there

- A **Supabase** project (free tier is plenty for development).
- A **Stripe** account + 4 recurring prices (one per tier) — Phase 7.
- An **Anthropic API** key (sk-ant-…) — Phase 4 / Phase 7.

None of these are needed right now to verify Phase 0.

## Spec compliance — what's enforced in the schema

| Spec rule | How it's enforced |
|---|---|
| Each agency has its own isolated workspace | `agency_id` on every tenant table + RLS via `current_agency_ids()` |
| Agency users must only see data from their own agency | Per-table SELECT policies; **forced** RLS so even table owners can't bypass |
| Admin users can manage all agencies | `is_saas_admin()` escape hatch in every helper |
| Starter Agency — max 5 clients, 1 owner | `plans.max_clients=5`, `max_team_members=1`; trigger `enforce_client_limit` / `enforce_member_limit` rejects the 6th |
| Growth Agency — max 15 clients, up to 3 team members | `plans.max_clients=15`, `max_team_members=3` |
| Unlimited Agency / White Label Pro | `max_clients=NULL`, `max_team_members=NULL` (NULL = unlimited) |
| 5 roles: SaaS Admin, Owner, Team Member, Content Creator, Client Viewer | `app_role` enum + `profiles.is_saas_admin` + `agency_members.role` + `client_users` |
| Client Viewer is scoped to a single client | `client_users(client_id, profile_id)` + `has_client_access()` helper |
| Plans + features | `plans.features` jsonb feature-flag map, seeded in `seed.sql` |
| No random demo data | Only `plans` is seeded; no tenant data anywhere |
| Every field editable | Schema is plain columns with sensible defaults; nothing baked into immutables except `agency_id` and primary keys |
| Scalable | UUID PKs, indexes on every RLS-relevant column, partial unique on the active-subscription column, `gin_trgm` for fuzzy search |
