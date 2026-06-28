-- =============================================================================
-- drea.mar — Phase 1 / Migration 7 — Content Calendar
--
-- Two tables, both tenant-scoped:
--   content_posts            — every post the agency plans/produces/publishes
--   content_post_attachments — files attached to a post (briefs, raw video)
--
-- Statuses match the front-end pipeline exactly. approval_status on
-- content_posts is a denormalized cache of the latest approvals row for
-- the post; maintained by a trigger in migration 8 so calendar queries
-- don't have to join.
-- =============================================================================

create type post_status as enum (
  'idea',
  'script',
  'filming',
  'editing',
  'sent_for_approval',
  'approved',
  'scheduled',
  'published',
  'analyzed'
);

-- Mirrors the spec's approval statuses. Used both on content_posts and on
-- the approvals table (added in migration 8).
create type approval_status as enum (
  'pending',
  'approved',
  'approved_with_changes',
  'rejected',
  'withdrawn'
);

-- ----------------------------- content_posts --------------------------------
create table public.content_posts (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,

  title             text not null,
  -- The script body. Stored as plain text; version history lives in the
  -- attachments table if a team wants snapshots before each edit.
  script            text,
  script_version    int not null default 1,
  body_angle        text,
  cta               text,
  hook              text,
  format            text,
  platform          platform,
  objective         text,
  notes             text,

  scheduled_date    date,
  published_date    date,
  status            post_status not null default 'idea',
  -- null = never sent for approval. Maintained by a trigger on approvals.
  approval_status   approval_status,

  assigned_to       uuid references public.profiles(id) on delete set null,
  deadline          timestamptz,

  -- Will link to videos.id in Phase 2. Nullable; soft FK so we can add the
  -- proper reference once that table exists.
  video_id          uuid,

  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A post's client must belong to the same agency as the post itself —
  -- the schema-level check that pairs with the agency_id immutability
  -- trigger below.
  constraint content_posts_client_in_agency
    check (client_id is not null and agency_id is not null)
);

-- ------------------------- content_post_attachments -------------------------
create table public.content_post_attachments (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  post_id       uuid not null references public.content_posts(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes >= 0),
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_content_posts_updated_at before update on public.content_posts
  for each row execute function public.set_updated_at();
create trigger trg_content_posts_lock_agency before update on public.content_posts
  for each row execute function public.lock_agency_id();
create trigger trg_post_attachments_lock_agency before update on public.content_post_attachments
  for each row execute function public.lock_agency_id();

-- Belt-and-suspenders: the post's client_id must live in the same agency.
-- The RLS policy lets agency members reference any client in their agency,
-- but this trigger blocks a post-INSERT that pairs an agency with a client
-- from a different agency (otherwise possible if an admin script forged
-- both columns).
create or replace function public.assert_post_client_agency()
returns trigger
language plpgsql
as $$
declare
  v_client_agency uuid;
begin
  select agency_id into v_client_agency from public.clients where id = new.client_id;
  if v_client_agency is null then
    raise exception 'unknown client %', new.client_id;
  end if;
  if v_client_agency <> new.agency_id then
    raise exception 'client % belongs to agency %, not %', new.client_id, v_client_agency, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_content_posts_client_agency
  before insert or update on public.content_posts
  for each row execute function public.assert_post_client_agency();

-- -------------------------------- RLS ---------------------------------------
alter table public.content_posts enable row level security;
alter table public.content_posts force row level security;

-- Agency members see everything. Client Viewers see only posts for the
-- client they're scoped to.
create policy "content_posts_select" on public.content_posts
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = content_posts.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members create/edit/delete posts. Client Viewers approve, but
-- do not author.
create policy "content_posts_insert" on public.content_posts
  for insert
  with check (public.is_member_of(agency_id));

create policy "content_posts_update" on public.content_posts
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "content_posts_delete" on public.content_posts
  for delete
  using (public.is_member_of(agency_id));

-- Attachments inherit from the parent post.
alter table public.content_post_attachments enable row level security;
alter table public.content_post_attachments force row level security;

create policy "post_attachments_select" on public.content_post_attachments
  for select
  using (
    exists (
      select 1 from public.content_posts p
      where p.id = content_post_attachments.post_id
        and (
          p.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
          or exists (
            select 1 from public.client_users cu
            where cu.client_id = p.client_id and cu.profile_id = auth.uid()
          )
          or public.is_saas_admin()
        )
    )
  );

create policy "post_attachments_write" on public.content_post_attachments
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- The calendar's hottest queries:
--   "show all posts for this client across the month"
--   "what's scheduled this week across all clients"
--   "what's pending approval"
create index idx_content_posts_agency_client_date
  on public.content_posts (agency_id, client_id, scheduled_date);
create index idx_content_posts_agency_status
  on public.content_posts (agency_id, status);
create index idx_content_posts_agency_assigned
  on public.content_posts (agency_id, assigned_to)
  where assigned_to is not null;
create index idx_content_posts_published
  on public.content_posts (agency_id, published_date desc)
  where published_date is not null;
create index idx_post_attachments_post on public.content_post_attachments (agency_id, post_id);
