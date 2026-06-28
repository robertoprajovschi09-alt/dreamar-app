// Pure health-score logic shared by the AI worker (Deno) and the test
// harness (Node). No platform APIs — keep it pure so both can import it.

// Default component weights (sum = 100). Two components are "lower is better"
// (approval_delays, overdue_tasks) and get inverted before weighting.
export const DEFAULT_WEIGHTS = {
  performance_trend: 20,
  business_impact: 20,
  client_feedback: 15,
  overdue_tasks: 13, // inverted
  approval_delays: 12, // inverted
  report_delivery: 10,
  communication_frequency: 10,
};

const INVERTED = new Set(["approval_delays", "overdue_tasks"]);

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/**
 * Compute a 0–100 health score + low/medium/high risk from component inputs.
 * @param {Record<string, number>} components each 0..100
 * @param {Record<string, number>} [weights]
 * @returns {{ score: number, risk: 'low'|'medium'|'high', contributions: Record<string,number> }}
 */
export function computeHealthScore(components = {}, weights = DEFAULT_WEIGHTS) {
  let weighted = 0;
  let total = 0;
  const contributions = {};
  for (const [key, w] of Object.entries(weights)) {
    const raw = clamp(components[key]);
    const effective = INVERTED.has(key) ? 100 - raw : raw;
    weighted += effective * w;
    total += w;
    contributions[key] = effective;
  }
  const score = total > 0 ? Math.round(weighted / total) : 0;
  const risk = riskForScore(score);
  return { score, risk, contributions };
}

/** Thresholds match the SQL default_health_risk() trigger and the UI gauge. */
export function riskForScore(score) {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}
