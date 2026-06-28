-- =============================================================================
-- drea.mar — Phase 7 / Migration 22 — RPCs the Edge Functions call
--
-- These SECURITY DEFINER functions encapsulate the privileged, atomic
-- operations the Edge Functions (Phase 7) need:
--   - create_agency_with_owner: a freshly-signed-up user provisions their
--     first agency + owner membership in one transaction (they have no INSERT
--     policy on agencies, so this controlled path is the only way in).
--   - claim_ai_job / complete_ai_job: the AI worker claims the oldest queued
--     job (FOR UPDATE SKIP LOCKED so many workers don't collide) and writes
--     the result + usage back.
-- =============================================================================

-- --------------------- create_agency_with_owner -----------------------------
-- Callable by any authenticated user; creates an agency OWNED BY THEM (the
-- owner is always auth.uid(), never a parameter — no privilege escalation).
create or replace function public.create_agency_with_owner(
  p_name text,
  p_slug text,
  p_city text default null
)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency public.agencies;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.agencies (name, slug, city, created_by)
  values (p_name, lower(p_slug), p_city, auth.uid())
  returning * into v_agency;

  -- usage_counters is created by the agency-insert trigger.
  insert into public.agency_members (agency_id, profile_id, role)
  values (v_agency.id, auth.uid(), 'agency_owner');

  return v_agency;
end;
$$;

revoke all on function public.create_agency_with_owner(text, text, text) from public;
grant execute on function public.create_agency_with_owner(text, text, text) to authenticated;

-- ----------------------------- claim_ai_job ---------------------------------
-- Atomically claim the oldest queued job. Returns NULL when the queue is
-- empty. SKIP LOCKED lets multiple worker invocations run concurrently
-- without grabbing the same job.
create or replace function public.claim_ai_job()
returns public.ai_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.ai_jobs;
begin
  update public.ai_jobs
     set status = 'running',
         started_at = now(),
         attempts = attempts + 1
   where id = (
     select id from public.ai_jobs
      where status = 'queued'
      order by created_at
      for update skip locked
      limit 1
   )
  returning * into v_job;

  return v_job;   -- NULL row if nothing was claimable
end;
$$;

revoke all on function public.claim_ai_job() from public;
grant execute on function public.claim_ai_job() to service_role;

-- --------------------------- complete_ai_job --------------------------------
-- Mark a claimed job done and, on success, log token usage (which the
-- ai_usage trigger rolls up into usage_counters).
create or replace function public.complete_ai_job(
  p_id                uuid,
  p_status            ai_job_status,
  p_output            jsonb default null,
  p_error             text default null,
  p_model             text default null,
  p_prompt_tokens     int default 0,
  p_completion_tokens int default 0,
  p_credits           int default 0,
  p_cost_eur          numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_type   ai_job_type;
begin
  update public.ai_jobs
     set status = p_status,
         output_ref = coalesce(p_output, output_ref),
         error = p_error,
         model = p_model,
         prompt_tokens = p_prompt_tokens,
         completion_tokens = p_completion_tokens,
         cost_eur = p_cost_eur,
         finished_at = now()
   where id = p_id
  returning agency_id, type into v_agency, v_type;

  if v_agency is null then
    raise exception 'unknown_job %', p_id;
  end if;

  if p_status = 'succeeded' then
    insert into public.ai_usage (agency_id, job_id, feature, model, prompt_tokens, completion_tokens, credits, cost_eur)
    values (v_agency, p_id, v_type, p_model, p_prompt_tokens, p_completion_tokens, p_credits, p_cost_eur);
  end if;
end;
$$;

revoke all on function public.complete_ai_job(uuid, ai_job_status, jsonb, text, text, int, int, int, numeric) from public;
grant execute on function public.complete_ai_job(uuid, ai_job_status, jsonb, text, text, int, int, int, numeric) to service_role;
