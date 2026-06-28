import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { AreaTrend, Bars } from "@/components/charts";
import { autoFunnel, autoInventory, autoKpis, autoSalesTrend, autoTradeIn } from "@/data/sample";
import { formatCurrency } from "@/lib/utils";
import { Car, FileSignature, Gauge, Key } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

const statusTone = { Hot: "success", Active: "primary", Aging: "warning" } as const;
const tradeTone = { Accepted: "success", Counter: "warning", Pending: "neutral" } as const;

export default function AutoDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Car}>Tablou de bord auto</NicheTitle>
      <NicheKpis items={autoKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Stoc și cerere" icon={Gauge}>
          <Table>
            <THead>
              <TH>Vehicul</TH>
              <TH className="text-right">Preț</TH>
              <TH className="text-right">Zile în stoc</TH>
              <TH className="text-right">Test drive-uri</TH>
              <TH className="text-right">Lead-uri</TH>
              <TH>Status</TH>
            </THead>
            <tbody>
              {autoInventory.map((v) => (
                <TR key={v.name}>
                  <TD className="font-600">{v.name}</TD>
                  <TD className="text-right font-700">{formatCurrency(v.price)}</TD>
                  <TD className="text-right">{v.daysOnLot}</TD>
                  <TD className="text-right">{v.testDrives}</TD>
                  <TD className="text-right">{v.leads}</TD>
                  <TD><Badge tone={statusTone[v.status as keyof typeof statusTone]}>{v.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Pâlnie de lead-uri" subtitle="Interesat → Vândut" icon={Key}>
          <Bars data={autoFunnel} keys={[{ key: "value", name: "Cumpărători" }]} height={200} />
          <p className="mt-2 text-xs text-muted-foreground">Rată de finalizare după test drive: <span className="font-700 text-foreground">17.7%</span></p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Vânzări și lead-uri — ultimele 5 luni" subtitle="Atribuite conținutului">
          <AreaTrend data={autoSalesTrend} keys={[{ key: "leads", name: "Lead-uri" }, { key: "sold", name: "Vândute" }]} height={220} />
        </SectionCard>

        <SectionCard title="Mașini la schimb" icon={FileSignature}>
          <div className="space-y-2">
            {autoTradeIn.map((t) => (
              <div key={t.make} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <p className="flex-1 text-sm font-600">{t.make}</p>
                  <Badge tone={tradeTone[t.status as keyof typeof tradeTone]}>{t.status}</Badge>
                </div>
                <p className="mt-1 pl-6 text-xs text-muted-foreground">Ofertat <span className="font-700 text-foreground">{t.offer}</span></p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
