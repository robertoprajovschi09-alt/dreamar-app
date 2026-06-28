// Pure usage → credits/cost metering. Keeps the billing page's "AI credits"
// in sync with token spend.

// Indicative EUR per 1M tokens (input/output) by model family. Adjust to the
// live Anthropic price sheet at deploy time.
const PRICING = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 0.8, out: 4 },
};

function priceFor(model) {
  if (!model) return PRICING["claude-sonnet-4-6"];
  const key = Object.keys(PRICING).find((k) => model.startsWith(k));
  return PRICING[key] ?? PRICING["claude-sonnet-4-6"];
}

/**
 * @returns {{ credits: number, costEur: number }}
 * 1 credit per 1k total tokens (min 1); cost from the model's rate card.
 */
export function creditsForUsage(promptTokens = 0, completionTokens = 0, model) {
  const p = Math.max(0, Number(promptTokens) || 0);
  const c = Math.max(0, Number(completionTokens) || 0);
  const credits = Math.max(1, Math.ceil((p + c) / 1000));
  const rate = priceFor(model);
  const costEur = +(((p / 1e6) * rate.in + (c / 1e6) * rate.out)).toFixed(4);
  return { credits, costEur };
}
