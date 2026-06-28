-- =============================================================================
-- drea.mar — Phase 5 / Migration 19 — Storage bucket + object RLS
--
-- The 'documents' bucket holds the actual file bytes. Object access is gated
-- by the path convention:
--   {agency_id}/{client_id}/{file}   — a client document
--   {agency_id}/_agency/{file}       — an agency-wide document
--
-- Object RLS parses the first path segment as the agency and the second as
-- the client, then applies the same tenant rules as the documents table:
--   - agency members: any object in their agency
--   - client viewers: only their own client's folder
-- =============================================================================

-- The private bucket. In a real project this can also be created from the
-- dashboard; doing it in SQL keeps the migration self-contained.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Path-segment helpers (readability for the policies below).
create or replace function public.storage_agency_seg(p_name text)
returns text language sql immutable as $$
  select (storage.foldername(p_name))[1];
$$;

create or replace function public.storage_client_seg(p_name text)
returns text language sql immutable as $$
  select (storage.foldername(p_name))[2];
$$;

-- In real Supabase RLS is already enabled on storage.objects; this is a no-op
-- there and a necessity in the local shim.
alter table storage.objects enable row level security;

-- SELECT: agency members of the path's agency, OR the client viewer whose
-- (agency, client) match the path's first two segments.
create policy "documents_objects_select" on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and (
      public.storage_agency_seg(name) in (
        select agency_id::text from public.agency_members where profile_id = auth.uid()
      )
      or exists (
        select 1 from public.client_users cu
        where cu.profile_id = auth.uid()
          and public.storage_agency_seg(name) = cu.agency_id::text
          and public.storage_client_seg(name) = cu.client_id::text
      )
      or public.is_saas_admin()
    )
  );

-- INSERT: agency members anywhere in their agency; client viewers only into
-- their own client's folder.
create policy "documents_objects_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and (
      public.storage_agency_seg(name) in (
        select agency_id::text from public.agency_members where profile_id = auth.uid()
      )
      or exists (
        select 1 from public.client_users cu
        where cu.profile_id = auth.uid()
          and public.storage_agency_seg(name) = cu.agency_id::text
          and public.storage_client_seg(name) = cu.client_id::text
      )
    )
  );

-- UPDATE / DELETE: agency members only (clients upload but don't mutate/delete).
create policy "documents_objects_update" on storage.objects
  for update
  using (
    bucket_id = 'documents'
    and public.storage_agency_seg(name) in (
      select agency_id::text from public.agency_members where profile_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'documents'
    and public.storage_agency_seg(name) in (
      select agency_id::text from public.agency_members where profile_id = auth.uid()
    )
  );

create policy "documents_objects_delete" on storage.objects
  for delete
  using (
    bucket_id = 'documents'
    and public.storage_agency_seg(name) in (
      select agency_id::text from public.agency_members where profile_id = auth.uid()
    )
  );
