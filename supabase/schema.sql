-- =============================================================================
-- drea.mar — consolidated schema for a HOSTED Supabase project
-- Paste into the SQL Editor and Run on a fresh project.
-- NOTE: storage RLS (migration 19) is OMITTED here — storage.objects is owned
--       by supabase_storage_admin, so its RLS is configured separately (the
--       'documents' bucket + policies are set up when we wire the Documents page).
-- =============================================================================

-- ========== migrations/20260620000001_extensions_and_enums.sql ==========
-- =============================================================================
-- drea.mar — Phase 0 / Migration 1
-- Extensions, enums, and table-independent helper functions.
--
-- This migration is intentionally small and free of any FK references so it
-- can run before any tables exist. Later migrations build on these primitives.
-- =============================================================================

-- ----------------------------- Extensions -----------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email/text
create extension if not exists "pg_trgm";   -- fuzzy text search for command palette etc.

-- ------------------------------- Enums --------------------------------------
-- The 5 roles from the spec. saas_admin is a system-wide role; the rest are
-- agency-scoped and live on agency_members.role.
create type app_role as enum (
  'saas_admin',
  'agency_owner',
  'agency_team_member',
  'content_creator',
  'client_viewer'
);

-- The 10 niches from the spec. Adding a new niche means an ALTER TYPE.
create type niche as enum (
  'real_estate',
  'restaurant',
  'lounge',
  'dental_clinic',
  'fitness_gym',
  'local_store',
  'beauty',
  'auto',
  'hotel',
  'custom'
);

-- The 4 paid tiers from the spec.
create type plan_tier as enum ('starter', 'growth', 'unlimited', 'white_label_pro');

create type client_status as enum ('onboarding', 'active', 'paused', 'archived');

-- Matches Stripe's subscription.status values so webhooks map 1:1.
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

create type risk_level as enum ('low', 'medium', 'high');

create type platform as enum (
  'instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'twitter', 'whatsapp'
);

create type notification_severity as enum ('info', 'success', 'warning', 'danger');

-- --------------------- Table-independent triggers ---------------------------
-- A single updated_at trigger function reused by every table that wants the
-- column auto-maintained. Tables opt in by creating a `before update` trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A guard helper to keep tenant data tight: agency_id on a row must never
-- change after insert (prevents cross-tenant data poisoning via UPDATE).
create or replace function public.lock_agency_id()
returns trigger
language plpgsql
as $$
begin
  if new.agency_id is distinct from old.agency_id then
    raise exception 'agency_id is immutable (attempted to change from % to %)',
      old.agency_id, new.agency_id;
  end if;
  return new;
end;
$$;


-- ========== migrations/20260620000002_core_tables.sql ==========
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


-- ========== migrations/20260620000003_rls_helpers.sql ==========
-- =============================================================================
-- drea.mar — Phase 0 / Migration 3
-- RLS helper functions. Every tenant-table policy in migration 4 is a thin
-- composition of these.
--
-- Three rules every helper obeys:
--   1. STABLE — same answer within a query, lets the planner inline/cache it.
--   2. SECURITY DEFINER + locked search_path — so users can't shadow our
--      tables with their own and trick the helper into returning the wrong
--      result.
--   3. Returns SETOF / boolean only — never leaks rows.
-- =============================================================================

-- ---------------------------- is_saas_admin ---------------------------------
-- True iff the current user has the SaaS-admin flag on their profile.
-- Used by SaaS Admin Panel queries and by every other RLS policy as a
-- cross-tenant escape hatch.
create or replace function public.is_saas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_saas_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- --------------------------- current_agency_ids -----------------------------
-- The set of agency IDs the current user can access. Used as `IN (select * …)`
-- in every tenant table's SELECT/UPDATE/DELETE policy.
--
-- For SaaS admins this expands to all agencies, giving them cross-tenant read
-- (their write access is gated separately on each table).
create or replace function public.current_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id
    from public.agency_members
    where profile_id = auth.uid()
  union
  select agency_id
    from public.client_users
    where profile_id = auth.uid()
  union
  select id
    from public.agencies
    where public.is_saas_admin();
$$;

-- ------------------------------ is_member_of --------------------------------
-- True iff the current user has an agency_members row in p_agency. Distinct
-- from current_agency_ids in that it EXCLUDES the client_users path — used
-- for "agency staff only" actions (a Client Viewer is in the agency but not
-- agency staff).
create or replace function public.is_member_of(p_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = p_agency and profile_id = auth.uid()
  ) or public.is_saas_admin();
$$;

-- -------------------------------- is_owner ----------------------------------
-- True iff the current user is an agency_owner of p_agency. Used to gate
-- destructive / administrative actions (delete client, change plan, invite).
create or replace function public.is_owner_of(p_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = p_agency
      and profile_id = auth.uid()
      and role = 'agency_owner'
  ) or public.is_saas_admin();
$$;

-- ---------------------------- has_client_access -----------------------------
-- True iff the current user can see a specific client. Two paths:
--   1. They're an agency member of the client's agency.
--   2. They're explicitly linked to this client via client_users
--      (the Client Viewer portal role).
-- Plus the SaaS-admin escape hatch.
create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_saas_admin() or exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and (
        c.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
        or exists (
          select 1 from public.client_users cu
          where cu.client_id = c.id and cu.profile_id = auth.uid()
        )
      )
  );
$$;


-- ========== migrations/20260620000004_rls_policies.sql ==========
-- =============================================================================
-- drea.mar — Phase 0 / Migration 4
-- Row-Level Security: enable + policies for every core tenant table.
--
-- Pattern (memorize this — every later module follows the same shape):
--
--   alter table public.<t> enable row level security;
--   alter table public.<t> force row level security;
--
--   create policy "<t>_select" on public.<t> for select
--     using (agency_id in (select * from public.current_agency_ids()));
--
--   create policy "<t>_insert" on public.<t> for insert
--     with check (public.is_member_of(agency_id));
--
--   create policy "<t>_update" on public.<t> for update
--     using (public.is_member_of(agency_id))
--     with check (public.is_member_of(agency_id));
--
--   create policy "<t>_delete" on public.<t> for delete
--     using (public.is_owner_of(agency_id));
--
-- WITH CHECK on insert/update is critical: without it, a member of agency A
-- could insert a row claiming agency_id = B. The check forces the new value
-- to live inside an agency the caller is a member of.
--
-- FORCE RLS makes the policies apply even to table owners, so a future
-- admin tool that ever forgets to drop privileges can't accidentally bypass
-- tenant isolation.
-- =============================================================================

-- ------------------------------ profiles ------------------------------------
-- Profiles are NOT agency-scoped; they're per-user. A profile is visible to:
--   - the owner of the profile
--   - SaaS admins
--   - anyone in the same agency (so the team can see each other)
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_self_or_admin_or_teammate" on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_saas_admin()
    or exists (
      select 1
      from public.agency_members me
      join public.agency_members them on them.agency_id = me.agency_id
      where me.profile_id = auth.uid() and them.profile_id = profiles.id
    )
  );

-- Insert is restricted to the user creating their own profile (the auth
-- trigger uses security definer, bypassing this).
create policy "profiles_insert_self" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_update_self_or_admin" on public.profiles
  for update
  using (id = auth.uid() or public.is_saas_admin())
  with check (id = auth.uid() or public.is_saas_admin());

-- ------------------------------ agencies ------------------------------------
-- agency.id IS the agency_id for these rows.
alter table public.agencies enable row level security;
alter table public.agencies force row level security;

create policy "agencies_select" on public.agencies
  for select
  using (id in (select * from public.current_agency_ids()));

-- New agency creation goes through an Edge Function with service_role; ordinary
-- callers can't INSERT. We expose no insert policy at all.

create policy "agencies_update_by_owner" on public.agencies
  for update
  using (public.is_owner_of(id))
  with check (public.is_owner_of(id));

-- Agencies cannot be deleted by users; archival is via the archived_at column.
-- A saas_admin policy is intentionally not added — admins use service_role.

-- --------------------------- agency_members ---------------------------------
alter table public.agency_members enable row level security;
alter table public.agency_members force row level security;

create policy "agency_members_select" on public.agency_members
  for select
  using (agency_id in (select * from public.current_agency_ids()));

create policy "agency_members_insert_by_owner" on public.agency_members
  for insert
  with check (public.is_owner_of(agency_id));

create policy "agency_members_update_by_owner" on public.agency_members
  for update
  using (public.is_owner_of(agency_id))
  with check (public.is_owner_of(agency_id));

-- A user can remove themselves; an owner can remove anyone.
create policy "agency_members_delete_self_or_owner" on public.agency_members
  for delete
  using (profile_id = auth.uid() or public.is_owner_of(agency_id));

-- ---------------------------- invitations -----------------------------------
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

create policy "invitations_select" on public.invitations
  for select
  using (agency_id in (select * from public.current_agency_ids()));

create policy "invitations_insert_by_owner" on public.invitations
  for insert
  with check (public.is_owner_of(agency_id));

create policy "invitations_delete_by_owner" on public.invitations
  for delete
  using (public.is_owner_of(agency_id));

-- ------------------------------ clients -------------------------------------
alter table public.clients enable row level security;
alter table public.clients force row level security;

