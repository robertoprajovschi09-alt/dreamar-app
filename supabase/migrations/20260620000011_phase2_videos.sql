-- =============================================================================
-- drea.mar — Phase 2 / Migration 11 — Video Performance Tracker
--
-- One row per video, every metric field from the spec, all nullable and
-- editable (Manual Analytics Input = editing these directly; no demo data).
-- Links optionally to a calendar post and a library hook. AI columns
-- (ai_score, ai_insight, recommendation) are written by the Phase-4 jobs but
-- are plain editable columns too.
--
-- Client Viewers can SEE their client's videos (portal "video performance"),
-- but cannot create/edit them.
-- =============================================================================

create type video_recommendation as enum ('repeat', 'improve', 'stop');

create table public.videos (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies(id) on delete cascade,
  client_id             uuid not null references public.clients(id) on delete cascade,
  -- Optional links. Calendar post that produced it; library hook it used.
  post_id               uuid references public.content_posts(id) on delete set null,
  hook_id               uuid references public.hooks(id) on delete set null,

  -- Creative / descriptive
  platform              platform,
  publish_date          date,
  video_link            text,
  hook                  text,             -- the actual hook line used
  body_angle            text,
  cta                   text,
  video_format          text,
  duration_seconds      int check (duration_seconds is null or duration_seconds >= 0),
  objective             text,

  -- Reach / retention
  views                 bigint check (views is null or views >= 0),
  reach                 bigint check (reach is null or reach >= 0),
  watch_time_seconds    int check (watch_time_seconds is null or watch_time_seconds >= 0),
  retention_3s_pct      numeric(5, 2) check (retention_3s_pct is null or retention_3s_pct between 0 and 100),
  retention_50_pct      numeric(5, 2) check (retention_50_pct is null or retention_50_pct between 0 and 100),
  completion_rate_pct   numeric(5, 2) check (completion_rate_pct is null or completion_rate_pct between 0 and 100),

  -- Engagement
  likes                 bigint check (likes is null or likes >= 0),
  comments              bigint check (comments is null or comments >= 0),
  shares                bigint check (shares is null or shares >= 0),
  saves                 bigint check (saves is null or saves >= 0),
  dms                   int check (dms is null or dms >= 0),
  calls                 int check (calls is null or calls >= 0),

  -- Business impact
  estimated_sales_impact text,            -- free text, e.g. "~€430k pipeline"
  estimated_revenue      numeric(12, 2),  -- structured value when known

  -- Feedback + AI
  client_feedback       text,
  ai_score              int check (ai_score is null or ai_score between 0 and 100),
  ai_insight            text,
  recommendation        video_recommendation,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Now that videos exists, wire the calendar's soft video_id into a real FK.
alter table public.content_posts
  add constraint content_posts_video_fk
  foreign key (video_id) references public.videos(id) on delete set null;

-- ------------------------------- triggers ----------------------------------
create trigger trg_videos_updated_at before update on public.videos
  for each row execute function public.set_updated_at();
create trigger trg_videos_lock_agency before update on public.videos
  for each row execute function public.lock_agency_id();

-- Consistency: a video's client, its post, and its hook must all live in the
-- video's agency (defence-in-depth beyond RLS).
create or replace function public.assert_video_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  -- client
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'video client % is not in agency %', new.client_id, new.agency_id;
  end if;
  -- post (optional)
  if new.post_id is not null then
    select agency_id into v_agency from public.content_posts where id = new.post_id;
    if v_agency <> new.agency_id then
      raise exception 'video post % is not in agency %', new.post_id, new.agency_id;
    end if;
  end if;
  -- hook (optional)
  if new.hook_id is not null then
    select agency_id into v_agency from public.hooks where id = new.hook_id;
    if v_agency <> new.agency_id then
      raise exception 'video hook % is not in agency %', new.hook_id, new.agency_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_videos_assert_refs
  before insert or update on public.videos
  for each row execute function public.assert_video_refs();

-- Recompute a hook's aggregate stats (uses + avg_ai_score) from its linked
-- videos. Called by the trigger below on any change to videos.hook_id or
-- videos.ai_score.
create or replace function public.recompute_hook_stats(p_hook uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_hook is null then return; end if;
  update public.hooks h
     set uses = sub.cnt,
         avg_ai_score = sub.avg_score,
         updated_at = now()
    from (
      select count(*) as cnt, avg(ai_score)::numeric(5,2) as avg_score
        from public.videos
       where hook_id = p_hook
    ) sub
   where h.id = p_hook;
end;
$$;

create or replace function public.on_video_change_update_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recompute_hook_stats(new.hook_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_hook_stats(old.hook_id);
  elsif tg_op = 'UPDATE' then
    -- Recompute both old and new hook if the link or score changed.
    if new.hook_id is distinct from old.hook_id then
      perform public.recompute_hook_stats(old.hook_id);
      perform public.recompute_hook_stats(new.hook_id);
    elsif new.ai_score is distinct from old.ai_score then
      perform public.recompute_hook_stats(new.hook_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_videos_maintain_hook_stats
  after insert or delete or update of hook_id, ai_score on public.videos
  for each row execute function public.on_video_change_update_hook();

-- -------------------------------- RLS ---------------------------------------
alter table public.videos enable row level security;
alter table public.videos force row level security;

-- Agency members see all their videos. Client Viewers see only their
-- client's videos (the portal video-performance view).
create policy "videos_select" on public.videos
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = videos.client_id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members create/edit/delete videos (Client Viewers are read-only).
create policy "videos_insert" on public.videos
  for insert
  with check (public.is_member_of(agency_id));

create policy "videos_update" on public.videos
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "videos_delete" on public.videos
  for delete
  using (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
-- Hot queries: per-client list, top performers (ai_score / views), by
-- recommendation, by publish date, and the post/hook backlinks.
create index idx_videos_agency_client        on public.videos (agency_id, client_id);
create index idx_videos_agency_score         on public.videos (agency_id, ai_score desc nulls last);
create index idx_videos_agency_views         on public.videos (agency_id, views desc nulls last);
create index idx_videos_agency_recommend     on public.videos (agency_id, recommendation) where recommendation is not null;
create index idx_videos_publish_date         on public.videos (agency_id, publish_date desc) where publish_date is not null;
create index idx_videos_post                 on public.videos (post_id) where post_id is not null;
create index idx_videos_hook                 on public.videos (hook_id) where hook_id is not null;
