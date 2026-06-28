import { useTheme } from "@/lib/theme";
import { useWorkspace, hexToHsl } from "@/lib/workspace";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* Theme-aware palettes pulled from the reference screenshots */
export function usePalette() {
  const { theme } = useTheme();
  const { branding } = useWorkspace();
  const dark = theme === "dark";
  // The primary data series follows the agency's brand color (falls back to the theme default).
  const brandHsl = branding.brandColor ? hexToHsl(branding.brandColor) : null;
  const brand = brandHsl ? `hsl(${brandHsl})` : dark ? "#7E78F5" : "#4F46E5";
  return {
    dark,
    series: dark
      ? [brand, "#34d6a0", "#5cd1f0", "#fbbf3f", "#a78bfa"]
      : [brand, "#1fae7a", "#3b82f6", "#f59e0b", "#8b6cf0"],
    primary: brand,
    grid: dark ? "rgba(255,255,255,0.06)" : "rgba(20,18,40,0.06)",
    axis: dark ? "#8b86a6" : "#8a87a0",
    success: dark ? "#34d6a0" : "#1fae7a",
    danger: dark ? "#f87186" : "#e0556b",
  };
}

function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-card">
      {label != null && <p className="mb-1 font-700">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-700">
            {prefix}
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Area trend ------------------------------ */
export function AreaTrend({
  data,
  keys,
  height = 240,
  prefix = "",
}: {
  data: any[];
  keys: { key: string; name: string }[];
  height?: number;
  prefix?: string;
}) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k.key} id={`area-${k.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.series[i]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={p.series[i]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={p.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: p.axis, fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: p.axis, fontSize: 11 }} width={44} />
        <Tooltip content={<ChartTooltip prefix={prefix} />} />
        {keys.map((k, i) => (
          <Area
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.name}
            stroke={p.series[i]}
            strokeWidth={2.4}
            fill={`url(#area-${k.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------- Bars ----------------------------------- */
export function Bars({
  data,
  keys,
  height = 260,
  stacked = false,
  prefix = "",
}: {
  data: any[];
  keys: { key: string; name: string }[];
  height?: number;
  stacked?: boolean;
  prefix?: string;
}) {
  const p = usePalette();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={p.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: p.axis, fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: p.axis, fontSize: 11 }} width={44} />
        <Tooltip cursor={{ fill: p.grid }} content={<ChartTooltip prefix={prefix} />} />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.name}
            stackId={stacked ? "a" : undefined}
            fill={p.series[i]}
            radius={stacked ? [0, 0, 0, 0] : [6, 6, 0, 0]}
            maxBarSize={38}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------ Donut gauge ----------------------------- */
export function Donut({
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const p = usePalette();
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={3} cornerRadius={6} startAngle={90} endAngle={-270}>
            {data.map((_, i) => (
              <Cell key={i} fill={p.series[i % p.series.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="font-display text-2xl font-800">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Radial score ----------------------------- */
export function RadialScore({ value, height = 200, label }: { value: number; height?: number; label?: string }) {
  const p = usePalette();
  const tone = value >= 75 ? p.success : value >= 50 ? p.series[1] : p.danger;
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value }]} startAngle={220} endAngle={-40}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: p.grid }} dataKey="value" cornerRadius={20} fill={tone} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-800" style={{ color: tone }}>
          {value}
        </span>
        {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/* --------------------------- Mini sparkline ----------------------------- */
export function Sparkline({ data, tone, height = 40 }: { data: number[]; tone?: string; height?: number }) {
  const p = usePalette();
  const color = tone ?? p.primary;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#spark-${color})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
