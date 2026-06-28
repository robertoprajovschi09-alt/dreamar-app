# drea.mar — Edge Functions deploy guide (Phase 7)

Three Deno Edge Functions live here. The **pure logic** they rely on
(`_shared/*.mjs`) is unit-tested offline (`npm run test:fn`) and the **DB RPCs**
they call are tested in the migration harness (`npm run test:db`). What's left
is wiring real Stripe + Anthropic + a live Supabase project.

```
supabase/functions/
  _shared/
    runtime.ts      Deno helpers: CORS, supabase clients, Claude wrapper
    health.mjs      computeHealthScore()        ← tested
    billing.mjs     Stripe → DB mapping         ← tested
    report.mjs      prompt + parse 13 sections  ← tested
    credits.mjs     token → credits/cost        ← tested
  stripe-webhook/   subscriptions + agency tier sync
  onboard-agency/   create agency + owner + Stripe customer
  ai-worker/        claim job → Claude → write result + usage
```

## 1. Prerequisites you provide

| Secret | Where to get it |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

## 2. One-time setup

```bash
# Link the repo to your Supabase project
supabase link --project-ref <your-ref>

# Push the schema (22 migrations)
supabase db push

# Set function secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... ANTHROPIC_API_KEY=sk-ant-...
# (SUPABASE_URL / keys are injected automatically.)
```

### Create the 4 Stripe prices and attach them to plans
In Stripe, create one recurring **EUR/month** price per tier (99, 150, 249, 399),
then map each price id onto the `plans` row:

```sql
update public.plans set stripe_price_id = 'price_xxx' where tier = 'starter';
update public.plans set stripe_price_id = 'price_yyy' where tier = 'growth';
update public.plans set stripe_price_id = 'price_zzz' where tier = 'unlimited';
update public.plans set stripe_price_id = 'price_www' where tier = 'white_label_pro';
```

## 3. Deploy

```bash
supabase functions deploy onboard-agency
supabase functions deploy ai-worker
# Stripe calls the webhook unauthenticated — verify by signature instead:
supabase functions deploy stripe-webhook --no-verify-jwt
```

Add the webhook endpoint in Stripe → Developers → Webhooks:
`https://<ref>.functions.supabase.co/stripe-webhook`, subscribed to
`customer.subscription.*` and `checkout.session.completed`. Copy the signing
secret into `STRIPE_WEBHOOK_SECRET`.

### Run the AI worker on a schedule
```sql
select cron.schedule('ai-worker', '* * * * *', $$
  select net.http_post(
    url := 'https://<ref>.functions.supabase.co/ai-worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_key'))
  );
$$);
```
(Or trigger it directly after enqueuing a job for lower latency.)

## 4. Smoke test

```bash
# Enqueue a report job, then invoke the worker
supabase functions invoke ai-worker
# Trigger a test webhook
stripe trigger customer.subscription.updated
```

## 5. Front-end wiring (Phase 8)

The app currently uses sample data + a localStorage demo auth. To go live:
replace `lib/auth.tsx` with Supabase Auth, add a typed client
(`supabase gen types typescript`), and swap each page's sample data for live
queries — page by page behind a feature flag. The schema, RLS and these
functions are already in place to back it.
