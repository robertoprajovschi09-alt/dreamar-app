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
