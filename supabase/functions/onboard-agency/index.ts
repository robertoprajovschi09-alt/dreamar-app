// Agency onboarding. Authenticated user → provisions their first agency
// (owner membership + counters) atomically via the create_agency_with_owner
// RPC, then creates a Stripe customer for billing.
import Stripe from "npm:stripe@16";
import { userClient, serviceClient, json, corsHeaders } from "../_shared/runtime.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const { name, slug, city } = await req.json().catch(() => ({}));
  if (!name || !slug) return json({ error: "name_and_slug_required" }, 400);

  const asUser = userClient(authHeader);
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json({ error: "invalid_session" }, 401);

  // Atomic: agency + owner membership + usage_counters (RPC runs as the user).
  const { data: agency, error } = await asUser.rpc("create_agency_with_owner", {
    p_name: name,
    p_slug: slug,
    p_city: city ?? null,
  });
  if (error) return json({ error: error.message }, 400);

  // Create a Stripe customer and attach it (service role — RLS-exempt).
  try {
    const customer = await stripe.customers.create({
      name,
      email: auth.user.email,
      metadata: { agency_id: agency.id },
    });
    await serviceClient().from("agencies").update({ stripe_customer_id: customer.id }).eq("id", agency.id);
    (agency as Record<string, unknown>).stripe_customer_id = customer.id;
  } catch (_) {
    // Billing setup is best-effort at onboarding; the webhook can attach later.
  }

  return json({ agency });
});
