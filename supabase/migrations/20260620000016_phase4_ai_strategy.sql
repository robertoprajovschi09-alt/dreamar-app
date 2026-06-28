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
