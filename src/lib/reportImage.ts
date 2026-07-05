// Renders a client's monthly report as a clean PNG on the app's dark background,
// with the drea.mar logo. No dependencies — pure canvas.

export type ReportData = {
  clientName: string;
  monthLabel: string;
  published: number;
  reach: number;
  dmLeads: number;
  week: string;
  next: string;
};

// Forced dark palette (matches index.css `.dark` tokens) so the image is always
// on the dark background regardless of the current theme.
const C = {
  bg: "hsl(233,22%,7%)",
  card: "hsl(230,18%,12%)",
  fg: "hsl(230,18%,95%)",
  muted: "hsl(230,11%,62%)",
  primary: "hsl(245,80%,66%)",
  border: "hsl(230,14%,20%)",
};
const FONT = "Inter, system-ui, -apple-system, sans-serif";
const nf = (n: number) => n.toLocaleString("ro-RO");

export function buildReportText(d: ReportData): string {
  const lines = [
    `${d.clientName} · ${d.monthLabel}`,
    ``,
    `Postări publicate: ${d.published}`,
    `Reach total: ${nf(d.reach)}`,
    `Lead-uri (DM & WhatsApp): ${nf(d.dmLeads)}`,
  ];
  if (d.week.trim()) lines.push(``, `Ce s-a întâmplat:`, d.week.trim());
  if (d.next.trim()) lines.push(``, `Ce urmează:`, d.next.trim());
  return lines.join("\n");
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para === "") { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadReportImage(d: ReportData): Promise<void> {
  try { await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* fonts optional */ }

  const W = 1080, P = 72, gap = 24;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  const ctx = canvas.getContext("2d")!;

  const contentW = W - 2 * P;
  ctx.font = `400 30px ${FONT}`;
  const weekLines = d.week.trim() ? wrap(ctx, d.week.trim(), contentW) : [];
  const nextLines = d.next.trim() ? wrap(ctx, d.next.trim(), contentW) : [];

  // vertical layout math
  let y = P;
  y += 56 + 44;             // logo row
  y += 66;                  // client name
  y += 44;                  // month
  y += 40;                  // divider gap
  const tileTop = y;
  y += 148 + 48;            // stat tiles
  const weekTop = weekLines.length ? y : 0;
  if (weekLines.length) { y += 40 + weekLines.length * 44 + 44; }
  const nextTop = nextLines.length ? y : 0;
  if (nextLines.length) { y += 40 + nextLines.length * 44 + 44; }
  y += 8;                   // footer
  const H = Math.max(720, y + P);
  canvas.height = H;

  // ── paint ──
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // logo
  ctx.fillStyle = C.primary; roundRect(ctx, P, P, 56, 56, 16); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 34px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.fillText("d", P + 28, P + 30);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = C.fg; ctx.fillText("drea", P + 76, P + 30);
  const dreaW = ctx.measureText("drea").width;
  ctx.fillStyle = C.primary; ctx.fillText(".mar", P + 76 + dreaW, P + 30);
  ctx.font = `600 15px ${FONT}`; ctx.fillStyle = C.muted; ctx.fillText("DR DREAM OPS", P + 76, P + 50);

  // title
  let ty = P + 56 + 44;
  ctx.fillStyle = C.fg; ctx.font = `800 56px ${FONT}`; ctx.fillText(d.clientName, P, ty + 44);
  ty += 66;
  ctx.fillStyle = C.muted; ctx.font = `500 28px ${FONT}`; ctx.fillText(d.monthLabel, P, ty + 26);
  ty += 44;

  // divider
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, tileTop - 20); ctx.lineTo(W - P, tileTop - 20); ctx.stroke();

  // stat tiles
  const tiles = [
    { v: nf(d.published), l: "Postări publicate" },
    { v: nf(d.reach), l: "Reach total" },
    { v: nf(d.dmLeads), l: "Lead-uri DM & WhatsApp" },
  ];
  const tileW = (contentW - 2 * gap) / 3;
  tiles.forEach((t, i) => {
    const x = P + i * (tileW + gap);
    ctx.fillStyle = C.card; roundRect(ctx, x, tileTop, tileW, 148, 20); ctx.fill();
    ctx.strokeStyle = C.border; ctx.stroke();
    ctx.fillStyle = C.fg; ctx.font = `800 46px ${FONT}`; ctx.fillText(t.v, x + 24, tileTop + 66);
    ctx.fillStyle = C.muted; ctx.font = `500 22px ${FONT}`;
    wrap(ctx, t.l, tileW - 48).slice(0, 2).forEach((ln, k) => ctx.fillText(ln, x + 24, tileTop + 100 + k * 26));
  });

  const section = (top: number, heading: string, lines: string[]) => {
    ctx.fillStyle = C.primary; ctx.font = `700 24px ${FONT}`; ctx.fillText(heading, P, top + 22);
    ctx.fillStyle = C.fg; ctx.font = `400 30px ${FONT}`;
    lines.forEach((ln, k) => ctx.fillText(ln, P, top + 40 + 30 + k * 44));
  };
  if (weekTop) section(weekTop, "Ce s-a întâmplat", weekLines);
  if (nextTop) section(nextTop, "Ce urmează", nextLines);

  ctx.fillStyle = C.muted; ctx.font = `500 20px ${FONT}`;
  ctx.fillText("Generat cu drea.mar", P, H - P + 8);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = d.clientName.replace(/[^\w-]+/g, "-").toLowerCase();
  a.href = url; a.download = `raport-${safe}-${d.monthLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
