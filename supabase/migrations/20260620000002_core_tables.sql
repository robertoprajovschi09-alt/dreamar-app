-- =============================================================================
-- drea.mar — Phase 0 / Migration 2
-- Core tenant tables.
--
-- Multi-tenancy contract: every tenant-scoped table has a NOT NULL agency_id
-- referencing agencies(id) on delete cascade, and a (agency_id) or
-- (agency_id, …) index for RLS performance. RLS itself is enabled in
-- migration 4 once the helper functions exist (migration 3).
--
-- FK dependency order (parent → child):
--   profiles → agencies → agency_members → invitations
--                       → clients → client_contacts → client_users
--           plans → subscriptions
--                  → usage_counters (per-agency)
--                  → audit_log
--                  → notifications
-- =============================================================================

-- ------------------------------ profiles ------------------------------------
-- Extends Supabase's auth.users with app-specific fields. Auto-populated by
-- a trigger on auth.users insert (defined in migration 5).
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext not null unique,
  full_name       text,
  avatar_url      text,
  phone           text,
  -- saas_admin = system administrator, cross-tenant access.
  -- This field is intentionally NOT touched by ordinary code paths; flipping
  -- it is a privileged operation done out-of-band.
  is_saas_admin   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------ agencies ------------------------------------
-- The tenant root. Every other tenant row chains to one of these.
create table public.agencies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 citext not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  city                 text,
  website              text,
  logo_url             text,
  brand_color          text check (brand_color ~* '^#[0-9a-f]{6}$'),
  custom_domain        citext unique,
  current_plan_tier    plan_tier not null default 'starter',
  stripe_customer_id   text unique,
  created_by           uuid references public.profiles(id) on delete set null,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- --------------------------- agency_members ---------------------------------
-- Links a profile to an agency with an agency-scoped role. A profile can be
-- a member of multiple agencies (rare but supported), and `role` here is the
-- effective in-agency role (owner / team_member / content_creator).
-- client_viewer membership lives in client_users, NOT here.
create table public.agency_members (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references public.agencies(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  role           app_role not null
                   check (role in ('agency_owner', 'agency_team_member', 'content_creator')),
  invited_by     uuid references public.profiles(id) on delete set null,
  joined_at      timestamptz not null default now(),
  unique (agency_id, profile_id)
);

-- ---------------------------- invitations -----------------------------------
-- Pending email invites. Acceptance is handled by an Edge Function that
-- atomically creates the agency_members row and consumes the token.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  email       citext not null,
  role        app_role not null
                check (role in ('agency_team_member', 'content_creator')),
  token       text not null unique,
  invited_by  uuid references public.profiles(id) on delete set null,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ------------------------------ clients -------------------------------------
-- The agency's clients (the businesses they manage). All spec fields included.
create table public.clients (
  id                        uuid primary key default gen_random_uuid(),
  agency_id                 uuid not null references public.agencies(id) on delete cascade,
  name                      text not null,
  niche                     niche not null default 'custom',
  city                      text,
  website                   text,
  contact_person            text,
  contact_email             citext,
  contact_phone             text,
  collaboration_start_date  date,
  monthly_retainer          numeric(10, 2),
  status                    client_status not null default 'onboarding',
  -- Persisted per-client objectives (the front end's localStorage layer).
  objectives                jsonb not null default '[]'::jsonb,
  -- Persisted per-client feedback (captured from the client portal).
  feedback                  text,
  platforms                 platform[] not null default '{}'::platform[],
  brand_voice               text,
  notes                     text,
  -- AI-computed health & risk (rewritten by the health-score Edge Function).
  health_score              int check (health_score between 0 and 100),
  risk                      risk_level,
  archived_at               timestamptz,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- -------------------------- client_contacts ---------------------------------
-- Additional contacts beyond the primary contact_* fields on clients.
create table public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  email       citext,
  phone       text,
  role        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------- client_users ----------------------------------
-- Links a Client Viewer profile to a single client for portal access.
-- agency_id is denormalized for RLS performance (no join needed).
create table public.client_users (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (client_id, profile_id)
);

-- ------------------------------- plans --------------------------------------
-- The 4 paid tiers. Seeded in seed.sql. Read-only to everyone.
create table public.plans (
  id                     uuid primary key default gen_random_uuid(),
  tier                   plan_tier not null unique,
  name                   text not null,
  tagline                text,
  price_eur_monthly      numeric(10, 2) not null,
  stripe_price_id        text unique,
  -- null = unlimited
  max_clients            int,
  max_team_members       int,
  -- Feature flags (cumulative from Starter up). Examples: ai_reports,
  -- client_portal, niche_dashboards, approval_workflow, white_label_reports,
  -- ai_strategy_room, advanced_analytics, competitor_watch, custom_branding,
  -- custom_domain, advanced_permissions, premium_pdf.
  features               jsonb not null default '{}'::jsonb,
  display_order          int not null default 0,
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);

-- ---------------------------- subscriptions ---------------------------------
-- One active subscription per agency. Written by the Stripe webhook handler
-- running with service_role (RLS bypassed). Cancelled subs are retained for
-- history (the agency may have a separate active row later).
create table public.subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  agency_id                   uuid not null references public.agencies(id) on delete cascade,
  plan_id                     uuid not null references public.plans(id) on delete restrict,
  stripe_subscription_id      text unique,
  status                      subscription_status not null,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  cancel_at_period_end        boolean not null default false,
  trial_end                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
-- Partial unique index: at most one non-cancelled subscription per agency.
create unique index subscriptions_one_active_per_agency
  on public.subscriptions (agency_id)
  where status not in ('canceled', 'incomplete_expired');

-- --------------------------- usage_counters ---------------------------------
-- Denormalized counters maintained by triggers (defined in migration 5).
-- Used by plan-limit guards without scanning the source tables.
create table public.usage_counters (
  agency_id           uuid primary key references public.agencies(id) on delete cascade,
  client_count        int not null default 0,
  team_member_count   int not null default 0,
  ai_credits_used     int not null default 0,
  updated_at          timestamptz not null default now()
);

-- ----------------------------- audit_log ------------------------------------
-- Immutable activity log. agency_id is nullable for system-wide events
-- (e.g. SaaS-admin actions).
create table public.audit_log (
  id           bigint generated always as identity primary key,
  agency_id    uuid references public.agencies(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  diff         jsonb,
  ip_address   inet,
  created_at   timestamptz not null default now()
);

-- ---------------------------- notifications ---------------------------------
-- profile_id is the optional intended recipient. When NULL, the notification
-- is broadcast to anyone in the agency.
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete cascade,
  title         text not null,
  description   text,
  severity      notification_severity not null default 'info',
  entity_type   text,
  entity_id     uuid,
  href          text,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
