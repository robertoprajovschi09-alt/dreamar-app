-- =============================================================================
-- drea.mar — Seed
-- The ONLY seed: the 4 paid tiers. Everything else is created at runtime via
-- signup / Stripe / Edge Functions. We deliberately do NOT seed agencies,
-- clients, or any tenant data (the spec rule: "no random demo data").
-- =============================================================================

insert into public.plans (tier, name, tagline, price_eur_monthly, max_clients, max_team_members, features, display_order)
values
  (
    'starter', 'Starter Agency', 'For solo operators getting started',
    99, 5, 1,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true
    ),
    1
  ),
  (
    'growth', 'Growth Agency', 'For growing teams that need AI',
    150, 15, 3,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true
    ),
    2
  ),
  (
    'unlimited', 'Unlimited Agency', 'For scaling agencies',
    249, null, null,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true,
      'white_label_reports', true,
      'ai_strategy_room', true,
      'advanced_analytics', true,
      'competitor_watch', true
    ),
    3
  ),
  (
    'white_label_pro', 'White Label Pro', 'Your brand, your domain',
    399, null, null,
    jsonb_build_object(
      'document_storage', true,
      'basic_reports', true,
      'basic_calendar', true,
      'ai_reports', true,
      'client_portal', true,
      'niche_dashboards', true,
      'approval_workflow', true,
      'white_label_reports', true,
      'ai_strategy_room', true,
      'advanced_analytics', true,
      'competitor_watch', true,
      'custom_branding', true,
      'custom_domain', true,
      'advanced_permissions', true,
      'premium_pdf', true
    ),
    4
  )
on conflict (tier) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  price_eur_monthly = excluded.price_eur_monthly,
  max_clients = excluded.max_clients,
  max_team_members = excluded.max_team_members,
  features = excluded.features,
  display_order = excluded.display_order;
