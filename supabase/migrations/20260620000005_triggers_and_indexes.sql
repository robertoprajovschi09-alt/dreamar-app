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