-- Agency staff can see all their agency's clients; Client Viewers see only
-- their assigned client.
create policy "clients_select" on public.clients
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = clients.id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members (not Client Viewers) can create/update clients.
create policy "clients_insert" on public.clients
  for insert
  with check (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

create policy "clients_update" on public.clients
  for update
  using (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  )
  with check (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only owners can hard-delete; standard archival is via UPDATE archived_at.
create policy "clients_delete_by_owner" on public.clients
  for delete
  using (public.is_owner_of(agency_id));

-- -------------------------- client_contacts ---------------------------------
alter table public.client_contacts enable row level security;
alter table public.client_contacts force row level security;

create policy "client_contacts_select" on public.client_contacts
  for select
  using (public.has_client_access(client_id));

create policy "client_contacts_write" on public.client_contacts
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ---------------------------- client_users ----------------------------------
alter table public.client_users enable row level security;
alter table public.client_users force row level security;

-- A user can see their own client_users row (so the portal knows which
-- client they belong to). Agency members can see all of their agency's.
create policy "client_users_select" on public.client_users
  for select
  using (
    profile_id = auth.uid()
    or public.is_member_of(agency_id)
  );

create policy "client_users_write" on public.client_users
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- plans --------------------------------------
-- Public-read so the billing page can show the plan grid to anyone (including
-- non-authenticated visitors if we ever want a marketing site). Writes are
-- service_role only (no write policy → blocked).
alter table public.plans enable row level security;
-- NOTE: not forcing RLS so service_role unaffected (it already bypasses).

create policy "plans_public_read" on public.plans
  for select
  using (true);

-- --------------------------- subscriptions ----------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

create policy "subscriptions_select" on public.subscriptions
  for select
  using (agency_id in (select * from public.current_agency_ids()));

-- All writes are done by the Stripe webhook handler with service_role.
-- No insert/update/delete policy = no user-level writes.

-- --------------------------- usage_counters ---------------------------------
alter table public.usage_counters enable row level security;
alter table public.usage_counters force row level security;

create policy "usage_counters_select" on public.usage_counters
  for select
  using (agency_id in (select * from public.current_agency_ids()));

-- Writes are by triggers (security definer) only.

-- ----------------------------- audit_log ------------------------------------
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy "audit_log_select" on public.audit_log
  for select
  using (
    public.is_saas_admin()
    or (agency_id is not null and agency_id in (select * from public.current_agency_ids()))
  );

-- audit_log is append-only via service_role / Edge Functions. No user writes.

-- ---------------------------- notifications ---------------------------------
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

-- I can see notifications either addressed to me, or broadcast to my agency.
create policy "notifications_select" on public.notifications
  for select
  using (
    (profile_id = auth.uid())
    or (profile_id is null and agency_id in (select * from public.current_agency_ids()))
    or public.is_saas_admin()
  );

-- The only user-allowed write is marking my own notification as read.
create policy "notifications_mark_read" on public.notifications
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Inserts/deletes happen via service_role / Edge Functions (no policy).


-- ========== migrations/20260620000005_triggers_and_indexes.sql ==========
-- =============================================================================
-- drea.mar — Phase 0 / Migration 5
-- Triggers (auth → profile, updated_at, agency_id immutability, usage
-- counters) and indexes for RLS performance.
-- =============================================================================

-- --------------------------- auth → profile ---------------------------------
-- When Supabase Auth creates a user row, mirror it into public.profiles so
-- the rest of the app has a profile to attach data to. SECURITY DEFINER so
-- the trigger can insert past profiles' own RLS.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------- updated_at triggers ------------------------------
create trigger trg_profiles_updated_at      before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_agencies_updated_at      before update on public.agencies
  for each row execute function public.set_updated_at();
create trigger trg_clients_updated_at       before update on public.clients
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- --------------------- agency_id immutability guards ------------------------
-- Belt-and-suspenders on top of RLS WITH CHECK: even an SQL-level UPDATE that
-- somehow passes RLS cannot change agency_id on these tables.
create trigger trg_clients_lock_agency       before update on public.clients
  for each row execute function public.lock_agency_id();
create trigger trg_client_contacts_lock      before update on public.client_contacts
  for each row execute function public.lock_agency_id();
create trigger trg_client_users_lock         before update on public.client_users
  for each row execute function public.lock_agency_id();
create trigger trg_agency_members_lock       before update on public.agency_members
  for each row execute function public.lock_agency_id();
create trigger trg_invitations_lock          before update on public.invitations
  for each row execute function public.lock_agency_id();
create trigger trg_subscriptions_lock        before update on public.subscriptions
  for each row execute function public.lock_agency_id();
create trigger trg_notifications_lock        before update on public.notifications
  for each row execute function public.lock_agency_id();

-- ----------------------- usage_counters automation --------------------------
-- Create a counters row whenever a new agency appears.
create or replace function public.ensure_usage_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_counters (agency_id) values (new.id)
  on conflict (agency_id) do nothing;
  return new;
end;
$$;

create trigger trg_agency_init_counters
  after insert on public.agencies
  for each row execute function public.ensure_usage_counters();

-- Keep client_count in sync with non-archived clients.
create or replace function public.adjust_client_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.usage_counters
       set client_count = client_count + 1, updated_at = now()
     where agency_id = new.agency_id;
  elsif tg_op = 'DELETE' then
    update public.usage_counters
       set client_count = greatest(client_count - 1, 0), updated_at = now()
     where agency_id = old.agency_id;
  end if;
  return null;
end;
$$;

create trigger trg_clients_count_insert
  after insert on public.clients
  for each row execute function public.adjust_client_count();
create trigger trg_clients_count_delete
  after delete on public.clients
  for each row execute function public.adjust_client_count();

-- team_member_count = agency_members count.
create or replace function public.adjust_team_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.usage_counters
       set team_member_count = team_member_count + 1, updated_at = now()
     where agency_id = new.agency_id;
  elsif tg_op = 'DELETE' then
    update public.usage_counters
       set team_member_count = greatest(team_member_count - 1, 0), updated_at = now()
     where agency_id = old.agency_id;
  end if;
  return null;
end;
$$;

create trigger trg_members_count_insert
  after insert on public.agency_members
  for each row execute function public.adjust_team_count();
create trigger trg_members_count_delete
  after delete on public.agency_members
  for each row execute function public.adjust_team_count();

-- --------------------- Plan-limit enforcement triggers ----------------------
-- Block client INSERT when the agency would exceed its plan's max_clients.
-- Runs after RLS — so the caller has already proved they belong to the
-- agency. Counts the (about-to-be-incremented) value against the live cap.
create or replace function public.enforce_client_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier   plan_tier;
  v_cap    int;
  v_count  int;
begin
  select current_plan_tier into v_tier from public.agencies where id = new.agency_id;
  select max_clients into v_cap from public.plans where tier = v_tier;
  if v_cap is null then return new; end if;  -- unlimited

  select client_count into v_count from public.usage_counters where agency_id = new.agency_id;
  if (v_count + 1) > v_cap then
    raise exception 'plan_limit_exceeded: % plan allows at most % clients', v_tier, v_cap
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_clients_enforce_limit
  before insert on public.clients
  for each row execute function public.enforce_client_limit();

-- Same shape for team members.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier   plan_tier;
  v_cap    int;
  v_count  int;
begin
  select current_plan_tier into v_tier from public.agencies where id = new.agency_id;
  select max_team_members into v_cap from public.plans where tier = v_tier;
  if v_cap is null then return new; end if;

  select team_member_count into v_count from public.usage_counters where agency_id = new.agency_id;
  if (v_count + 1) > v_cap then
    raise exception 'plan_limit_exceeded: % plan allows at most % team members', v_tier, v_cap
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_members_enforce_limit
  before insert on public.agency_members
  for each row execute function public.enforce_member_limit();

-- ---------------------------- Indexes (RLS perf) ----------------------------
-- Every tenant table gets an (agency_id) index. Composites where queries
-- predictably filter by client_id or profile_id too.
create index idx_agency_members_agency   on public.agency_members (agency_id);
create index idx_agency_members_profile  on public.agency_members (profile_id);
create index idx_invitations_agency      on public.invitations (agency_id);
create index idx_invitations_email       on public.invitations (email);
create index idx_clients_agency          on public.clients (agency_id);
create index idx_clients_agency_status   on public.clients (agency_id, status) where archived_at is null;
create index idx_clients_niche           on public.clients (niche);
create index idx_client_contacts_client  on public.client_contacts (agency_id, client_id);
create index idx_client_users_client     on public.client_users (agency_id, client_id);
create index idx_client_users_profile    on public.client_users (profile_id);
create index idx_subscriptions_agency    on public.subscriptions (agency_id);
create index idx_audit_log_agency_time   on public.audit_log (agency_id, created_at desc);
create index idx_notifications_recipient
  on public.notifications (profile_id, read_at)
  where profile_id is not null;
create index idx_notifications_agency_time
  on public.notifications (agency_id, created_at desc);

-- Fuzzy search support for the command palette (clients by name).
create index idx_clients_name_trgm on public.clients using gin (name gin_trgm_ops);


-- ========== migrations/20260620000006_phase1_helpers.sql ==========
-- =============================================================================
-- drea.mar — Phase 1 / Migration 6
-- Phase-1 helpers. Just one: agency_has_feature(), which lets later schemas
-- enforce plan-gated features at the database layer.
-- =============================================================================

-- Returns true iff the agency's current plan has the named feature flag.
-- Used by feature-gate triggers (e.g. only Growth+ may create approvals).
create or replace function public.agency_has_feature(p_agency uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.features ->> p_feature)::boolean
       from public.agencies a
       join public.plans p on p.tier = a.current_plan_tier
      where a.id = p_agency),
    false
  );
$$;


-- ========== migrations/20260620000007_phase1_calendar.sql ==========
-- =============================================================================
-- drea.mar — Phase 1 / Migration 7 — Content Calendar
--
-- Two tables, both tenant-scoped:
--   content_posts            — every post the agency plans/produces/publishes
--   content_post_attachments — files attached to a post (briefs, raw video)
--
-- Statuses match the front-end pipeline exactly. approval_status on
-- content_posts is a denormalized cache of the latest approvals row for
-- the post; maintained by a trigger in migration 8 so calendar queries
-- don't have to join.
-- =============================================================================

create type post_status as enum (
  'idea',
  'script',
  'filming',
  'editing',
  'sent_for_approval',
  'approved',
  'scheduled',
  'published',
  'analyzed'
);

-- Mirrors the spec's approval statuses. Used both on content_posts and on
-- the approvals table (added in migration 8).
create type approval_status as enum (
  'pending',
  'approved',
  'approved_with_changes',
  'rejected',
  'withdrawn'
);

-- ----------------------------- content_posts --------------------------------
create table public.content_posts (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,

  title             text not null,
  -- The script body. Stored as plain text; version history lives in the
  -- attachments table if a team wants snapshots before each edit.
  script            text,
  script_version    int not null default 1,
  body_angle        text,
  cta               text,
  hook              text,
  format            text,
  platform          platform,
  objective         text,
  notes             text,

  scheduled_date    date,
  published_date    date,
  status            post_status not null default 'idea',
  -- null = never sent for approval. Maintained by a trigger on approvals.
  approval_status   approval_status,

  assigned_to       uuid references public.profiles(id) on delete set null,
  deadline          timestamptz,

  -- Will link to videos.id in Phase 2. Nullable; soft FK so we can add the
  -- proper reference once that table exists.
  video_id          uuid,

  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A post's client must belong to the same agency as the post itself —
  -- the schema-level check that pairs with the agency_id immutability
  -- trigger below.
  constraint content_posts_client_in_agency
    check (client_id is not null and agency_id is not null)
);

