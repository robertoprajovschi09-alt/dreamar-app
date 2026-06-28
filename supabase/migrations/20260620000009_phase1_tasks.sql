-- =============================================================================
-- drea.mar — Phase 1 / Migration 9 — Task Management
--
-- Tasks, plus first-class comments and attachments. Tasks can optionally tie
-- to a client and to a content_posts row (so "edit the property tour" can
-- link straight to the calendar entry).
-- =============================================================================

create type task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'archived');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_type as enum (
  'planning', 'scripting', 'filming', 'editing', 'design',
  'reporting', 'approval', 'meeting', 'other'
);

-- --------------------------------- tasks ------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: not every task ties to a client (e.g. internal ops).
  client_id     uuid references public.clients(id) on delete cascade,
  -- Optional link to a calendar post (the "task spawned from a post" flow).
  post_id       uuid references public.content_posts(id) on delete set null,

  title         text not null,
  description   text,
  task_type     task_type not null default 'other',
  priority      task_priority not null default 'medium',
  status        task_status not null default 'todo',

  assigned_to   uuid references public.profiles(id) on delete set null,
  deadline      timestamptz,

  created_by    uuid references public.profiles(id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------- task_comments --------------------------------
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null check (length(body) > 0),
  created_at  timestamptz not null default now()
);

-- --------------------------- task_attachments -------------------------------
create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_tasks_lock_agency before update on public.tasks
  for each row execute function public.lock_agency_id();
create trigger trg_task_comments_lock_agency before update on public.task_comments
  for each row execute function public.lock_agency_id();
create trigger trg_task_attachments_lock_agency before update on public.task_attachments
  for each row execute function public.lock_agency_id();

-- When status transitions to/from 'done', stamp/unstamp completed_at.
create or replace function public.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_tasks_stamp_completion
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completion();

-- -------------------------------- RLS ---------------------------------------
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

-- Tasks are purely internal — Client Viewers never see them. Agency
-- members and the SaaS admin only.
create policy "tasks_select" on public.tasks
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or public.is_saas_admin()
  );

create policy "tasks_insert" on public.tasks
  for insert
  with check (public.is_member_of(agency_id));

create policy "tasks_update" on public.tasks
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "tasks_delete" on public.tasks
  for delete
  using (public.is_member_of(agency_id));

-- Comments: visible to anyone who can see the task; writable by agency
-- members (so a Content Creator can leave notes).
alter table public.task_comments enable row level security;
alter table public.task_comments force row level security;

create policy "task_comments_select" on public.task_comments
  for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and (
          t.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or public.is_saas_admin()
        )
    )
  );

create policy "task_comments_insert" on public.task_comments
  for insert
  with check (public.is_member_of(agency_id));

-- A comment author can edit/delete their own; owners can prune.
create policy "task_comments_update_own" on public.task_comments
  for update
  using (author_id = auth.uid() or public.is_owner_of(agency_id))
  with check (author_id = auth.uid() or public.is_owner_of(agency_id));

create policy "task_comments_delete_own" on public.task_comments
  for delete
  using (author_id = auth.uid() or public.is_owner_of(agency_id));

-- Attachments inherit from the task.
alter table public.task_attachments enable row level security;
alter table public.task_attachments force row level security;

create policy "task_attachments_select" on public.task_attachments
  for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (
          t.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or public.is_saas_admin()
        )
    )
  );

create policy "task_attachments_write" on public.task_attachments
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- Kanban board (status), my-tasks (assigned_to), overdue (deadline + status),
-- and per-client list.
create index idx_tasks_agency_status        on public.tasks (agency_id, status);
create index idx_tasks_agency_assigned      on public.tasks (agency_id, assigned_to) where assigned_to is not null;
create index idx_tasks_agency_client        on public.tasks (agency_id, client_id) where client_id is not null;
create index idx_tasks_overdue
  on public.tasks (agency_id, deadline)
  where status not in ('done', 'archived') and deadline is not null;
create index idx_tasks_post                 on public.tasks (post_id) where post_id is not null;
create index idx_task_comments_task         on public.task_comments (agency_id, task_id, created_at);
create index idx_task_attachments_task      on public.task_attachments (agency_id, task_id);
