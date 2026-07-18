/*
 * Cron logic: once a minute, find clips whose post time just arrived and push a
 * reminder to the agency's subscribed devices. Everything is best-effort — a
 * single dead phone or bad row must never take the whole run down.
 */
import { renderLine } from "./lines.js";
import { sendPush } from "./webpush.js";

// Current date + time on Europe/Bucharest as "YYYY-MM-DD" and "HH:MM:SS".
function bucharestNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = g("hour") === "24" ? "00" : g("hour"); // some engines emit 24 at midnight
  return { today: `${g("year")}-${g("month")}-${g("day")}`, now: `${hour}:${g("minute")}:${g("second")}` };
}
// "HH:MM:SS" 10 minutes earlier, clamped to 00:00:00 (never wraps past midnight).
function tenMinutesBefore(now) {
  const [h, m, s] = now.split(":").map(Number);
  const sod = Math.max(0, h * 3600 + m * 60 + s - 600);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(sod / 3600))}:${p(Math.floor((sod % 3600) / 60))}:${p(sod % 60)}`;
}

async function sb(env, path, init = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

export async function runReminders(env) {
  const { today, now } = bucharestNow();
  const low = tenMinutesBefore(now);

  // Due, unsent, scheduled clips within the last 10 minutes of today only.
  const q =
    `clips?select=id,title,agency_id,scheduled_time,clients(name)` +
    `&state=eq.scheduled&post_reminder_sent_at=is.null` +
    `&scheduled_date=eq.${encodeURIComponent(today)}` +
    `&scheduled_time=lte.${encodeURIComponent(now)}` +
    `&scheduled_time=gt.${encodeURIComponent(low)}`;

  let clips = [];
  try {
    const res = await sb(env, q);
    if (!res.ok) { console.error("[reminders] clips fetch failed:", res.status); return; }
    clips = await res.json();
  } catch (e) { console.error("[reminders] clips fetch error:", e); return; }

  for (const clip of clips) {
    try {
      // Claim first so a concurrent run can't double-send. If the conditional
      // PATCH returns no row, someone else already took it.
      const claim = await sb(env, `clips?id=eq.${clip.id}&post_reminder_sent_at=is.null`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ post_reminder_sent_at: new Date().toISOString() }),
      });
      if (!claim.ok) { console.error("[reminders] claim failed:", clip.id, claim.status); continue; }
      const claimed = await claim.json();
      if (!Array.isArray(claimed) || claimed.length === 0) continue; // taken by another run

      const subsRes = await sb(env, `push_subscriptions?agency_id=eq.${clip.agency_id}&select=endpoint,p256dh,auth`);
      if (!subsRes.ok) { console.error("[reminders] subs fetch failed:", subsRes.status); continue; }
      const subs = await subsRes.json();
      if (!subs.length) continue;

      const clientName = clip.clients?.name || "client";
      const { title, body } = renderLine(Math.random(), clip.title, clientName);
      const payload = { title, body, tag: `post-${clip.id}`, url: "/dashboard" };

      for (const sub of subs) {
        try {
          const r = await sendPush(sub, payload, env);
          if (r.gone) {
            await sb(env, `push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
          }
        } catch (e) { console.error("[reminders] send error:", e); }
      }
    } catch (e) { console.error("[reminders] clip error:", clip.id, e); }
  }
}
