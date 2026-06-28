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
