import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { AreaTrend, Donut } from "@/components/charts";
import { beautyCollabs, beautyKpis, beautyRetention, beautyServiceMix, beautyTreatments } from "@/data/sample";
import { Heart, Scissors, Sparkles, Users } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function BeautyDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Scissors}>Tablou de bord beauty</NicheTitle>
      <NicheKpis items={beautyKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Clienți și vizite repetate" subtitle="Total vs clienți care revin" icon={Users}>
          <AreaTrend data={beautyRetention} keys={[{ key: "clients", name: "Total clienți" }, { key: "repeat", name: "Care revin" }]} height={220} />
        </SectionCard>

        <SectionCard title="Mix de servicii" subtitle="Distribuția rezervărilor" icon={Heart}>
          <Donut data={beautyServiceMix} centerValue="284" centerLabel="rezervări" height={180} />
          <div className="mt-2 space-y-1.5">
            {beautyServiceMix.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#4F46E5", "#f5a524", "#f472b6", "#34d6a0"][i] }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-700">{s.value}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Top tratamente" icon={Sparkles}>
          <Table>
            <THead>
              <TH>Tratament</TH>
              <TH className="text-right">Rezervări</TH>
              <TH className="text-right">Venituri</TH>
              <TH className="text-right">Listă de așteptare</TH>
              <TH>Tendință</TH>
            </THead>
            <tbody>
              {beautyTreatments.map((t) => (
                <TR key={t.name}>
                  <TD className="font-600">{t.name}</TD>
                  <TD className="text-right">{t.bookings}</TD>
                  <TD className="text-right font-700">{t.revenue}</TD>
                  <TD className="text-right">{t.waitlist}</TD>
                  <TD><Badge tone="success">+{t.trend}%</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Colaborări cu influenceri" subtitle="Rezervări atribuite">
          <div className="space-y-2">
            {beautyCollabs.map((c) => (
              <div key={c.handle} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-xs font-800 text-white">
                    {c.handle[1]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-600">{c.handle}</p>
                    <p className="text-xs text-muted-foreground">{c.reach} acoperire</p>
                  </div>
                  <Badge tone="primary">+{c.bookings}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
