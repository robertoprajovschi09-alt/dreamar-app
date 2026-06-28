-- =============================================================================
-- drea.mar — Phase 5 / Migration 18 — Document Library (metadata)
--
-- Folders (nestable), documents (metadata + storage path), and document_ai
-- (AI summary + extracted brief fields). The bytes live in Supabase Storage;
-- these tables hold metadata and drive the UI. Storage bucket + object RLS
-- come in migration 19.
--
-- Folders + AI summaries are agency-internal. Documents are client-portal
-- aware: a Client Viewer can see and UPLOAD their own client's documents.
-- =============================================================================

create type doc_ai_status as enum ('pending', 'processing', 'ready', 'failed');

-- ------------------------------- folders ------------------------------------
create table public.folders (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: agency-wide folder vs client-specific.
  client_id   uuid references public.clients(id) on delete cascade,
  parent_id   uuid references public.folders(id) on delete cascade,
  name        text not null check (length(name) > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------ documents -----------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  -- Nullable: agency brand assets vs client-specific docs.
  client_id     uuid references public.clients(id) on delete cascade,
  folder_id     uuid references public.folders(id) on delete set null,

  -- The Supabase Storage object path (bucket = 'documents'). Convention:
  --   {agency_id}/{client_id}/{uuid-filename}     (client doc)
  --   {agency_id}/_agency/{uuid-filename}         (agency-wide doc)
  storage_path  text not null unique,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  tags          text[] not null default '{}'::text[],

  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------- document_ai ----------------------------------
create table public.document_ai (
  id              uuid primary key default gen_random_uuid(),
  agency_id       uuid not null references public.agencies(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade unique,
  status          doc_ai_status not null default 'pending',
  summary         text,
  -- Extracted brief fields, e.g. { "Objective": "...", "Budget": "..." }.
  extracted_fields jsonb not null default '{}'::jsonb,
  model           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ------------------------------- triggers ----------------------------------
create trigger trg_folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();
create trigger trg_folders_lock_agency before update on public.folders
  for each row execute function public.lock_agency_id();
create trigger trg_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger trg_documents_lock_agency before update on public.documents
  for each row execute function public.lock_agency_id();
create trigger trg_document_ai_updated_at before update on public.document_ai
  for each row execute function public.set_updated_at();
create trigger trg_document_ai_lock_agency before update on public.document_ai
  for each row execute function public.lock_agency_id();

-- Client consistency for client-scoped folders/documents.
create or replace function public.assert_doc_client_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_agency uuid;
begin
  if new.client_id is null then
    return new;
  end if;
  select agency_id into v_agency from public.clients where id = new.client_id;
  if v_agency is null or v_agency <> new.agency_id then
    raise exception 'client % is not in agency %', new.client_id, new.agency_id;
  end if;
  return new;
end;
$$;

create trigger trg_folders_client_agency
  before insert or update on public.folders
  for each row execute function public.assert_doc_client_agency();
create trigger trg_documents_client_agency
  before insert or update on public.documents
  for each row execute function public.assert_doc_client_agency();

-- -------------------------------- RLS ---------------------------------------
-- Folders: agency-internal organization. No Client Viewer access.
alter table public.folders enable row level security;
alter table public.folders force row level security;

create policy "folders_select" on public.folders
  for select using (public.is_member_of(agency_id));
create policy "folders_write" on public.folders
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

-- Documents: agency members see all; Client Viewers see + upload their own
-- client's docs.
alter table public.documents enable row level security;
alter table public.documents force row level security;

create policy "documents_select" on public.documents
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or (
      client_id is not null
      and exists (
        select 1 from public.client_users cu
        where cu.client_id = documents.client_id and cu.profile_id = auth.uid()
      )
    )
    or public.is_saas_admin()
  );

-- Agency members: full write.
create policy "documents_write_by_agency" on public.documents
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- Client Viewers: upload to their own client only.
create policy "documents_insert_by_client" on public.documents
  for insert
  with check (
    client_id is not null
    and exists (
      select 1 from public.client_users cu
      where cu.client_id = documents.client_id and cu.profile_id = auth.uid()
    )
  );

-- document_ai: agency-internal (AI analysis is the agency's).
alter table public.document_ai enable row level security;
alter table public.document_ai force row level security;

create policy "document_ai_select" on public.document_ai
  for select using (public.is_member_of(agency_id));
create policy "document_ai_write" on public.document_ai
  for all using (public.is_member_of(agency_id)) with check (public.is_member_of(agency_id));

-- ------------------------------- indexes ------------------------------------
create index idx_folders_agency_client       on public.folders (agency_id, client_id);
create index idx_folders_parent              on public.folders (parent_id) where parent_id is not null;
create index idx_documents_agency_client     on public.documents (agency_id, client_id);
create index idx_documents_folder            on public.documents (folder_id) where folder_id is not null;
create index idx_documents_tags              on public.documents using gin (tags);
create index idx_documents_filename_trgm     on public.documents using gin (filename gin_trgm_ops);
create index idx_document_ai_status          on public.document_ai (agency_id, status);
