// Pure Stripe → DB mapping logic for the webhook handler. No Stripe SDK here;
// the handler passes plain objects in.

const VALID_STATUSES = new Set([
  "trialing", "active", "past_due", "canceled",
  "incomplete", "incomplete_expired", "unpaid", "paused",
]);

/** Map a Stripe subscription.status to our subscription_status enum. */
export function stripeStatusToDb(status) {
  return VALID_STATUSES.has(status) ? status : "incomplete";
}

/**
 * Resolve our plan tier from a Stripe price id.
 * @param {string} priceId
 * @param {Record<string,string>} priceMap  { [stripePriceId]: tier }
 */
export function tierFromPriceId(priceId, priceMap = {}) {
  return priceMap[priceId] ?? null;
}

const iso = (unixSeconds) =>
  unixSeconds == null ? null : new Date(unixSeconds * 1000).toISOString();

/**
 * Build the subscriptions row to upsert from a Stripe subscription object.
 * @param {object} args
 * @param {object} args.stripeSub  Stripe subscription (snake_case fields)
 * @param {string} args.agencyId
 * @param {string} args.planId
 */
export function buildSubscriptionRow({ stripeSub, agencyId, planId }) {
  const item = stripeSub?.items?.data?.[0];
  return {
    agency_id: agencyId,
    plan_id: planId,
    stripe_subscription_id: stripeSub.id,
    status: stripeStatusToDb(stripeSub.status),
    current_period_start: iso(stripeSub.current_period_start),
    current_period_end: iso(stripeSub.current_period_end),
    cancel_at_period_end: !!stripeSub.cancel_at_period_end,
    trial_end: iso(stripeSub.trial_end),
    _price_id: item?.price?.id ?? null, // caller uses this to resolve plan/tier
  };
}
