// A fixed color per client, derived deterministically from the client id so it is
// the SAME everywhere in the app (calendar dots, entries, chips). Hue-spread
// palette picked to stay legible on both the dark and light themes.
const PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ef4444", // red
  "#14b8a6", // teal
  "#f97316", // orange
  "#3b82f6", // blue
  "#a855f7", // purple
  "#84cc16", // lime
];

const NO_CLIENT = "#94a3b8"; // slate, for clips with no client

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// The client's fixed hex color. Falls back to a neutral slate when there is none.
export function clientColor(clientId: string | null | undefined): string {
  if (!clientId) return NO_CLIENT;
  return PALETTE[hash(clientId) % PALETTE.length];
}
