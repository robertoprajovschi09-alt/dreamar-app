import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars } from "@/components/charts";
import { loungeDjs, loungeDoorFunnel, loungeKpis, loungeNights, loungeTraffic } from "@/data/sample";
import { Headphones, Music, Wine, Users } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function LoungeDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Wine}>Tablou de bord lounge</NicheTitle>
      <NicheKpis items={loungeKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Trafic săptămânal de clienți" subtitle="Media clienților pe seară" icon={Users}>
          <Bars data={loungeTraffic} keys={[{ key: "guests", name: "Clienți" }]} height={220} />
        </SectionCard>

        <SectionCard title="Pâlnie intrare → bar" subtitle="Acoperire conținut → consumatori fideli">
          <Bars data={loungeDoorFunnel} keys={[{ key: "value", name: "Clienți (rel.)" }]} height={220} />
          <div className="mt-3 rounded-lg bg-success/10 p-3 text-xs text-success">
            <Badge tone="success">46% conv.</Badge> Acoperire → au rămas peste o oră
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Cele mai bune seri" subtitle="Ultimele 4 săptămâni" icon={Music}>
          <Table>
            <THead>
              <TH>Seară</TH>
              <TH>Dată</TH>
              <TH className="text-right">Clienți</TH>
              <TH className="text-right">Venituri</TH>
            </THead>
            <tbody>
              {loungeNights.map((n) => (
                <TR key={n.name}>
                  <TD className="font-600">{n.name}</TD>
                  <TD className="text-muted-foreground">{n.date}</TD>
                  <TD className="text-right">{n.guests}</TD>
                  <TD className="text-right font-700">{n.revenue}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="DJ rezidenți" icon={Headphones}>
          <div className="space-y-2">
            {loungeDjs.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-600">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.sets} seturi · vârf {d.peakHr}</p>
                </div>
                <Badge tone="primary">Activ</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
