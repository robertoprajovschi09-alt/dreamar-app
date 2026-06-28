import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { AreaTrend, Donut } from "@/components/charts";
import { hotelChannels, hotelKpis, hotelOccupancy, hotelReviews, hotelRoomMix } from "@/data/sample";
import { BedDouble, Hotel, Star, TrendingUp } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function HotelDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Hotel}>Tablou de bord hotel</NicheTitle>
      <NicheKpis items={hotelKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Grad de ocupare și ADR" subtitle="Ultimele 6 luni" icon={TrendingUp}>
          <AreaTrend data={hotelOccupancy} keys={[{ key: "occupancy", name: "Ocupare %" }, { key: "adr", name: "ADR (€)" }]} height={220} />
        </SectionCard>

        <SectionCard title="Canale de rezervare" subtitle="Mix de surse">
          <Donut data={hotelChannels} centerValue="38%" centerLabel="direct" height={180} />
          <div className="mt-2 space-y-1.5">
            {hotelChannels.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#4F46E5", "#f5a524", "#f5803e", "#1fae7a"][i] }} />
                <span className="text-muted-foreground">{c.name}</span>
                <span className="ml-auto font-700">{c.value}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Performanță pe tip de cameră" icon={BedDouble}>
          <Table>
            <THead>
              <TH>Tip de cameră</TH>
              <TH className="text-right">Rezervări</TH>
              <TH className="text-right">Venituri</TH>
              <TH>Cerere</TH>
            </THead>
            <tbody>
              {hotelRoomMix.map((r) => {
                const max = Math.max(...hotelRoomMix.map((x) => x.bookings));
                const pct = Math.round((r.bookings / max) * 100);
                return (
                  <TR key={r.name}>
                    <TD className="font-600">{r.name}</TD>
                    <TD className="text-right">{r.bookings}</TD>
                    <TD className="text-right font-700">{r.revenue}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                          <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Recenzii ale oaspeților" icon={Star}>
          <div className="space-y-2">
            {hotelReviews.map((r, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <div className="mb-1 flex items-center gap-0.5">
                  {Array.from({ length: r.rating }).map((_, k) => <Star key={k} className="h-3 w-3 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />)}
                </div>
                <p className="text-sm leading-snug">"{r.text}"</p>
                <p className="mt-1 text-xs text-muted-foreground">— {r.guest}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
