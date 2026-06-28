import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars } from "@/components/charts";
import { buyingIntentComments, menuCampaigns, restaurantDishes, restaurantEvents, restaurantKpis, restaurantTrend } from "@/data/sample";
import { CalendarHeart, MessageCircle, UtensilsCrossed, TrendingUp } from "lucide-react";
import { NicheKpis, NicheTitle, IntentRow } from "./shared";

const campaignTone = { Live: "success", Scheduled: "info", Ended: "neutral" } as const;

export default function RestaurantDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={UtensilsCrossed}>Tablou de bord restaurant</NicheTitle>
      <NicheKpis items={restaurantKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Rezervări și comenzi" subtitle="Pe săptămână — iunie 2026" icon={TrendingUp}>
          <Bars
            data={restaurantTrend}
            keys={[{ key: "reservations", name: "Rezervări" }, { key: "orders", name: "Comenzi online" }]}
            height={220}
          />
        </SectionCard>

        <SectionCard title="Cele mai populare preparate" icon={UtensilsCrossed}>
          <div className="space-y-2">
            {restaurantDishes.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-800 text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-600">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.orders} comenzi</p>
                </div>
                <Badge tone="success">+{d.trend}%</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Campanii de meniu">
          <Table>
            <THead>
              <TH>Campanie</TH>
              <TH>Status</TH>
              <TH className="text-right">Acoperire</TH>
              <TH className="text-right">Comenzi</TH>
            </THead>
            <tbody>
              {menuCampaigns.map((c) => (
                <TR key={c.name}>
                  <TD className="font-600">{c.name}</TD>
                  <TD><Badge tone={campaignTone[c.status as keyof typeof campaignTone]}>{c.status}</Badge></TD>
                  <TD className="text-right">{c.reach}</TD>
                  <TD className="text-right font-700">{c.orders || "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <p className="mb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Evenimente următoare</p>
            <div className="flex flex-wrap gap-2">
              {restaurantEvents.map((e) => (
                <div key={e.name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <CalendarHeart className="h-4 w-4 text-primary" />
                  <span className="font-600">{e.name}</span>
                  <span className="text-muted-foreground">· {e.date}</span>
                  <Badge tone="primary">{e.bookings} rezervate</Badge>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Comentarii cu intenție de cumpărare" icon={MessageCircle} action={<Badge tone="warning" dot>{buyingIntentComments.length}</Badge>}>
          <div className="space-y-2">
            {buyingIntentComments.map((c) => (
              <IntentRow key={c.text} text={c.text} handle={c.handle} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