-- ------------------------- content_post_attachments -------------------------
create table public.content_post_attachments (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  post_id       uuid not null references public.content_posts(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_content_posts_updated_at before update on public.content_posts
  for each row execute function public.set_updated_at();
create trigger trg_content_posts_lock_agency before update on public.content_posts
  for each row execute function public.lock_agency_id();
create trigger trg_post_attachments_lock_agency before update on public.content_post_attachments
  for each row execute function public.lock_agency_id();

-- Belt-and-suspenders: the post's client_id must live in the same agency.
-- The RLS policy lets agency members reference any client in their agency,
-- but this trigger blocks a post-INSERT that pairs an agency with a client
-- from a different agency (otherwise possible if an admin script forged
-- both columns).
create or replace function public.assert_post_client_agency()
returns trigger
language plpgsql
as $$
declare
  v_client_agency uuid;
begin
  select agency_id into v_client_agency from public.clients where id = new.client_id;
  if v_client_agency is null then
    raise exception 'unknown client %', new.client_id;
  end if;
  if v_client_agency <> new.agency_id then
    raise exception 'client % belongs to agency %, not %', new.client_id, v_client_agency, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_content_posts_client_agency
  before insert or update on public.content_posts
  for each row execute function public.assert_post_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.content_posts enable row level security;
alter table public.content_posts force row level security;

-- Agency members see everything. Client Viewers see only posts for the
-- client they're scoped to.
create policy "content_posts_select" on public.content_posts
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = content_posts.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members create/edit/delete posts. Client Viewers approve, but
-- do not author.
create policy "content_posts_insert" on public.content_posts
  for insert
  with check (public.is_member_of(agency_id));

create policy "content_posts_update" on public.content_posts
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "content_posts_delete" on public.content_posts
  for delete
  using (public.is_member_of(agency_id));

-- Attachments inherit from the parent post.
alter table public.content_post_attachments enable row level security;
alter table public.content_post_attachments force row level security;

create policy "post_attachments_select" on public.content_post_attachments
  for select
  using (
    exists (
      select 1 from public.content_posts p
      where p.id = content_post_attachments.post_id
        and (
          p.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or exists (
            select 1 from public.client_users cu
            where cu.client_id = p.client_id and cu.profile_id = auth.uid()
          )
          or public.is_saas_admin()
        )
    )
  );

create policy "post_attachments_write" on public.content_post_attachments
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- The calendar's hottest queries:
--   "show all posts for this client across the month"
--   "what's scheduled this week across all clients"
--   "what's pending approval"
create index idx_content_posts_agency_client_date
  on public.content_posts (agency_id, client_id, scheduled_date);
create index idx_content_posts_agency_status
  on public.content_posts (agency_id, status);
create index idx_content_posts_agency_assigned
  on public.content_posts (agency_id, assigned_to)
  where assigned_to is not null;
create index idx_content_posts_published
  on public.content_posts (agency_id, published_date desc)
  where published_date is not null;
create index idx_post_attachments_post on public.content_post_attachments (agency_id, post_id);


-- ========== migrations/20260620000008_phase1_approvals.sql ==========
-- =============================================================================
-- drea.mar — Phase 1 / Migration 8 — Approval Workflow
--
-- One generic `approvals` table for every approvable entity (script, video,
-- caption, report, post). The Client Viewer flow uses this table; agency
-- members request approval, client_users decide.
--
-- Gated by the `approval_workflow` feature flag — Starter agencies can't
-- create approval rows (plan trigger). Growth and up can.
-- =============================================================================

create type approval_target as enum (
  'post',     -- a content_posts row
  'script',   -- a script attached to a post (entity_id = post id; differentiated by target)
  'video',    -- a videos row (Phase 2)
  'caption',  -- a caption attached to a post
  'report'    -- an ai_reports row (Phase 4)
);

-- ------------------------------- approvals ----------------------------------
create table public.approvals (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- A specific client viewer flow: every approval belongs to one client.
  client_id     uuid not null references public.clients(id) on delete cascade,

  entity_type   approval_target not null,
  entity_id     uuid not null,

  requested_by  uuid references public.profiles(id) on delete set null,
  requested_at  timestamptz not null default now(),

  -- The Client Viewer assigned to decide (a row in client_users.profile_id).
  -- Nullable so an agency can leave it "anyone at the client".
  reviewer_id   uuid references public.profiles(id) on delete set null,

  status        approval_status not null default 'pending',
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,

  comments       text,
  change_requests text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- A given entity can have multiple approval rows over time (re-submissions),
-- but only one open (pending) approval at a time.
create unique index approvals_one_pending_per_entity
  on public.approvals (agency_id, entity_type, entity_id)
  where status = 'pending';

-- ------------------------------- triggers ----------------------------------
create trigger trg_approvals_updated_at before update on public.approvals
  for each row execute function public.set_updated_at();
create trigger trg_approvals_lock_agency before update on public.approvals
  for each row execute function public.lock_agency_id();

-- When status moves from pending → decision, auto-stamp who decided + when.
-- Caller does not have to (and should not be able to) forge decided_by.
create or replace function public.stamp_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
     and new.status in ('approved', 'approved_with_changes', 'rejected') then
    new.decided_by := coalesce(new.decided_by, auth.uid());
    new.decided_at := coalesce(new.decided_at, now());
  end if;
  return new;
end;
$$;

create trigger trg_approvals_stamp_decision
  before update on public.approvals
  for each row execute function public.stamp_approval_decision();

-- Plan-feature gate: only agencies whose plan includes the
-- `approval_workflow` feature flag may insert approvals at all.
create or replace function public.enforce_approval_workflow_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_feature(new.agency_id, 'approval_workflow') then
    raise exception 'plan_feature_required: approval_workflow is not included in this plan'
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_approvals_feature_gate
  before insert on public.approvals
  for each row execute function public.enforce_approval_workflow_feature();

-- Sync content_posts.approval_status whenever an approval row for a post
-- changes. Keeps the calendar query simple.
create or replace function public.sync_post_approval_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.entity_type = 'post')
     or (tg_op = 'UPDATE' and new.entity_type = 'post' and new.status is distinct from old.status) then
    update public.content_posts
       set approval_status = new.status
     where id = new.entity_id;
  end if;
  return null;
end;
$$;

create trigger trg_approvals_sync_post_status
  after insert or update on public.approvals
  for each row execute function public.sync_post_approval_status();

-- -------------------------------- RLS ---------------------------------------
alter table public.approvals enable row level security;
alter table public.approvals force row level security;

-- SELECT: agency staff for their agency, OR the client viewer the approval
-- belongs to (via the standard has_client_access path).
create policy "approvals_select" on public.approvals
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.has_client_access(client_id)
    or public.is_saas_admin()
  );

-- INSERT: only agency members (the agency requests approval, never the
-- client viewer).
create policy "approvals_insert" on public.approvals
  for insert
  with check (public.is_member_of(agency_id));

-- UPDATE policy A: agency members can edit (re-assign, withdraw, etc.).
create policy "approvals_update_by_agency" on public.approvals
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- UPDATE policy B: a client viewer can decide. WITH CHECK locks the
-- transition to a valid decision; the trigger above stamps decided_by/at.
create policy "approvals_decide_by_client" on public.approvals
  for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = approvals.client_id and cu.profile_id = auth.uid()
    )
  )
  with check (
    -- Must be the same approval row (RLS WITH CHECK can't compare with OLD;
    -- the trigger handles immutables). Just ensure the resulting status is
    -- a valid client decision.
    status in ('approved', 'approved_with_changes', 'rejected')
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = approvals.client_id and cu.profile_id = auth.uid()
    )
  );

-- DELETE: agency owners only.
create policy "approvals_delete_by_owner" on public.approvals
  for delete
  using (public.is_owner_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_approvals_agency_client_status
  on public.approvals (agency_id, client_id, status);
create index idx_approvals_entity
  on public.approvals (entity_type, entity_id);
create index idx_approvals_reviewer
  on public.approvals (reviewer_id, status)
  where reviewer_id is not null;


-- ========== migrations/20260620000009_phase1_tasks.sql ==========
-- =============================================================================
-- drea.mar — Phase 1 / Migration 9 — Task Management
--
-- Tasks, plus first-class comments and attachments. Tasks can optionally tie
-- to a client and to a content_posts row (so "edit the property tour" can
-- link straight to the calendar entry).
-- =============================================================================

create type task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'archived');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_type as enum (
  'planning', 'scripting', 'filming', 'editing', 'design',
  'reporting', 'approval', 'meeting', 'other'
);

-- --------------------------------- tasks ------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: not every task ties to a client (e.g. internal ops).
  client_id     uuid references public.clients(id) on delete cascade,
  -- Optional link to a calendar post (the "task spawned from a post" flow).
  post_id       uuid references public.content_posts(id) on delete set null,

  title         text not null,
  description   text,
  task_type     task_type not null default 'other',
  priority      task_priority not null default 'medium',
  status        task_status not null default 'todo',

  assigned_to   uuid references public.profiles(id) on delete set null,
  deadline      timestamptz,

  created_by    uuid references public.profiles(id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------- task_comments --------------------------------
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (length(body) > 0),
  created_at  timestamptz not null default now()
);

-- --------------------------- task_attachments -------------------------------
create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_tasks_lock_agency before update on public.tasks
  for each row execute function public.lock_agency_id();
create trigger trg_task_comments_lock_agency before update on public.task_comments
  for each row execute function public.lock_agency_id();
create trigger trg_task_attachments_lock_agency before update on public.task_attachments
  for each row execute function public.lock_agency_id();

-- When status transitions to/from 'done', stamp/unstamp completed_at.
create or replace function public.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_tasks_stamp_completion
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completion();

-- -------------------------------- RLS ---------------------------------------
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

-- Tasks are purely internal — Client Viewers never see them. Agency
-- members and the SaaS admin only.
create policy "tasks_select" on public.tasks
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.is_saas_admin()
  );

create policy "tasks_insert" on public.tasks
  for insert
  with check (public.is_member_of(agency_id));

create policy "tasks_update" on public.tasks
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "tasks_delete" on public.tasks
  for delete
  using (public.is_member_of(agency_id));

-- Comments: visible to anyone who can see the task; writable by agency
-- members (so a Content Creator can leave notes).
alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;

