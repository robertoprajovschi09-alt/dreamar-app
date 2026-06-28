// Stripe webhook handler.
//   - Verifies the signature, then keeps subscriptions + agency tier in sync.
//   - Runs with the service role (RLS bypassed); writes are guarded by the
//     verified signature.
//
// Deploy with `--no-verify-jwt` (Stripe calls it unauthenticated; we verify
// via the Stripe signature instead).
import Stripe from "npm:stripe@16";
import { serviceClient, json, corsHeaders } from "../_shared/runtime.ts";
import { buildSubscriptionRow } from "../_shared/billing.mjs";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig!, webhookSecret);
  } catch (err) {
    return json({ error: `signature verification failed: ${(err as Error).message}` }, 400);
  }

  const db = serviceClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        // Resolve the agency by Stripe customer id.
        const { data: agency } = await db
          .from("agencies").select("id").eq("stripe_customer_id", sub.customer as string).maybeSingle();
        if (!agency) break;

        // Resolve the plan by the subscription's price id.
        const priceId = sub.items.data[0]?.price?.id;
        const { data: plan } = await db
          .from("plans").select("id, tier").eq("stripe_price_id", priceId).maybeSingle();
        if (!plan) break;

        const row = buildSubscriptionRow({ stripeSub: sub, agencyId: agency.id, planId: plan.id });
        delete (row as Record<string, unknown>)._price_id;

        await db.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });

        // Mirror the active tier onto the agency for fast plan-limit checks.
        const activeTier = ["active", "trialing", "past_due"].includes(row.status) ? plan.tier : "starter";
        await db.from("agencies").update({ current_plan_tier: activeTier }).eq("id", agency.id);
        break;
      }

      case "checkout.session.completed": {
        // Attach the Stripe customer to the agency referenced in metadata.
        const session = event.data.object as Stripe.Checkout.Session;
        const agencyId = session.metadata?.agency_id;
        if (agencyId && session.customer) {
          await db.from("agencies").update({ stripe_customer_id: session.customer as string }).eq("id", agencyId);
        }
        break;
      }
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  return json({ received: true });
});
