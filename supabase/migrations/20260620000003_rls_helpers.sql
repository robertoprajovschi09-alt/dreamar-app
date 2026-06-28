-- =============================================================================
-- drea.mar — Phase 0 / Migration 3
-- RLS helper functions. Every tenant-table policy in migration 4 is a thin
-- composition of these.
--
-- Three rules every helper obeys:
--   1. STABLE — same answer within a query, lets the planner inline/cache it.
--   2. SECURITY DEFINER + locked search_path — so users can't shadow our
--      tables with their own and trick the helper into returning the wrong
--      result.
--   3. Returns SETOF / boolean only — never leaks rows.
-- =============================================================================

-- ---------------------------- is_saas_admin ---------------------------------
-- True iff the current user has the SaaS-admin flag on their profile.
-- Used by SaaS Admin Panel queries and by every other RLS policy as a
-- cross-tenant escape hatch.
create or replace function public.is_saas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_saas_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- --------------------------- current_agency_ids -----------------------------
-- The set of agency IDs the current user can access. Used as `IN (select * …)`
-- in every tenant table's SELECT/UPDATE/DELETE policy.
--
-- For SaaS admins this expands to all agencies, giving them cross-tenant read
-- (their write access is gated separately on each table).
create or replace function public.current_agency_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select agency_id
    from public.agency_members
    where profile_id = auth.uid()
  union
  select agency_id
    from public.client_users
    where profile_id = auth.uid()
  union
  select id
    from public.agencies
    where public.is_saas_admin();
$$;

-- ------------------------------ is_member_of --------------------------------
-- True iff the current user has an agency_members row in p_agency. Distinct
-- from current_agency_ids in that it EXCLUDES the client_users path — used
-- for "agency staff only" actions (a Client Viewer is in the agency but not
-- agency staff).
create or replace function public.is_member_of(p_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = p_agency and profile_id = auth.uid()
  ) or public.is_saas_admin();
$$;

-- -------------------------------- is_owner ----------------------------------
-- True iff the current user is an agency_owner of p_agency. Used to gate
-- destructive / administrative actions (delete client, change plan, invite).
create or replace function public.is_owner_of(p_agency uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agency_members
    where agency_id = p_agency
      and profile_id = auth.uid()
      and role = 'agency_owner'
  ) or public.is_saas_admin();
$$;

-- ---------------------------- has_client_access -----------------------------
-- True iff the current user can see a specific client. Two paths:
--   1. They're an agency member of the client's agency.
--   2. They're explicitly linked to this client via client_users
--      (the Client Viewer portal role).
-- Plus the SaaS-admin escape hatch.
create or replace function public.has_client_access(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_saas_admin() or exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and (
        c.agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
        or exists (
          select 1 from public.client_users cu
          where cu.client_id = c.id and cu.profile_id = auth.uid()
        )
      )
  );
$$;
