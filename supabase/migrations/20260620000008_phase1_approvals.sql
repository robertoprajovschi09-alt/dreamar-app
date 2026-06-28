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