create policy "task_comments_select" on public.task_comments
  for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (
          t.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or public.is_saas_admin()
        )
    )
  );

create policy "task_comments_insert" on public.task_comments
  for insert
  with check (public.is_member_of(agency_id));

-- A comment author can edit/delete their own; owners can prune.
create policy "task_comments_update_own" on public.task_comments
  for update
  using (author_id = auth.uid() or public.is_owner_of(agency_id))
  with check (author_id = auth.uid() or public.is_owner_of(agency_id));

create policy "task_comments_delete_own" on public.task_comments
  for delete
  using (author_id = auth.uid() or public.is_owner_of(agency_id));

-- Attachments inherit from the task.
alter table public.task_attachments enable row level security;
alter table public.task_attachments force row level security;

create policy "task_attachments_select" on public.task_attachments
  for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (
          t.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or public.is_saas_admin()
        )
    )
  );

create policy "task_attachments_write" on public.task_attachments
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- Kanban board (status), my-tasks (assigned_to), overdue (deadline + status),
-- and per-client list.
create index idx_tasks_agency_status        on public.tasks (agency_id, status);
create index idx_tasks_agency_assigned      on public.tasks (agency_id, assigned_to) where assigned_to is not null;
create index idx_tasks_agency_client        on public.tasks (agency_id, client_id) where client_id is not null;
create index idx_tasks_overdue
  on public.tasks (agency_id, deadline)
  where status not in ('done', 'archived') and deadline is not null;
create index idx_tasks_post                 on public.tasks (post_id) where post_id is not null;
create index idx_task_comments_task         on public.task_comments (agency_id, task_id, created_at);
create index idx_task_attachments_task      on public.task_attachments (agency_id, task_id);


-- ========== migrations/20260620000010_phase2_hooks.sql ==========
-- =============================================================================
-- drea.mar — Phase 2 / Migration 10 — Hook & Content Library
--
-- The agency's curated bank of hooks. A hook can be agency-wide (client_id
-- null) or pinned to a specific client. `uses` and `avg_ai_score` are
-- maintained by a trigger in migration 11 (once videos exists), so the
-- library always reflects real performance without a join.
--
-- The Hook Library is an internal agency tool — Client Viewers never see it.
-- =============================================================================

create table public.hooks (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: null = agency-wide library hook; set = client-specific.
  client_id     uuid references public.clients(id) on delete cascade,

  text          text not null check (length(text) > 0),
  niche         niche,
  platform      platform,
  format        text,
  -- The qualitative outcome the agency recorded for this hook.
  result        text,

  -- AI-detected pattern label + winning flag (written by the hook-detection
  -- job in Phase 4). e.g. "Curiosity + price anchor".
  pattern       text,
  is_winning    boolean not null default false,

  -- Aggregates maintained by trigger from linked videos (migration 11).
  uses          int not null default 0,
  avg_ai_score  numeric(5, 2),

  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_hooks_updated_at before update on public.hooks
  for each row execute function public.set_updated_at();
create trigger trg_hooks_lock_agency before update on public.hooks
  for each row execute function public.lock_agency_id();

-- A client-pinned hook must belong to the same agency as its client.
create or replace function public.assert_hook_client_agency()
returns trigger
language plpgsql
as $$
declare
  v_client_agency uuid;
begin
  if new.client_id is null then
    return new;
  end if;
  select agency_id into v_client_agency from public.clients where id = new.client_id;
  if v_client_agency is null then
    raise exception 'unknown client %', new.client_id;
  end if;
  if v_client_agency <> new.agency_id then
    raise exception 'hook client % belongs to agency %, not %', new.client_id, v_client_agency, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_hooks_client_agency
  before insert or update on public.hooks
  for each row execute function public.assert_hook_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.hooks enable row level security;
alter table public.hooks force row level security;

-- Agency-internal: members + SaaS admin only. No Client Viewer access.
create policy "hooks_select" on public.hooks
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.is_saas_admin()
  );

create policy "hooks_insert" on public.hooks
  for insert
  with check (public.is_member_of(agency_id));

