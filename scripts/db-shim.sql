-- PRE-MIGRATION shim. Stands up the bits of Supabase Auth + the
-- authenticated/anon roles our migrations + RLS policies expect.
--
-- A separate post-migration shim (db-shim-post.sql) grants table privileges
-- once the migrations have created the tables.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text not null,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Mirror Supabase PostgREST's two anonymous-side roles. Neither bypasses RLS.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase's service role bypasses RLS (used by Edge Functions / workers).
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin nobypassrls;
  end if;
end $$;

-- Minimal Supabase Storage shim: just enough of storage.objects + the
-- path-helper functions for our bucket RLS policies (migration 19) to apply
-- and be testable. Real Supabase provides a much richer storage schema.
create schema if not exists storage;

create table if not exists storage.buckets (
  id      text primary key,
  name    text not null,
  public  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets(id),
  name        text not null,                 -- the object path
  owner       uuid,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Supabase's path helpers. foldername returns the path segments excluding the
-- filename; filename returns the last segment.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant usage on schema storage to anon, authenticated;
