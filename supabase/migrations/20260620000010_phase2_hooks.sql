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
