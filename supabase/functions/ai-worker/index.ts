// AI worker. Claims the oldest queued ai_job (claim_ai_job RPC) and runs it:
//   report_generation · health_score · document_summary · strategy_response ·
//   hook_detection. Calls Claude, writes the result, then complete_ai_job
//   (which logs usage + rolls credits up).
//
// Invoke on a schedule (Supabase cron) or after enqueueing. Drains up to N
// jobs per invocation.
import { serviceClient, callClaude, json, corsHeaders } from "../_shared/runtime.ts";
import { buildReportContext, reportSystemPrompt, parseReportSections } from "../_shared/report.mjs";
import { computeHealthScore } from "../_shared/health.mjs";
import { creditsForUsage } from "../_shared/credits.mjs";

const MAX_PER_RUN = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = serviceClient();
  const processed: { id: string; type: string; status: string }[] = [];

  for (let i = 0; i < MAX_PER_RUN; i++) {
    const { data: job } = await db.rpc("claim_ai_job");
    if (!job || !job.id) break;

    try {
      const result = await runJob(db, job);
      const { credits, costEur } = creditsForUsage(result.promptTokens, result.completionTokens, result.model);
      await db.rpc("complete_ai_job", {
        p_id: job.id,
        p_status: "succeeded",
        p_output: result.output ?? null,
        p_error: null,
        p_model: result.model ?? null,
        p_prompt_tokens: result.promptTokens ?? 0,
        p_completion_tokens: result.completionTokens ?? 0,
        p_credits: credits,
        p_cost_eur: costEur,
      });
      processed.push({ id: job.id, type: job.type, status: "succeeded" });
    } catch (err) {
      await db.rpc("complete_ai_job", { p_id: job.id, p_status: "failed", p_error: (err as Error).message });
      processed.push({ id: job.id, type: job.type, status: "failed" });
    }
  }

  return json({ processed });
});

// ----- dispatch ------------------------------------------------------------
async function runJob(db: any, job: any) {
  switch (job.type) {
    case "report_generation": return await genReport(db, job);
    case "health_score": return await recomputeHealth(db, job);
    case "document_summary": return await summarizeDoc(db, job);
    case "strategy_response": return await strategyReply(db, job);
    case "hook_detection": return await detectHooks(db, job);
    default: throw new Error(`unknown_job_type ${job.type}`);
  }
}

async function genReport(db: any, job: any) {
  const reportId = job.input_ref?.report_id;
  const { data: report } = await db.from("ai_reports").select("*").eq("id", reportId).single();
  const { data: client } = await db.from("clients").select("*").eq("id", report.client_id).single();
  const { data: videos } = await db.from("videos").select("hook,platform,views,ai_score,recommendation").eq("client_id", report.client_id);
  const { data: metrics } = await db.from("client_niche_metrics").select("metrics").eq("client_id", report.client_id).order("period_month", { ascending: false }).limit(1);
  const { data: impact } = await db.from("business_impact_entries").select("*").eq("client_id", report.client_id).order("period_month", { ascending: false }).limit(1);

  const ctx = buildReportContext({
    client, period: report.period_month, videos: videos ?? [],
    metrics: metrics?.[0]?.metrics ?? {}, impact: impact?.[0] ?? {}, feedback: client.feedback ?? "",
  });

  await db.from("ai_reports").update({ status: "generating" }).eq("id", reportId);
  const ai = await callClaude({ system: reportSystemPrompt(), messages: [{ role: "user", content: JSON.stringify(ctx) }] });
  const sections = parseReportSections(ai.text);

  await db.from("ai_reports").update({
    sections, status: "ready", generated_at: new Date().toISOString(),
    model: ai.model, prompt_tokens: ai.promptTokens, completion_tokens: ai.completionTokens,
  }).eq("id", reportId);

  return { ...ai, output: { report_id: reportId, sections: sections.length } };
}

async function recomputeHealth(db: any, job: any) {
  const clientId = job.client_id;
  // The enqueuer assembles the component inputs (performance_trend,
  // approval_delays, overdue_tasks, …) from live data and passes them in.
  const components = job.input_ref?.components ?? {};
  const { score, risk, contributions } = computeHealthScore(components);

  await db.from("client_health_scores").insert({
    agency_id: job.agency_id, client_id: clientId, score, risk,
    components: contributions, ai_rationale: `Computed health ${score} (${risk}).`, method: "ai",
  });
  // No Claude call for the deterministic score; zero tokens.
  return { promptTokens: 0, completionTokens: 0, model: null, output: { score, risk } };
}

async function summarizeDoc(db: any, job: any) {
  const docId = job.input_ref?.document_id;
  const { data: doc } = await db.from("documents").select("*").eq("id", docId).single();
  await db.from("document_ai").upsert({ agency_id: job.agency_id, document_id: docId, status: "processing" }, { onConflict: "document_id" });

  const ai = await callClaude({
    system: "Summarize this document for a marketing agency. Return JSON { summary: string, extracted_fields: object }.",
    messages: [{ role: "user", content: `Filename: ${doc.filename}\nType: ${doc.mime_type}\n(Document text would be extracted from storage here.)` }],
  });
  let parsed: any = {};
  try { parsed = JSON.parse(ai.text.replace(/```json|```/g, "").trim()); } catch { parsed = { summary: ai.text }; }

  await db.from("document_ai").upsert({
    agency_id: job.agency_id, document_id: docId, status: "ready",
    summary: parsed.summary ?? "", extracted_fields: parsed.extracted_fields ?? {}, model: ai.model,
  }, { onConflict: "document_id" });

  return { ...ai, output: { document_id: docId } };
}

async function strategyReply(db: any, job: any) {
  const threadId = job.input_ref?.thread_id;
  const { data: thread } = await db.from("ai_strategy_threads").select("*").eq("id", threadId).single();
  const { data: msgs } = await db.from("ai_strategy_messages").select("role,content").eq("thread_id", threadId).order("created_at").limit(20);
  const { data: client } = await db.from("clients").select("name,niche,objectives").eq("id", thread.client_id).single();

  const ai = await callClaude({
    system: `You are the AI Strategy Room for ${client.name} (${client.niche}). Ground answers in this client's data. Objectives: ${JSON.stringify(client.objectives)}.`,
    messages: (msgs ?? []).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  });

  await db.from("ai_strategy_messages").insert({
    agency_id: job.agency_id, thread_id: threadId, role: "assistant", content: ai.text, model: ai.model, tokens: ai.completionTokens,
  });
  return { ...ai, output: { thread_id: threadId } };
}

async function detectHooks(db: any, job: any) {
  const { data: hooks } = await db.from("hooks").select("id,text,avg_ai_score").eq("agency_id", job.agency_id).gte("avg_ai_score", 80);
  const ai = await callClaude({
    system: "Identify the recurring winning pattern across these high-scoring hooks. Return JSON { pattern: string, hook_ids: string[] }.",
    messages: [{ role: "user", content: JSON.stringify(hooks ?? []) }],
  });
  let parsed: any = {};
  try { parsed = JSON.parse(ai.text.replace(/```json|```/g, "").trim()); } catch { parsed = {}; }
  if (parsed.pattern && Array.isArray(parsed.hook_ids)) {
    await db.from("hooks").update({ pattern: parsed.pattern, is_winning: true }).in("id", parsed.hook_ids);
  }
  return { ...ai, output: parsed };
}
