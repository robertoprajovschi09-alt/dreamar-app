// Unit tests for the pure Edge-Function logic (no Deno/Supabase needed).
// Run with: npm run test:fn
import { computeHealthScore, riskForScore } from "../supabase/functions/_shared/health.mjs";
import { stripeStatusToDb, tierFromPriceId, buildSubscriptionRow } from "../supabase/functions/_shared/billing.mjs";
import { parseReportSections, REPORT_SECTIONS, buildReportContext } from "../supabase/functions/_shared/report.mjs";
import { creditsForUsage } from "../supabase/functions/_shared/credits.mjs";

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failures.push({ name, err: e.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`);
  }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

console.log("\n\x1b[1mEdge-Function pure logic:\x1b[0m");

// ---- health ----
check("health: all-perfect inputs → 100 / low", () => {
  const r = computeHealthScore({ performance_trend: 100, business_impact: 100, client_feedback: 100, report_delivery: 100, communication_frequency: 100, approval_delays: 0, overdue_tasks: 0 });
  eq(r.score, 100); eq(r.risk, "low");
});
check("health: inverted components punish a high score", () => {
  // Everything great EXCEPT lots of overdue tasks + approval delays (bad).
  const r = computeHealthScore({ performance_trend: 90, business_impact: 90, client_feedback: 90, report_delivery: 90, communication_frequency: 90, approval_delays: 100, overdue_tasks: 100 });
  // inverted contributions (12+13 weight) pull it down.
  if (r.score >= 90) throw new Error(`score not punished: ${r.score}`);
  if (r.score <= 0) throw new Error(`score collapsed: ${r.score}`);
});
check("health: risk thresholds match the SQL trigger", () => {
  eq(riskForScore(75), "low"); eq(riskForScore(74), "medium"); eq(riskForScore(50), "medium"); eq(riskForScore(49), "high");
});

// ---- billing ----
check("billing: stripeStatusToDb passes valid, falls back to incomplete", () => {
  eq(stripeStatusToDb("active"), "active");
  eq(stripeStatusToDb("past_due"), "past_due");
  eq(stripeStatusToDb("nonsense"), "incomplete");
});
check("billing: tierFromPriceId resolves via the price map", () => {
  const map = { price_growth: "growth", price_unl: "unlimited" };
  eq(tierFromPriceId("price_unl", map), "unlimited");
  eq(tierFromPriceId("price_missing", map), null);
});
check("billing: buildSubscriptionRow converts timestamps + maps status", () => {
  const sub = {
    id: "sub_123", status: "trialing", current_period_start: 1750000000, current_period_end: 1752592000,
    cancel_at_period_end: true, trial_end: 1751000000, items: { data: [{ price: { id: "price_growth" } }] },
  };
  const row = buildSubscriptionRow({ stripeSub: sub, agencyId: "ag1", planId: "pl1" });
  eq(row.agency_id, "ag1"); eq(row.plan_id, "pl1"); eq(row.status, "trialing");
  eq(row.stripe_subscription_id, "sub_123"); eq(row.cancel_at_period_end, true);
  eq(row._price_id, "price_growth");
  if (!row.current_period_start.startsWith("2025-")) throw new Error(`bad ISO: ${row.current_period_start}`);
});

// ---- report ----
check("report: parses fenced JSON into all 13 sections, fills bodies", () => {
  const ai = "Here you go:\n```json\n[{\"key\":\"executive_summary\",\"body\":\"Strong June.\"},{\"key\":\"business_impact\",\"body\":\"€430k pipeline.\"}]\n```";
  const sections = parseReportSections(ai);
  eq(sections.length, 13);
  eq(sections[0].body, "Strong June.");
  eq(sections[0].ready, true);
  const impact = sections.find((s) => s.key === "business_impact");
  eq(impact.body, "€430k pipeline.");
  // A section the model omitted is present but empty + not ready.
  const omitted = sections.find((s) => s.key === "hook_analysis");
  eq(omitted.body, ""); eq(omitted.ready, false);
});
check("report: malformed AI output still yields 13 empty sections", () => {
  const sections = parseReportSections("the model rambled and returned no json");
  eq(sections.length, 13);
  eq(sections.every((s) => s.body === "" && s.ready === false), true);
});
check("report: context puts top videos first by ai_score", () => {
  const ctx = buildReportContext({
    client: { name: "Altmark", niche: "real_estate", objectives: ["sell units"] },
    period: "2026-06",
    videos: [{ hook: "low", ai_score: 40 }, { hook: "high", ai_score: 95 }, { hook: "mid", ai_score: 70 }],
  });
  eq(ctx.top_videos[0].hook, "high");
  eq(ctx.client, "Altmark");
});

// ---- credits ----
check("credits: 1 credit per 1k tokens (min 1) + cost from rate card", () => {
  const a = creditsForUsage(4200, 1800, "claude-opus-4-8");
  eq(a.credits, 6); // ceil(6000/1000)
  if (!(a.costEur > 0)) throw new Error("cost should be positive");
  const tiny = creditsForUsage(10, 5, "claude-haiku-4-5");
  eq(tiny.credits, 1); // min 1
});

console.log(`\n\x1b[1m${failures.length === 0 ? "\x1b[32mAll" : "\x1b[31m"} ${passed} passing\x1b[0m${failures.length ? `, \x1b[31m${failures.length} failing\x1b[0m` : ""}`);
if (failures.length) process.exit(1);
