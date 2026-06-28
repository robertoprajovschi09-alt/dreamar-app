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
