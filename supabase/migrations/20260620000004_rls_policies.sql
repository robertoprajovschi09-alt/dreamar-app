-- =============================================================================
-- drea.mar — Phase 0 / Migration 4
-- Row-Level Security: enable + policies for every core tenant table.
--
-- Pattern (memorize this — every later module follows the same shape):
--
--   alter table public.<t> enable row level security;
--   alter table public.<t> force row level security;
--
--   create policy "<t>_select" on public.<t> for select
--     using (agency_id in (select * from public.current_agency_ids()));
--
--   create policy "<t>_insert" on public.<t> for insert
--     with check (public.is_member_of(agency_id));
--
--   create policy "<t>_update" on public.<t> for update
--     using (public.is_member_of(agency_id))
--     with check (public.is_member_of(agency_id));
--
--   create policy "<t>_delete" on public.<t> for delete
--     using (public.is_owner_of(agency_id));
--
-- WITH CHECK on insert/update is critical: without it, a member of agency A
-- could insert a row claiming agency_id = B. The check forces the new value
-- to live inside an agency the caller is a member of.
--
-- FORCE RLS makes the policies apply even to table owners, so a future
-- admin tool that ever forgets to drop privileges can't accidentally bypass
-- tenant isolation.
-- =============================================================================

-- ------------------------------ profiles ------------------------------------
-- Profiles are NOT agency-scoped; they're per-user. A profile is visible to:
--   - the owner of the profile
--   - SaaS admins
--   - anyone in the same agency (so the team can see each other)
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles_select_self_or_admin_or_teammate" on public.profiles
  for select
  using (
    id = auth.uid()
    or public.is_saas_admin()
    or exists (
      select 1
      from public.agency_members me
      join public.agency_members them on them.agency_id = me.agency_id
      where me.profile_id = auth.uid() and them.profile_id = profiles.id
    )
  );

-- Insert is restricted to the user creating their own profile (the auth
-- trigger uses security definer, bypassing this).
create policy "profiles_insert_self" on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_update_self_or_admin" on public.profiles
  for update
  using (id = auth.uid() or public.is_saas_admin())
  with check (id = auth.uid() or public.is_saas_admin());

-- ------------------------------ agencies ------------------------------------
-- agency.id IS the agency_id for these rows.
alter table public.agencies enable row level security;
alter table public.agencies force row level security;

create policy "agencies_select" on public.agencies
  for select
  using (id in (select * from public.current_agency_ids()));

-- New agency creation goes through an Edge Function with service_role; ordinary
-- callers can't INSERT. We expose no insert policy at all.

create policy "agencies_update_by_owner" on public.agencies
  for update
  using (public.is_owner_of(id))
  with check (public.is_owner_of(id));

-- Agencies cannot be deleted by users; archival is via the archived_at column.
-- A saas_admin policy is intentionally not added — admins use service_role.

-- --------------------------- agency_members ---------------------------------
alter table public.agency_members enable row level security;
alter table public.agency_members force row level security;

create policy "agency_members_select" on public.agency_members
  for select
  using (agency_id in (select * from public.current_agency_ids()));

create policy "agency_members_insert_by_owner" on public.agency_members
  for insert
  with check (public.is_owner_of(agency_id));

create policy "agency_members_update_by_owner" on public.agency_members
  for update
  using (public.is_owner_of(agency_id))
  with check (public.is_owner_of(agency_id));

-- A user can remove themselves; an owner can remove anyone.
create policy "agency_members_delete_self_or_owner" on public.agency_members
  for delete
  using (profile_id = auth.uid() or public.is_owner_of(agency_id));

-- ---------------------------- invitations -----------------------------------
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

create policy "invitations_select" on public.invitations
  for select
  using (agency_id in (select * from public.current_agency_ids()));

create policy "invitations_insert_by_owner" on public.invitations
  for insert
  with check (public.is_owner_of(agency_id));

create policy "invitations_delete_by_owner" on public.invitations
  for delete
  using (public.is_owner_of(agency_id));

-- ------------------------------ clients -------------------------------------
alter table public.clients enable row level security;
alter table public.clients force row level security;

-- Agency staff can see all their agency's clients; Client Viewers see only
-- their assigned client.
create policy "clients_select" on public.clients
  for select
  using (
    agency_id in (select agency_id from public.agency_members where profile_id = auth.uid())
    or exists (
      select 1 from public.client_users cu
      where cu.client_id = clients.id and cu.profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only agency members (not Client Viewers) can create/update clients.
create policy "clients_insert" on public.clients
  for insert
  with check (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

create policy "clients_update" on public.clients
  for update
  using (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  )
  with check (
    exists (
      select 1 from public.agency_members
      where agency_id = clients.agency_id and profile_id = auth.uid()
    )
    or public.is_saas_admin()
  );

-- Only owners can hard-delete; standard archival is via UPDATE archived_at.
create policy "clients_delete_by_owner" on public.clients
  for delete
  using (public.is_owner_of(agency_id));

-- -------------------------- client_contacts ---------------------------------
alter table public.client_contacts enable row level security;
alter table public.client_contacts force row level security;

create policy "client_contacts_select" on public.client_contacts
  for select
  using (public.has_client_access(client_id));

create policy "client_contacts_write" on public.client_contacts
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ---------------------------- client_users ----------------------------------
alter table public.client_users enable row level security;
alter table public.client_users force row level security;

-- A user can see their own client_users row (so the portal knows which
-- client they belong to). Agency members can see all of their agency's.
create policy "client_users_select" on public.client_users
  for select
  using (
    profile_id = auth.uid()
    or public.is_member_of(agency_id)
  );

create policy "client_users_write" on public.client_users
  for all
  using (public.is_member_of(agency_id))
  with check (public.is_member_of(agency_id));

-- ------------------------------- plans --------------------------------------
-- Public-read so the billing page can show the plan grid to anyone (including
-- non-authenticated visitors if we ever want a marketing site). Writes are
-- service_role only (no write policy → blocked).
alter table public.plans enable row level security;
-- NOTE: not forcing RLS so service_role unaffected (it already bypasses).

create policy "plans_public_read" on public.plans
  for select
  using (true);

-- --------------------------- subscriptions ----------------------------------
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

create policy "subscriptions_select" on public.subscriptions
  for select
  using (agency_id in (select * from public.current_agency_ids()));

-- All writes are done by the Stripe webhook handler with service_role.
-- No insert/update/delete policy = no user-level writes.

-- --------------------------- usage_counters ---------------------------------
alter table public.usage_counters enable row level security;
alter table public.usage_counters force row level security;

create policy "usage_counters_select" on public.usage_counters
  for select
  using (agency_id in (select * from public.current_agency_ids()));

-- Writes are by triggers (security definer) only.

-- ----------------------------- audit_log ------------------------------------
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy "audit_log_select" on public.audit_log
  for select
  using (
    public.is_saas_admin()
    or (agency_id is not null and agency_id in (select * from public.current_agency_ids()))
  );

-- audit_log is append-only via service_role / Edge Functions. No user writes.

-- ---------------------------- notifications ---------------------------------
alter table public.notifications enable row level security;
alter table public.notifications force row level security;

-- I can see notifications either addressed to me, or broadcast to my agency.
create policy "notifications_select" on public.notifications
  for select
  using (
    (profile_id = auth.uid())
    or (profile_id is null and agency_id in (select * from public.current_agency_ids()))
    or public.is_saas_admin()
  );

-- The only user-allowed write is marking my own notification as read.
create policy "notifications_mark_read" on public.notifications
  for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Inserts/deletes happen via service_role / Edge Functions (no policy).
