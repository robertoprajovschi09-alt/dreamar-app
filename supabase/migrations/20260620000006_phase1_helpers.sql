-- =============================================================================
-- drea.mar — Phase 1 / Migration 6
-- Phase-1 helpers. Just one: agency_has_feature(), which lets later schemas
-- enforce plan-gated features at the database layer.
-- =============================================================================

-- Returns true iff the agency's current plan has the named feature flag.
-- Used by feature-gate triggers (e.g. only Growth+ may create approvals).
create or replace function public.agency_has_feature(p_agency uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (p.features ->> p_feature)::boolean
       from public.agencies a
       join public.plans p on p.tier = a.current_plan_tier
      where a.id = p_agency),
    false
  );
$$;
