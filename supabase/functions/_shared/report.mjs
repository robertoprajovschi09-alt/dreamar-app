// Pure helpers for the AI Monthly Report generator: prompt assembly + robust
// parsing of Claude's response into the canonical 13 sections.

export const REPORT_SECTIONS = [
  ["executive_summary", "Executive Summary"],
  ["work_completed", "Work Completed"],
  ["best_performing_content", "Best-Performing Content"],
  ["worst_performing_content", "Worst-Performing Content"],
  ["platform_growth", "Platform Growth"],
  ["hook_analysis", "Hook Analysis"],
  ["content_format_analysis", "Content Format Analysis"],
  ["business_impact", "Business Impact"],
  ["client_feedback", "Client Feedback"],
  ["problems_noticed", "Problems Noticed"],
  ["next_month_strategy", "Next-Month Strategy"],
  ["recommended_content_plan", "Recommended Content Plan"],
  ["final_agency_conclusion", "Final Agency Conclusion"],
];

export function reportSystemPrompt() {
  return [
    "You are a senior strategist at a marketing agency writing a client's monthly performance report.",
    "Use ONLY the data provided. Be specific, concrete and premium in tone — no fluff.",
    "Return STRICT JSON: an array of objects { \"key\": <section_key>, \"body\": <markdown string> }.",
    "Include exactly these section keys, in order: " + REPORT_SECTIONS.map(([k]) => k).join(", ") + ".",
  ].join("\n");
}

/** Assemble a compact context object the model reasons over. */
export function buildReportContext({ client, period, videos = [], metrics = {}, impact = {}, feedback = "" } = {}) {
  return {
    client: client?.name,
    niche: client?.niche,
    objectives: client?.objectives ?? [],
    period,
    top_videos: videos
      .slice()
      .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
      .slice(0, 5)
      .map((v) => ({ hook: v.hook, platform: v.platform, views: v.views, ai_score: v.ai_score, rec: v.recommendation })),
    platform_metrics: metrics,
    business_impact: impact,
    client_feedback: feedback,
  };
}

function stripFences(text) {
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  // Otherwise grab the first [...] block if there's prose around it.
  const arr = t.match(/\[[\s\S]*\]/);
  return arr ? arr[0] : t;
}

/**
 * Parse Claude's response into the full 13-section structure. Robust to code
 * fences and surrounding prose; missing sections come back with empty bodies
 * so the report is always complete and editable.
 */
export function parseReportSections(aiText) {
  let parsed = [];
  try {
    parsed = JSON.parse(stripFences(aiText));
  } catch {
    parsed = [];
  }
  const byKey = new Map();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item.key === "string") byKey.set(item.key, String(item.body ?? ""));
    }
  }
  return REPORT_SECTIONS.map(([key, title], i) => ({
    key,
    title,
    body: byKey.get(key) ?? "",
    ready: byKey.has(key),
    order: i + 1,
  }));
}
