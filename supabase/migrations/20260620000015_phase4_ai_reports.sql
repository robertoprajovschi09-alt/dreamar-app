-- =============================================================================
-- drea.mar — Phase 4 / Migration 15 — AI Monthly Reports
--
-- One report per client per month. The 13 spec sections live in an editable
-- `sections` jsonb (so the front-end's add/remove/reorder/edit maps 1:1).
-- Edit history is snapshotted into ai_report_versions.
--
-- Gated by the `ai_reports` feature flag (Growth and up).
--
-- Client portal: a Client Viewer can view their client's reports, but ONLY
-- once they're 'sent' or 'approved' — never drafts in progress.
-- =============================================================================

create type report_status as enum ('draft', 'generating', 'ready', 'sent', 'approved', 'failed');

-- The 13-section skeleton a new report starts with, in spec order.
create or replace function public.default_report_sections()
returns jsonb
language sql
immutable
as $$
  select jsonb_agg(
           jsonb_build_object('key', k, 'title', t, 'body', '', 'ready', false, 'order', ord)
           order by ord
         )
  from (values
    ('executive_summary',        'Executive Summary',          1),
    ('work_completed',           'Work Completed',             2),
    ('best_performing_content',  'Best-Performing Content',    3),
    ('worst_performing_content', 'Worst-Performing Content',   4),
    ('platform_growth',          'Platform Growth',            5),
    ('hook_analysis',            'Hook Analysis',              6),
    ('content_format_analysis',  'Content Format Analysis',    7),
    ('business_impact',          'Business Impact',            8),
    ('client_feedback',          'Client Feedback',            9),
    ('problems_noticed',         'Problems Noticed',          10),
    ('next_month_strategy',      'Next-Month Strategy',       11),
    ('recommended_content_plan', 'Recommended Content Plan',  12),
    ('final_agency_conclusion',  'Final Agency Conclusion',   13)
  ) as s(k, t, ord);
$$;

-- ------------------------------ ai_reports ----------------------------------
create table public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  period_month  date not null,

  title         text not null default 'Monthly Performance Report',
  status        report_status not null default 'draft',
  -- Editable block model: [{ key, title, body, ready, order }, …]
  sections      jsonb not null default public.default_report_sections(),

  white_label   boolean not null default false,
  pdf_path      text,           -- storage path once exported

  -- AI provenance (written by the generation job).
  model         text,
  prompt_tokens int,
  completion_tokens int,

  generated_at  timestamptz,
  sent_at       timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (client_id, period_month)
);

-- -------------------------- ai_report_versions ------------------------------
create table public.ai_report_versions (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  report_id   uuid not null references public.ai_reports(id) on delete cascade,
  version     int not null,
  sections    jsonb not null,
  edited_by   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (report_id, version)
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_ai_reports_updated_at before update on public.ai_reports
  for each row execute function public.set_updated_at();
create trigger trg_ai_reports_lock_agency before update on public.ai_reports
  for each row execute function public.lock_agency_id();
create trigger trg_ai_report_versions_lock before update on public.ai_report_versions
  for each row execute function public.lock_agency_id();

create or replace function public.assert_report_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_agency uuid;
begin
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'report client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_client_agency
  before insert or update on public.ai_reports
  for each row execute function public.assert_report_client_agency();

-- Feature gate: only agencies whose plan includes `ai_reports` may create them.
create or replace function public.enforce_ai_reports_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_feature(new.agency_id, 'ai_reports') then
    raise exception 'plan_feature_required: ai_reports is not included in this plan'
      using errcode = 'P0001', hint = 'upgrade_plan';
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_feature_gate
  before insert on public.ai_reports
  for each row execute function public.enforce_ai_reports_feature();

-- Stamp sent_at when a report is first sent.
create or replace function public.stamp_report_sent()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'sent' and (old.status is distinct from 'sent') then
    new.sent_at := coalesce(new.sent_at, now());
  end if;
  return new;
end;
$$;

create trigger trg_ai_reports_stamp_sent
  before update of status on public.ai_reports
  for each row execute function public.stamp_report_sent();

-- -------------------------------- RLS ---------------------------------------
alter table public.ai_reports enable row level security;
alter table public.ai_reports force row level security;

create policy "ai_reports_select" on public.ai_reports
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or (
      status in ('sent', 'approved')
      and exists (
        select 1 from public.client_users cu
        where cu.client_id = ai_reports.client_id and cu.profile_id = auth.uid()
      )
    )
    or public.is_saas_admin()
  );

create policy "ai_reports_insert" on public.ai_reports
  for insert
  with check (public.is_member_of(agency_id));

create policy "ai_reports_update" on public.ai_reports
  for update
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

create policy "ai_reports_delete" on public.ai_reports
  for delete
  using (public.is_member_of(agency_id));

-- Versions are agency-internal edit history.
alter table public.ai_report_versions enable row level security;
alter table public.ai_report_versions force row level security;

create policy "ai_report_versions_select" on public.ai_report_versions
  for select using (public.is_member_of(agency_id));
create policy "ai_report_versions_insert" on public.ai_report_versions
  for insert with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_ai_reports_agency_client_month
  on public.ai_reports (agency_id, client_id, period_month desc);
create index idx_ai_reports_agency_status
  on public.ai_reports (agency_id, status);
create index idx_ai_reports_due
  on public.ai_reports (agency_id, period_month)
  where status in ('draft', 'generating');
create index idx_ai_report_versions_report
  on public.ai_report_versions (agency_id, report_id, version desc);
