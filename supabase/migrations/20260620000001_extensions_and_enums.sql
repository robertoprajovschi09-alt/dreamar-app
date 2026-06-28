-- =============================================================================
-- drea.mar — Phase 0 / Migration 1
-- Extensions, enums, and table-independent helper functions.
--
-- This migration is intentionally small and free of any FK references so it
-- can run before any tables exist. Later migrations build on these primitives.
-- =============================================================================

-- ----------------------------- Extensions -----------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive email/text
create extension if not exists "pg_trgm";   -- fuzzy text search for command palette etc.

-- ------------------------------- Enums --------------------------------------
-- The 5 roles from the spec. saas_admin is a system-wide role; the rest are
-- agency-scoped and live on agency_members.role.
create type app_role as enum (
  'saas_admin',
  'agency_owner',
  'agency_team_member',
  'content_creator',
  'client_viewer'
);

-- The 10 niches from the spec. Adding a new niche means an ALTER TYPE.
create type niche as enum (
  'real_estate',
  'restaurant',
  'lounge',
  'dental_clinic',
  'fitness_gym',
  'local_store',
  'beauty',
  'auto',
  'hotel',
  'custom'
);

-- The 4 paid tiers from the spec.
create type plan_tier as enum ('starter', 'growth', 'unlimited', 'white_label_pro');

create type client_status as enum ('onboarding', 'active', 'paused', 'archived');

-- Matches Stripe's subscription.status values so webhooks map 1:1.
create type subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

create type risk_level as enum ('low', 'medium', 'high');

create type platform as enum (
  'instagram', 'tiktok', 'facebook', 'youtube', 'linkedin', 'twitter', 'whatsapp'
);

create type notification_severity as enum ('info', 'success', 'warning', 'danger');

-- --------------------- Table-independent triggers ---------------------------
-- A single updated_at trigger function reused by every table that wants the
-- column auto-maintained. Tables opt in by creating a `before update` trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A guard helper to keep tenant data tight: agency_id on a row must never
-- change after insert (prevents cross-tenant data poisoning via UPDATE).
create or replace function public.lock_agency_id()
returns trigger
language plpgsql
as $$
begin
  if new.agency_id is distinct from old.agency_id then
    raise exception 'agency_id is immutable (attempted to change from % to %)',
      old.agency_id, new.agency_id;
  end if;
  return new;
end;
$$;
