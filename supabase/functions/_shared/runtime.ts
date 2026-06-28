// Shared Deno runtime helpers for the Edge Functions: CORS, Supabase clients,
// and the Claude wrapper. (Deno + npm: specifiers — runs in Supabase Edge
// Runtime, not in the Vite app, so it's excluded from the app tsconfig.)
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.30";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Service-role client — bypasses RLS. Used by the webhook + AI worker.
export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// Acts as the calling user (RLS applies, auth.uid() is set). Used by onboarding.
export function userClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function callClaude(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxTokens?: number;
}) {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
  const model = opts.model ?? "claude-opus-4-8";
  const res = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
  });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return {
    text,
    model: res.model,
    promptTokens: res.usage?.input_tokens ?? 0,
    completionTokens: res.usage?.output_tokens ?? 0,
  };
}
