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