create policy "hooks_update" on public.hooks
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "hooks_delete" on public.hooks
  for delete
  using (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_hooks_agency               on public.hooks (agency_id);
create index idx_hooks_agency_client        on public.hooks (agency_id, client_id) where client_id is not null;
create index idx_hooks_agency_niche         on public.hooks (agency_id, niche) where niche is not null;
create index idx_hooks_winning              on public.hooks (agency_id, is_winning) where is_winning;
-- Fuzzy search across hook text for the library search box.
create index idx_hooks_text_trgm            on public.hooks using gin (text gin_trgm_ops);


-- ========== migrations/20260620000011_phase2_videos.sql ==========
-- =============================================================================
-- drea.mar — Phase 2 / Migration 11 — Video Performance Tracker
--
-- One row per video, every metric field from the spec, all nullable and
-- editable (Manual Analytics Input = editing these directly; no demo data).
-- Links optionally to a calendar post and a library hook. AI columns
-- (ai_score, ai_insight, recommendation) are written by the Phase-4 jobs but
-- are plain editable columns too.
--
-- Client Viewers can SEE their client's videos (portal "video performance"),
-- but cannot create/edit them.
-- =============================================================================

create type video_recommendation as enum ('repeat', 'improve', 'stop');

create table public.videos (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,
  -- Optional links. Calendar post that produced it; library hook it used.
  post_id               uuid references public.content_posts(id) on delete set null,
  hook_id               uuid references public.hooks(id) on delete set null,

  -- Creative / descriptive
  platform              platform,
  publish_date          date,
  video_link            text,
  hook                  text,             -- the actual hook line used
  body_angle            text,
  cta                   text,
  video_format          text,
  duration_seconds      int check (duration_seconds is null or duration_seconds >= 0),
  objective             text,

  -- Reach / retention
  views                 bigint check (views is null or views >= 0),
  reach                 bigint check (reach is null or reach >= 0),
  watch_time_seconds    int check (watch_time_seconds is null or watch_time_seconds >= 0),
  retention_3s_pct      numeric(5, 2) check (retention_3s_pct is null or retention_3s_pct between 0 and 100),
  retention_50_pct      numeric(5, 2) check (retention_50_pct is null or retention_50_pct between 0 and 100),
  completion_rate_pct   numeric(5, 2) check (completion_rate_pct is null or completion_rate_pct between 0 and 100),

  -- Engagement
  likes                 bigint check (likes is null or likes >= 0),
  comments              bigint check (comments is null or comments >= 0),
  shares                bigint check (shares is null or shares >= 0),
  saves                 bigint check (saves is null or saves >= 0),
  dms                   int check (dms is null or dms >= 0),
  calls                 int check (calls is null or calls >= 0),

  -- Business impact
  estimated_sales_impact text,            -- free text, e.g. "~€430k pipeline"
  estimated_revenue      numeric(12, 2),  -- structured value when known

  -- Feedback + AI
  client_feedback       text,
  ai_score              int check (ai_score is null or ai_score between 0 and 100),
  ai_insight            text,
  recommendation        video_recommendation,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Now that videos exists, wire the calendar's soft video_id into a real FK.
alter table public.content_posts
  add constraint content_posts_video_fk
  foreign key (video_id) references public.videos(id) on delete set null;

-- ------------------------------- triggers ----------------------------------
create trigger trg_videos_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger trg_videos_lock_agency before update on public.videos
  for each row execute function public.lock_agency_id();

-- Consistency: a video's client, its post, and its hook must all live in the
-- video's agency (defence-in-depth beyond RLS).
create or replace function public.assert_video_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  -- client
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'video client % is not in agency %', new.client_id, new.agency_id;
  end if;
  -- post (optional)
  if new.post_id is not null then
    select agency_id into v_agency from public.content_posts where id = new.post_id;
    if v_agency <> new.agency_id then
      raise exception 'video post % is not in agency %', new.post_id, new.agency_id;
    end if;
  end if;
  -- hook (optional)
  if new.hook_id is not null then
    select agency_id into v_agency from public.hooks where id = new.hook_id;
    if v_agency <> new.agency_id then
      raise exception 'video hook % is not in agency %', new.hook_id, new.agency_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_videos_assert_refs
  before insert or update on public.videos
  for each row execute function public.assert_video_refs();

-- Recompute a hook's aggregate stats (uses + avg_ai_score) from its linked
-- videos. Called by the trigger below on any change to videos.hook_id or
-- videos.ai_score.
create or replace function public.recompute_hook_stats(p_hook uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_hook is null then return; end if;
  update public.hooks h
     set uses = sub.cnt,
         avg_ai_score = sub.avg_score,
         updated_at = now()
    from (
      select count(*) as cnt, avg(ai_score)::numeric(5,2) as avg_score
        from public.videos
       where hook_id = p_hook
    ) sub
   where h.id = p_hook;
end;
$$;

create or replace function public.on_video_change_update_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_hook_stats(new.hook_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_hook_stats(old.hook_id);
  elsif tg_op = 'UPDATE' then
    -- Recompute both old and new hook if the link or score changed.
    if new.hook_id is distinct from old.hook_id then
      perform public.recompute_hook_stats(old.hook_id);
      perform public.recompute_hook_stats(new.hook_id);
    elsif new.ai_score is distinct from old.ai_score then
      perform public.recompute_hook_stats(new.hook_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_videos_maintain_hook_stats
  after insert or delete or update of hook_id, ai_score on public.videos
  for each row execute function public.on_video_change_update_hook();

-- -------------------------------- RLS ---------------------------------------
alter table public.videos enable row level security;
alter table public.videos force row level security;

-- Agency members see all their videos. Client Viewers see only their
-- client's videos (the portal video-performance view).
create policy "videos_select" on public.videos
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = videos.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members create/edit/delete videos (Client Viewers are read-only).
create policy "videos_insert" on public.videos
  for insert
  with check (public.is_member_of(agency_id));

create policy "videos_update" on public.videos
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "videos_delete" on public.videos
  for delete
  using (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- Hot queries: per-client list, top performers (ai_score / views), by
-- recommendation, by publish date, and the post/hook backlinks.
create index idx_videos_agency_client        on public.videos (agency_id, client_id);
create index idx_videos_agency_score         on public.videos (agency_id, ai_score desc nulls last);
create index idx_videos_agency_views         on public.videos (agency_id, views desc nulls last);
create index idx_videos_agency_recommend     on public.videos (agency_id, recommendation) where recommendation is not null;
create index idx_videos_publish_date         on public.videos (agency_id, publish_date desc) where publish_date is not null;
create index idx_videos_post                 on public.videos (post_id) where post_id is not null;
create index idx_videos_hook                 on public.videos (hook_id) where hook_id is not null;


-- ========== migrations/20260620000012_phase2_analytics.sql ==========
-- =============================================================================
-- drea.mar — Phase 2 / Migration 12 — Manual Analytics Input
--
-- Platform-level growth snapshots per client + platform + date (followers,
-- reach, impressions, engagement). This is the "Analytics Overviews" /
-- platform-growth data, entered manually (or synced later), distinct from
-- the per-video metrics in `videos`.
--
-- Client Viewers can SEE their client's snapshots (portal analytics) but
-- cannot write them.
-- =============================================================================

create table public.metric_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,
  platform              platform not null,
  snapshot_date         date not null,

  followers             bigint   check (followers is null or followers >= 0),
  new_followers         int,     -- can be negative (net follower loss)
  reach                 bigint   check (reach is null or reach >= 0),
  impressions           bigint   check (impressions is null or impressions >= 0),
  profile_views         bigint   check (profile_views is null or profile_views >= 0),
  engagement_rate_pct   numeric(5, 2) check (engagement_rate_pct is null or engagement_rate_pct between 0 and 100),
  total_interactions    bigint   check (total_interactions is null or total_interactions >= 0),

  notes                 text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One snapshot per client + platform + date. Re-entry updates in place.
  unique (client_id, platform, snapshot_date)
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_metric_snapshots_updated_at before update on public.metric_snapshots
  for each row execute function public.set_updated_at();
create trigger trg_metric_snapshots_lock_agency before update on public.metric_snapshots
  for each row execute function public.lock_agency_id();

create or replace function public.assert_snapshot_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'snapshot client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_metric_snapshots_client_agency
  before insert or update on public.metric_snapshots
  for each row execute function public.assert_snapshot_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.metric_snapshots enable row level security;
alter table public.metric_snapshots force row level security;

create policy "metric_snapshots_select" on public.metric_snapshots
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = metric_snapshots.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

create policy "metric_snapshots_write" on public.metric_snapshots
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- Time-series queries: a client's growth on a platform over time.
create index idx_metric_snapshots_client_platform_date
  on public.metric_snapshots (agency_id, client_id, platform, snapshot_date desc);
create index idx_metric_snapshots_agency_date
  on public.metric_snapshots (agency_id, snapshot_date desc);


-- ========== migrations/20260620000013_phase3_business_impact.sql ==========
-- =============================================================================
-- drea.mar — Phase 3 / Migration 13 — Business Impact Tracker
--
-- Manual, real-world impact numbers entered EITHER by the agency OR by the
-- client (the portal "fill business impact forms" flow). `source`
-- distinguishes who entered a given month's row, so both can coexist.
--
-- This is the first table where a Client Viewer has WRITE access — but only
-- to their own client's rows, and only with source='client'. The two write
-- policies (agency-members / client-viewer) are OR'd by Postgres.
-- =============================================================================

create type impact_source as enum ('agency', 'client');

create table public.business_impact_entries (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references public.agencies(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  -- First day of the month the figures cover.
  period_month        date not null,
  source              impact_source not null default 'agency',

  -- Inbound / conversion counts (all nullable + editable).
  calls_received      int check (calls_received is null or calls_received >= 0),
  relevant_dms        int check (relevant_dms is null or relevant_dms >= 0),
  bookings            int check (bookings is null or bookings >= 0),
  appointments        int check (appointments is null or appointments >= 0),
  orders              int check (orders is null or orders >= 0),
  sales               int check (sales is null or sales >= 0),
  viewings            int check (viewings is null or viewings >= 0),
  contracts           int check (contracts is null or contracts >= 0),
  revenue_estimate    numeric(12, 2) check (revenue_estimate is null or revenue_estimate >= 0),

  -- Qualitative inputs.
  qualitative_feedback text,
  objections_heard     text,

  entered_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One row per client + month + source. Re-submission updates in place.
  unique (client_id, period_month, source)
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_impact_updated_at before update on public.business_impact_entries
  for each row execute function public.set_updated_at();
create trigger trg_impact_lock_agency before update on public.business_impact_entries
  for each row execute function public.lock_agency_id();

create or replace function public.assert_impact_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'impact client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_impact_client_agency
  before insert or update on public.business_impact_entries
  for each row execute function public.assert_impact_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.business_impact_entries enable row level security;
alter table public.business_impact_entries force row level security;

-- SELECT: agency staff for their agency, OR the client viewer for this client.
create policy "impact_select" on public.business_impact_entries
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.has_client_access(client_id)
    or public.is_saas_admin()
  );

-- WRITE policy A — agency members: full control over any source.
create policy "impact_write_by_agency" on public.business_impact_entries
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- WRITE policy B — client viewers: INSERT/UPDATE only their own client's rows,
-- and only with source='client'. (Two separate policies because FOR ALL with
-- a USING that references source would block INSERT, which has no OLD row.)
create policy "impact_insert_by_client" on public.business_impact_entries
  for insert
  with check (
    source = 'client'
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = business_impact_entries.client_id
        and cu.profile_id = auth.uid()
    )
  );

create policy "impact_update_by_client" on public.business_impact_entries
  for update
  using (
    source = 'client'
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = business_impact_entries.client_id
        and cu.profile_id = auth.uid()
    )
  )
  with check (
    source = 'client'
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = business_impact_entries.client_id
        and cu.profile_id = auth.uid()
    )
  );

-- ------------------------------- indexes ------------------------------------
create index idx_impact_agency_client_month
  on public.business_impact_entries (agency_id, client_id, period_month desc);
create index idx_impact_agency_month
  on public.business_impact_entries (agency_id, period_month desc);


-- ========== migrations/20260620000014_phase3_health_score.sql ==========
-- =============================================================================
-- drea.mar — Phase 3 / Migration 14 — Client Health Score
--
-- The Client Health Score is the AGENCY's internal risk assessment of the
-- relationship (low/medium/high). It must NOT be visible to the client.
--
-- Phase 0 put health_score + risk directly on `clients`. But a Client Viewer
-- can read their own clients row (clients_select policy), and Postgres RLS is
-- row-level — it cannot hide individual columns. So leaving health on
-- `clients` would leak the agency's internal risk rating to the client.
--
-- Fix: drop those columns from `clients`, and store health in a dedicated,
-- agency-internal `client_health_scores` table with full history. A
-- security-invoker view exposes the latest score per client to agency
-- dashboards (the view inherits the table's RLS, so it stays agency-only).
-- =============================================================================

-- Remove the leaky columns. Nothing in the DB depends on them yet (the
-- front end still uses sample data; live wiring is Phase 8).
alter table public.clients drop column if exists health_score;
alter table public.clients drop column if exists risk;

create type health_method as enum ('ai', 'manual');

create table public.client_health_scores (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,

  score         int not null check (score between 0 and 100),
  risk          risk_level not null,

  -- The weighted component inputs the score was derived from. Shape:
  -- { performance_trend, client_feedback, approval_delays, overdue_tasks,
  --   report_delivery, business_impact, communication_frequency } each 0..100
  -- plus an optional weights map.
  components    jsonb not null default '{}'::jsonb,
  ai_rationale  text,
  method        health_method not null default 'ai',

  computed_by   uuid references public.profiles(id) on delete set null,
  computed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_health_lock_agency before update on public.client_health_scores
  for each row execute function public.lock_agency_id();

create or replace function public.assert_health_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'health client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_health_client_agency
  before insert or update on public.client_health_scores
  for each row execute function public.assert_health_client_agency();

-- Derive risk from score if the caller didn't set it, so a manual entry can
-- just supply a number. (Thresholds match the front-end gauge.)
create or replace function public.default_health_risk()
returns trigger
language plpgsql
as $$
begin
  if new.risk is null then
    new.risk := case
      when new.score >= 75 then 'low'::risk_level
      when new.score >= 50 then 'medium'::risk_level
      else 'high'::risk_level
    end;
  end if;
  return new;
end;
$$;

-- risk is NOT NULL, so this BEFORE trigger must run; we make risk nullable at
-- the app layer by allowing the trigger to fill it. To keep the NOT NULL
-- constraint, callers either pass risk or rely on this trigger.
create trigger trg_health_default_risk
  before insert on public.client_health_scores
  for each row execute function public.default_health_risk();

-- -------------------------------- RLS ---------------------------------------
-- Agency-internal ONLY. Client Viewers never see health scores.
alter table public.client_health_scores enable row level security;
alter table public.client_health_scores force row level security;

create policy "health_select" on public.client_health_scores
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.is_saas_admin()
  );

create policy "health_insert" on public.client_health_scores
  for insert
  with check (public.is_member_of(agency_id));

create policy "health_delete" on public.client_health_scores
  for delete
  using (public.is_owner_of(agency_id));

-- Health snapshots are immutable history — no UPDATE policy (recompute =
-- insert a new row).

-- --------------------- current-health view (agency) -------------------------
-- Latest score per client. security_invoker=true makes the view run with the
-- querying user's privileges, so it inherits client_health_scores' RLS — a
-- Client Viewer querying it gets nothing.
create view public.client_current_health
  with (security_invoker = true)
as
  select distinct on (client_id)
    client_id,
    agency_id,
    score,
    risk,
    components,
    ai_rationale,
    computed_at
  from public.client_health_scores
  order by client_id, computed_at desc;

-- ------------------------------- indexes ------------------------------------
create index idx_health_agency_client_time
  on public.client_health_scores (agency_id, client_id, computed_at desc);
create index idx_health_agency_risk
  on public.client_health_scores (agency_id, risk);


-- ========== migrations/20260620000015_phase4_ai_reports.sql ==========
-- =============================================================================
-- drea.mar — Phase 4 / Migration 15 — AI Monthly Reports
--
-- One report per client per month. The 13 spec sections live in an editable
-- `sections` jsonb (so the front-end's add/remove/reorder/edit maps 1:1).
-- Edit history is snapshotted into ai_report_versions.
--
-- Gated by the `ai_reports` feature flag (Growth and up).
--
-- Client portal: a Client Viewer can view their client's reports, but ONLY
-- once they're 'sent' or 'approved' — never drafts in progress.
-- =============================================================================

create type report_status as enum ('draft', 'generating', 'ready', 'sent', 'approved', 'failed');

-- The 13-section skeleton a new report starts with, in spec order.
create or replace function public.default_report_sections()
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(
           jsonb_build_object('key', k, 'title', t, 'body', '', 'ready', false, 'order', ord)
           order by ord
         )
  from (values
    ('executive_summary',        'Executive Summary',          1),
    ('work_completed',           'Work Completed',             2),
    ('best_performing_content',  'Best-Performing Content',    3),
    ('worst_performing_content', 'Worst-Performing Content',   4),
    ('platform_growth',          'Platform Growth',            5),
    ('hook_analysis',            'Hook Analysis',              6),
    ('content_format_analysis',  'Content Format Analysis',    7),
    ('business_impact',          'Business Impact',            8),
    ('client_feedback',          'Client Feedback',            9),
    ('problems_noticed',         'Problems Noticed',          10),
    ('next_month_strategy',      'Next-Month Strategy',       11),
    ('recommended_content_plan', 'Recommended Content Plan',  12),
    ('final_agency_conclusion',  'Final Agency Conclusion',   13)
  ) as s(k, t, ord);
$$;

-- ------------------------------ ai_reports ----------------------------------
create table public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  period_month  date not null,

  title         text not null default 'Monthly Performance Report',
  status        report_status not null default 'draft',
  -- Editable block model: [{ key, title, body, ready, order }, …]
  sections      jsonb not null default public.default_report_sections(),

  white_label   boolean not null default false,
  pdf_path      text,           -- storage path once exported

  -- AI provenance (written by the generation job).
  model         text,
  prompt_tokens int,
  completion_tokens int,

  generated_at  timestamptz,
  sent_at       timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (client_id, period_month)
);

-- -------------------------- ai_report_versions ------------------------------
create table public.ai_report_versions (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  report_id   uuid not null references public.ai_reports(id) on delete cascade,
  version     int not null,
  sections    jsonb not null,
  edited_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (report_id, version)
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_ai_reports_updated_at before update on public.ai_reports
  for each row execute function public.set_updated_at();
create trigger trg_ai_reports_lock_agency before update on public.ai_reports
  for each row execute function public.lock_agency_id();
create trigger trg_ai_report_versions_lock before update on public.ai_report_versions
  for each row execute function public.lock_agency_id();

create or replace function public.assert_report_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'report client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_client_agency
  before insert or update on public.ai_reports
  for each row execute function public.assert_report_client_agency();

-- Feature gate: only agencies whose plan includes `ai_reports` may create them.
create or replace function public.enforce_ai_reports_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_feature(new.agency_id, 'ai_reports') then
    raise exception 'plan_feature_required: ai_reports is not included in this plan'
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_feature_gate
  before insert on public.ai_reports
  for each row execute function public.enforce_ai_reports_feature();

-- Stamp sent_at when a report is first sent.
create or replace function public.stamp_report_sent()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'sent' and (old.status is distinct from 'sent') then
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_stamp_sent
  before update of status on public.ai_reports
  for each row execute function public.stamp_report_sent();

-- -------------------------------- RLS ---------------------------------------
alter table public.ai_reports enable row level security;
alter table public.ai_reports force row level security;

create policy "ai_reports_select" on public.ai_reports
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or (
      status in ('sent', 'approved')
      and exists (
        select 1 from public.client_users cu
        where cu.client_id = ai_reports.client_id and cu.profile_id = auth.uid()
      )
    )
    or public.is_saas_admin()
  );

create policy "ai_reports_insert" on public.ai_reports
  for insert
  with check (public.is_member_of(agency_id));

create policy "ai_reports_update" on public.ai_reports
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "ai_reports_delete" on public.ai_reports
  for delete
  using (public.is_member_of(agency_id));

-- Versions are agency-internal edit history.
alter table public.ai_report_versions enable row level security;
alter table public.ai_report_versions force row level security;

create policy "ai_report_versions_select" on public.ai_report_versions
  for select using (public.is_member_of(agency_id));
create policy "ai_report_versions_insert" on public.ai_report_versions
  for insert with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_ai_reports_agency_client_month
  on public.ai_reports (agency_id, client_id, period_month desc);
create index idx_ai_reports_agency_status
  on public.ai_reports (agency_id, status);
create index idx_ai_reports_due
  on public.ai_reports (agency_id, period_month)
  where status in ('draft', 'generating');
create index idx_ai_report_versions_report
  on public.ai_report_versions (agency_id, report_id, version desc);


-- ========== migrations/20260620000016_phase4_ai_strategy.sql ==========
-- =============================================================================
-- drea.mar — Phase 4 / Migration 16 — AI Strategy Room
--
-- A per-client chat with Claude, grounded in the client's stored data. Threads
-- hold messages; the assistant's responses are produced by an Edge Function
-- (Phase 7) that assembles context from videos/metrics/feedback/reports and
-- calls the Anthropic API.
--
-- This is an AGENCY tool — Client Viewers have no access. Gated by the
-- `ai_strategy_room` feature flag (Unlimited and up).
-- =============================================================================

create type chat_role as enum ('user', 'assistant', 'system');

-- -------------------------- ai_strategy_threads -----------------------------
create table public.ai_strategy_threads (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  title           text not null default 'New conversation',
  created_by      uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -------------------------- ai_strategy_messages ----------------------------
create table public.ai_strategy_messages (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  thread_id   uuid not null references public.ai_strategy_threads(id) on delete cascade,
  role        chat_role not null,
  content     text not null,
  -- AI provenance for assistant messages.
  model       text,
  tokens      int,
  created_at  timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_strategy_threads_updated_at before update on public.ai_strategy_threads
  for each row execute function public.set_updated_at();
create trigger trg_strategy_threads_lock before update on public.ai_strategy_threads
  for each row execute function public.lock_agency_id();
create trigger trg_strategy_messages_lock before update on public.ai_strategy_messages
  for each row execute function public.lock_agency_id();

create or replace function public.assert_thread_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'thread client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_strategy_threads_client_agency
  before insert or update on public.ai_strategy_threads
  for each row execute function public.assert_thread_client_agency();

-- Feature gate: Unlimited+ only.
create or replace function public.enforce_strategy_room_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_feature(new.agency_id, 'ai_strategy_room') then
    raise exception 'plan_feature_required: ai_strategy_room is not included in this plan'
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_strategy_threads_feature_gate
  before insert on public.ai_strategy_threads
  for each row execute function public.enforce_strategy_room_feature();

-- Bump the thread's last_message_at + a denormalized message agency check.
create or replace function public.on_strategy_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_thread_agency uuid;
begin
  select agency_id into v_thread_agency from public.ai_strategy_threads where id = new.thread_id;
  if v_thread_agency is null or v_thread_agency <> new.agency_id then
    raise exception 'message thread % is not in agency %', new.thread_id, new.agency_id;
  end if;
  update public.ai_strategy_threads
     set last_message_at = new.created_at, updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

create trigger trg_strategy_messages_after_insert
  before insert on public.ai_strategy_messages
  for each row execute function public.on_strategy_message_insert();

-- -------------------------------- RLS ---------------------------------------
-- Agency-internal. No Client Viewer access at all.
alter table public.ai_strategy_threads enable row level security;
alter table public.ai_strategy_threads force row level security;

create policy "strategy_threads_select" on public.ai_strategy_threads
  for select using (public.is_member_of(agency_id));
create policy "strategy_threads_insert" on public.ai_strategy_threads
  for insert with check (public.is_member_of(agency_id));
create policy "strategy_threads_update" on public.ai_strategy_threads
  for update using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));
create policy "strategy_threads_delete" on public.ai_strategy_threads
  for delete using (public.is_member_of(agency_id));

alter table public.ai_strategy_messages enable row level security;
alter table public.ai_strategy_messages force row level security;

create policy "strategy_messages_select" on public.ai_strategy_messages
  for select
  using (
    exists (
      select 1 from public.ai_strategy_threads t
      where t.id = ai_strategy_messages.thread_id and public.is_member_of(t.agency_id)
    )
  );
create policy "strategy_messages_insert" on public.ai_strategy_messages
  for insert with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_strategy_threads_agency_client
  on public.ai_strategy_threads (agency_id, client_id, last_message_at desc nulls last);
create index idx_strategy_messages_thread
  on public.ai_strategy_messages (thread_id, created_at);


-- ========== migrations/20260620000017_phase4_ai_jobs.sql ==========
-- =============================================================================
-- drea.mar — Phase 4 / Migration 17 — AI Jobs Queue + Usage Metering
--
-- ai_jobs: a queue every AI feature enqueues into (report generation,
--   strategy responses, hook detection, health recompute, doc summary).
--   An Edge Function worker (Phase 7) claims queued jobs, calls Claude, and
--   writes the result back.
--
-- ai_usage: a per-call ledger of tokens + cost + credits. A trigger rolls
--   credits up into usage_counters.ai_credits_used so the billing page can
--   show "AI credits used / quota" without scanning the ledger.
-- =============================================================================

create type ai_job_type as enum (
  'report_generation',
  'strategy_response',
  'hook_detection',
  'health_score',
  'document_summary'
);

create type ai_job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- ------------------------------- ai_jobs ------------------------------------
create table public.ai_jobs (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Optional: most jobs are about a client, but not all (e.g. an
  -- agency-wide hook-pattern sweep).
  client_id     uuid references public.clients(id) on delete cascade,
  type          ai_job_type not null,
  status        ai_job_status not null default 'queued',

  -- What the job operates on / produces. Refs rather than payloads so we
  -- don't duplicate large bodies.
  input_ref     jsonb not null default '{}'::jsonb,
  output_ref    jsonb,
  error         text,
  attempts      int not null default 0,

  -- Provenance once it runs.
  model             text,
  prompt_tokens     int,
  completion_tokens int,
  cost_eur          numeric(10, 4),

  requested_by  uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- ------------------------------- ai_usage -----------------------------------
create table public.ai_usage (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,
  job_id            uuid references public.ai_jobs(id) on delete set null,
  feature           ai_job_type not null,
  model             text,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  -- Internal credit cost (the unit shown on the billing page).
  credits           int not null default 0,
  cost_eur          numeric(10, 4),
  created_at        timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
-- Stamp started/finished as status moves through the queue.
create or replace function public.stamp_ai_job_timing()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'running' and old.status = 'queued' then
    new.started_at := coalesce(new.started_at, now());
  elsif new.status in ('succeeded', 'failed', 'canceled') and old.status not in ('succeeded', 'failed', 'canceled') then
    new.finished_at := coalesce(new.finished_at, now());
  end if;
  return new;
end;
$$;

create trigger trg_ai_jobs_timing
  before update of status on public.ai_jobs
  for each row execute function public.stamp_ai_job_timing();

create trigger trg_ai_jobs_lock_agency before update on public.ai_jobs
  for each row execute function public.lock_agency_id();

-- Roll usage credits up into usage_counters.
create or replace function public.accumulate_ai_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usage_counters
     set ai_credits_used = ai_credits_used + new.credits,
         updated_at = now()
   where agency_id = new.agency_id;
  return null;
end;
$$;

create trigger trg_ai_usage_accumulate
  after insert on public.ai_usage
  for each row execute function public.accumulate_ai_usage();

-- -------------------------------- RLS ---------------------------------------
-- Both tables are agency-internal (ops/billing visibility). Workers use
-- service_role and bypass RLS.
alter table public.ai_jobs enable row level security;
alter table public.ai_jobs force row level security;

create policy "ai_jobs_select" on public.ai_jobs
  for select using (public.is_member_of(agency_id));
-- Users may enqueue jobs (the worker, on service_role, updates them).
create policy "ai_jobs_insert" on public.ai_jobs
  for insert with check (public.is_member_of(agency_id));

alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;

create policy "ai_usage_select" on public.ai_usage
  for select using (public.is_member_of(agency_id));
-- Inserts are by the worker (service_role); no user insert policy.

-- ------------------------------- indexes ------------------------------------
-- The worker's claim query: oldest queued job.
create index idx_ai_jobs_queue
  on public.ai_jobs (status, created_at)
  where status = 'queued';
create index idx_ai_jobs_agency_time
  on public.ai_jobs (agency_id, created_at desc);
create index idx_ai_usage_agency_time
  on public.ai_usage (agency_id, created_at desc);


-- ========== migrations/20260620000018_phase5_documents.sql ==========
-- =============================================================================
-- drea.mar — Phase 5 / Migration 18 — Document Library (metadata)
--
-- Folders (nestable), documents (metadata + storage path), and document_ai
-- (AI summary + extracted brief fields). The bytes live in Supabase Storage;
-- these tables hold metadata and drive the UI. Storage bucket + object RLS
-- come in migration 19.
--
-- Folders + AI summaries are agency-internal. Documents are client-portal
-- aware: a Client Viewer can see and UPLOAD their own client's documents.
-- =============================================================================

create type doc_ai_status as enum ('pending', 'processing', 'ready', 'failed');

-- ------------------------------- folders ------------------------------------
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: agency-wide folder vs client-specific.
  client_id   uuid references public.clients(id) on delete cascade,
  parent_id   uuid references public.folders(id) on delete cascade,
  name        text not null check (length(name) > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------ documents -----------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: agency brand assets vs client-specific docs.
  client_id     uuid references public.clients(id) on delete cascade,
  folder_id     uuid references public.folders(id) on delete set null,

  -- The Supabase Storage object path (bucket = 'documents'). Convention:
  --   {agency_id}/{client_id}/{uuid-filename}     (client doc)
  --   {agency_id}/_agency/{uuid-filename}         (agency-wide doc)
  storage_path  text not null unique,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  tags          text[] not null default '{}'::text[],

  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------- document_ai ----------------------------------
create table public.document_ai (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade unique,
  status          doc_ai_status not null default 'pending',
  summary         text,
  -- Extracted brief fields, e.g. { "Objective": "...", "Budget": "..." }.
  extracted_fields jsonb not null default '{}'::jsonb,
  model           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();
create trigger trg_folders_lock_agency before update on public.folders
  for each row execute function public.lock_agency_id();
create trigger trg_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger trg_documents_lock_agency before update on public.documents
  for each row execute function public.lock_agency_id();
create trigger trg_document_ai_updated_at before update on public.document_ai
  for each row execute function public.set_updated_at();
create trigger trg_document_ai_lock_agency before update on public.document_ai
  for each row execute function public.lock_agency_id();

-- Client consistency for client-scoped folders/documents.
create or replace function public.assert_doc_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_agency uuid;
begin
  if new.client_id is null then
    return new;
  end if;
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_folders_client_agency
  before insert or update on public.folders
  for each row execute function public.assert_doc_client_agency();
create trigger trg_documents_client_agency
  before insert or update on public.documents
  for each row execute function public.assert_doc_client_agency();

-- -------------------------------- RLS ---------------------------------------
-- Folders: agency-internal organization. No Client Viewer access.
alter table public.folders enable row level security;
alter table public.folders force row level security;

create policy "folders_select" on public.folders
  for select using (public.is_member_of(agency_id));
create policy "folders_write" on public.folders
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

-- Documents: agency members see all; Client Viewers see + upload their own
-- client's docs.
alter table public.documents enable row level security;
alter table public.documents force row level security;

create policy "documents_select" on public.documents
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or (
      client_id is not null
      and exists (
        select 1 from public.client_users cu
        where cu.client_id = documents.client_id and cu.profile_id = auth.uid()
      )
    )
    or public.is_saas_admin()
  );

-- Agency members: full write.
create policy "documents_write_by_agency" on public.documents
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- Client Viewers: upload to their own client only.
create policy "documents_insert_by_client" on public.documents
  for insert
  with check (
    client_id is not null
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = documents.client_id and cu.profile_id = auth.uid()
    )
  );

-- document_ai: agency-internal (AI analysis is the agency's).
alter table public.document_ai enable row level security;
alter table public.document_ai force row level security;

create policy "document_ai_select" on public.document_ai
  for select using (public.is_member_of(agency_id));
create policy "document_ai_write" on public.document_ai
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_folders_agency_client       on public.folders (agency_id, client_id);
create index idx_folders_parent              on public.folders (parent_id) where parent_id is not null;
create index idx_documents_agency_client     on public.documents (agency_id, client_id);
create index idx_documents_folder            on public.documents (folder_id) where folder_id is not null;
create index idx_documents_tags              on public.documents using gin (tags);
create index idx_documents_filename_trgm     on public.documents using gin (filename gin_trgm_ops);
create index idx_document_ai_status          on public.document_ai (agency_id, status);


-- (skipped migrations/20260620000019_phase5_storage.sql — storage configured via dashboard)

-- ========== migrations/20260620000020_phase6_niche_config.sql ==========
-- =============================================================================
-- drea.mar — Phase 6 / Migration 20 — Niche config registry + generic metrics
--
-- niche_config is the registry that drives each niche's dashboard: which KPI
-- cards, form fields, item types, and report sections to render. Adding or
-- tweaking a niche is a CONFIG change (a row), never a schema migration.
--
-- Each niche has a SYSTEM DEFAULT (agency_id null) seeded here; an agency may
-- store its own override row. `niche_config_for(agency, niche)` resolves the
-- effective config (override → default).
--
-- client_niche_metrics is the generic, config-driven monthly KPI store used by
-- every niche dashboard (headline numbers). Per-item lists (properties,
-- dishes, treatments, …) live in migration 21.
-- =============================================================================

create table public.niche_config (
  id          uuid primary key default gen_random_uuid(),
  -- null = system default; set = agency override.
  agency_id   uuid references public.agencies(id) on delete cascade,
  niche       niche not null,
  config      jsonb not null default '{}'::jsonb,
  version     int not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One system default per niche; one override per (agency, niche).
create unique index niche_config_system_default
  on public.niche_config (niche) where agency_id is null;
create unique index niche_config_agency_override
  on public.niche_config (agency_id, niche) where agency_id is not null;

create table public.client_niche_metrics (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  niche         niche not null,
  period_month  date not null,
  -- Keyed by the metric definitions in the niche's config, e.g.
  -- { "reservations": 312, "online_orders": 1284, "sales_impact_eur": 38200 }.
  metrics       jsonb not null default '{}'::jsonb,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, period_month)
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_niche_config_updated_at before update on public.niche_config
  for each row execute function public.set_updated_at();
create trigger trg_client_niche_metrics_updated_at before update on public.client_niche_metrics
  for each row execute function public.set_updated_at();
create trigger trg_client_niche_metrics_lock before update on public.client_niche_metrics
  for each row execute function public.lock_agency_id();

create or replace function public.assert_metrics_client_agency()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'metrics client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;
create trigger trg_client_niche_metrics_client_agency
  before insert or update on public.client_niche_metrics
  for each row execute function public.assert_metrics_client_agency();

-- Resolver: effective config for an agency + niche (override else default).
create or replace function public.niche_config_for(p_agency uuid, p_niche niche)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select config from public.niche_config where agency_id = p_agency and niche = p_niche),
    (select config from public.niche_config where agency_id is null and niche = p_niche)
  );
$$;

-- -------------------------------- RLS ---------------------------------------
alter table public.niche_config enable row level security;
alter table public.niche_config force row level security;

-- System defaults are readable by everyone authenticated; agency overrides by
-- that agency.
create policy "niche_config_select" on public.niche_config
  for select
  using (
    agency_id is null
    or agency_id in (select * from public.current_agency_ids())
    or public.is_saas_admin()
  );

-- Only agency owners write their OWN override rows (never the system default).
create policy "niche_config_write" on public.niche_config
  for all
  using (agency_id is not null and public.is_owner_of(agency_id))
  with check (agency_id is not null and public.is_owner_of(agency_id));

alter table public.client_niche_metrics enable row level security;
alter table public.client_niche_metrics force row level security;

-- Agency members + the client viewer (portal niche dashboard) can read.
create policy "client_niche_metrics_select" on public.client_niche_metrics
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = client_niche_metrics.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

create policy "client_niche_metrics_write" on public.client_niche_metrics
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_client_niche_metrics_client_month
  on public.client_niche_metrics (agency_id, client_id, period_month desc);

-- ------------------------- seed: system defaults ----------------------------
-- Minimal, real config skeletons per niche. The front end reads `config` to
-- render KPI cards, item lists, and report sections. Extend freely without a
-- migration (new keys / new niches = new rows).
insert into public.niche_config (agency_id, niche, config) values
  (null, 'real_estate', '{"kpis":["promoted_properties","viewings_booked","offers_received","cost_per_lead"],"items":["property"],"report_sections":["promoted_properties","lead_funnel","top_hooks"]}'),
  (null, 'restaurant',  '{"kpis":["reservations","online_orders","foot_traffic","sales_impact_eur"],"items":["dish","menu_campaign","event"],"report_sections":["reservations_orders","best_dishes","buying_intent"]}'),
  (null, 'dental_clinic','{"kpis":["qualified_leads","appointments_booked","patients_arrived","cost_per_appointment"],"items":["treatment"],"report_sections":["treatments","patient_funnel","objections"]}'),
  (null, 'fitness_gym', '{"kpis":["memberships_sold","trial_sessions","messages_received","new_members_from_content"],"items":["class","trainer_content"],"report_sections":["memberships_trials","class_promotion","trainers"]}'),
  (null, 'lounge',      '{"kpis":["cover_revenue_eur","tables_booked","guest_list_signups","avg_bar_tab_eur"],"items":["night","dj"],"report_sections":["guest_traffic","top_nights"]}'),
  (null, 'beauty',      '{"kpis":["bookings","repeat_rate_pct","retail_sales_eur","avg_ticket_eur"],"items":["treatment","collab"],"report_sections":["service_mix","top_treatments"]}'),
  (null, 'auto',        '{"kpis":["test_drives","vehicles_sold","avg_days_on_lot","financing_approved"],"items":["vehicle","trade_in"],"report_sections":["inventory","lead_funnel"]}'),
  (null, 'hotel',       '{"kpis":["occupancy_pct","adr_eur","revpar_eur","avg_lead_time_days"],"items":["room_type"],"report_sections":["occupancy_adr","booking_channels","reviews"]}'),
  (null, 'local_store', '{"kpis":["foot_traffic","transactions","avg_basket_eur","loyalty_signups"],"items":["sku","promo"],"report_sections":["traffic","top_skus"]}'),
  (null, 'custom',      '{"kpis":["leads","bookings","revenue_eur","reach"],"items":["custom"],"report_sections":["overview"]}')
on conflict do nothing;


-- ========== migrations/20260620000021_phase6_niche_detail.sql ==========
-- =============================================================================
-- drea.mar — Phase 6 / Migration 21 — Niche detail tables
--
-- Real estate is the flagship niche and gets a true dedicated table
-- (`properties`). The other detailed niches' per-item lists (dishes, menu
-- campaigns, treatments, classes, rooms, vehicles, …) share a config-driven
-- `niche_items` table with an `item_type` discriminator + jsonb attributes —
-- so adding a niche or an item type needs no migration, matching the
-- niche_config registry.
--
-- Both are client-portal readable (the niche dashboards render in the portal),
-- agency-write.
-- =============================================================================

-- ----------------------------- properties -----------------------------------
create table public.properties (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references public.agencies(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,

  name                text not null,
  property_type       text,
  price               numeric(12, 2) check (price is null or price >= 0),
  area                text,
  views               bigint check (views is null or views >= 0),
  messages_generated  int check (messages_generated is null or messages_generated >= 0),
  viewings_booked     int check (viewings_booked is null or viewings_booked >= 0),
  offers_received     int check (offers_received is null or offers_received >= 0),
  cost_per_lead       numeric(10, 2) check (cost_per_lead is null or cost_per_lead >= 0),
  status              text not null default 'Available',
  sold                boolean not null default false,
  sold_at             date,

  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ----------------------------- niche_items ----------------------------------
create table public.niche_items (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  niche       niche not null,
  -- e.g. 'dish', 'menu_campaign', 'event', 'treatment', 'class',
  -- 'trainer_content', 'room_type', 'vehicle', 'sku', 'promo', 'night', 'dj'.
  item_type   text not null,
  name        text not null,
  -- Type-specific fields, shaped by niche_config, e.g.
  -- dish:      { "orders": 214, "trend": 22, "intent": "High" }
  -- treatment: { "leads": 38, "interest": 82, "conversion": "High" }
  -- class:     { "signups": 84, "fill": 92 }
  attributes  jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger trg_properties_lock before update on public.properties
  for each row execute function public.lock_agency_id();
create trigger trg_niche_items_updated_at before update on public.niche_items
  for each row execute function public.set_updated_at();
create trigger trg_niche_items_lock before update on public.niche_items
  for each row execute function public.lock_agency_id();

-- Shared client/agency consistency guard (reuse Phase-6 metrics asserter shape).
create or replace function public.assert_nichedetail_client_agency()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;
create trigger trg_properties_client_agency
  before insert or update on public.properties
  for each row execute function public.assert_nichedetail_client_agency();
create trigger trg_niche_items_client_agency
  before insert or update on public.niche_items
  for each row execute function public.assert_nichedetail_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.properties enable row level security;
alter table public.properties force row level security;

create policy "properties_select" on public.properties
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = properties.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );
create policy "properties_write" on public.properties
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

alter table public.niche_items enable row level security;
alter table public.niche_items force row level security;

create policy "niche_items_select" on public.niche_items
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = niche_items.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );
create policy "niche_items_write" on public.niche_items
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_properties_agency_client  on public.properties (agency_id, client_id);
create index idx_properties_status         on public.properties (agency_id, status);
create index idx_niche_items_client_type   on public.niche_items (agency_id, client_id, item_type, sort_order);
create index idx_niche_items_attrs         on public.niche_items using gin (attributes);


-- ========== migrations/20260620000022_phase7_rpcs.sql ==========
-- =============================================================================
-- drea.mar — Phase 7 / Migration 22 — RPCs the Edge Functions call
--
-- These SECURITY DEFINER functions encapsulate the privileged, atomic
-- operations the Edge Functions (Phase 7) need:
--   - create_agency_with_owner: a freshly-signed-up user provisions their
--     first agency + owner membership in one transaction (they have no INSERT
--     policy on agencies, so this controlled path is the only way in).
--   - claim_ai_job / complete_ai_job: the AI worker claims the oldest queued
--     job (FOR UPDATE SKIP LOCKED so many workers don't collide) and writes
--     the result + usage back.
-- =============================================================================

-- --------------------- create_agency_with_owner -----------------------------
-- Callable by any authenticated user; creates an agency OWNED BY THEM (the
-- owner is always auth.uid(), never a parameter — no privilege escalation).
create or replace function public.create_agency_with_owner(
  p_name text,
  p_slug text,
  p_city text default null
)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency public.agencies;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.agencies (name, slug, city, created_by)
  values (p_name, lower(p_slug), p_city, auth.uid())
  returning * into v_agency;

  -- usage_counters is created by the agency-insert trigger.
  insert into public.agency_members (agency_id, profile_id, role)
  values (v_agency.id, auth.uid(), 'agency_owner');

  return v_agency;
end;
$$;

revoke all on function public.create_agency_with_owner(text, text, text) from public;
grant execute on function public.create_agency_with_owner(text, text, text) to authenticated;

-- ----------------------------- claim_ai_job ---------------------------------
-- Atomically claim the oldest queued job. Returns NULL when the queue is
-- empty. SKIP LOCKED lets multiple worker invocations run concurrently
-- without grabbing the same job.
create or replace function public.claim_ai_job()
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ai_jobs;
begin
  update public.ai_jobs
     set status = 'running',
         started_at = now(),
         attempts = attempts + 1
   where id = (
     select id from public.ai_jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning * into v_job;

  return v_job;   -- NULL row if nothing was claimable
end;
$$;

revoke all on function public.claim_ai_job() from public;
grant execute on function public.claim_ai_job() to service_role;

-- --------------------------- complete_ai_job --------------------------------
-- Mark a claimed job done and, on success, log token usage (which the
-- ai_usage trigger rolls up into usage_counters).
create or replace function public.complete_ai_job(
  p_id                uuid,
  p_status            ai_job_status,
  p_output            jsonb default null,
  p_error             text default null,
  p_model             text default null,
  p_prompt_tokens     int default 0,
  p_completion_tokens int default 0,
  p_credits           int default 0,
  p_cost_eur          numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_type   ai_job_type;
begin
  update public.ai_jobs
     set status = p_status,
         output_ref = coalesce(p_output, output_ref),
         error = p_error,
         model = p_model,
         prompt_tokens = p_prompt_tokens,
         completion_tokens = p_completion_tokens,
         cost_eur = p_cost_eur,
         finished_at = now()
   where id = p_id
  returning agency_id, type into v_agency, v_type;

  if v_agency is null then
    raise exception 'unknown_job %', p_id;
  end if;

  if p_status = 'succeeded' then
    insert into public.ai_usage (agency_id, job_id, feature, model, prompt_tokens, completion_tokens, credits, cost_eur)
    values (v_agency, p_id, v_type, p_model, p_prompt_tokens, p_completion_tokens, p_credits, p_cost_eur);
  end if;
end;
$$;

revoke all on function public.complete_ai_job(uuid, ai_job_status, jsonb, text, text, int, int, int, numeric) from public;
grant execute on function public.complete_ai_job(uuid, ai_job_status, jsonb, text, text, int, int, int, numeric) to service_role;


-- ========== seed.sql ==========
-- =============================================================================
-- drea.mar — Seed
-- The ONLY seed: the 4 paid tiers. Everything else is created at runtime via
-- signup / Stripe / Edge Functions. We deliberately do NOT seed agencies,
-- clients, or any tenant data (the spec rule: "no random demo data").
-- =============================================================================

insert into public.plans (tier, name, tagline, price_eur_monthly, max_clients, max_team_members, features, display_order)
values
  (
    'starter', 'Starter Agency', 'For solo operators getting started',
    99, 5, 1,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true
    ),
    1
  ),
  (
    'growth', 'Growth Agency', 'For growing teams that need AI',
    150, 15, 3,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true
    ),
    2
  ),
  (
    'unlimited', 'Unlimited Agency', 'For scaling agencies',
    249, null, null,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true,
      'white_label_reports', true,
      'ai_strategy_room', true,
      'advanced_analytics', true,
      'competitor_watch', true
    ),
    3
  ),
  (
    'white_label_pro', 'White Label Pro', 'Your brand, your domain',
    399, null, null,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true,
      'white_label_reports', true,
      'ai_strategy_room', true,
      'advanced_analytics', true,
      'competitor_watch', true,
      'custom_branding', true,
      'custom_domain', true,
      'advanced_permissions', true,
      'premium_pdf', true
    ),
    4
  )
on conflict (tier) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  price_eur_monthly = excluded.price_eur_monthly,
  max_clients = excluded.max_clients,
  max_team_members = excluded.max_team_members,
  features = excluded.features,
  display_order = excluded.display_order;
