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
