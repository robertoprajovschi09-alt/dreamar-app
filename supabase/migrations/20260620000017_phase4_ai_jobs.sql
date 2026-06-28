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
