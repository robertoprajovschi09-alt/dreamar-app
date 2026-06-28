-- POST-MIGRATION shim. Grants on the tables migrations just created so the
-- `authenticated` and `anon` roles can hit them (RLS still decides what they
-- actually see).

grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

-- Storage: the authenticated role operates on storage.objects (RLS decides
-- which objects); execute on the path helpers.
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to anon, authenticated;
grant execute on all functions in schema storage to anon, authenticated;

-- Anonymous-only read on plans (per the plans_public_read RLS policy).
grant select on public.plans to anon;

-- Future tables (when later phases add modules) will inherit these.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;

-- Test helpers (depend on auth schema being present).
create or replace function test_set_user(p_user uuid)
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  set role authenticated;
end;
$$;

create or replace function test_set_anon()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  set role anon;
end;
$$;

create or replace function test_clear_user()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;
