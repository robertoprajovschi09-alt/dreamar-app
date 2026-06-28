import { SectionCard, Badge, Progress } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars } from "@/components/charts";
import { localStoreClickCollect, localStoreKpis, localStorePromos, localStoreSkus, localStoreTraffic } from "@/data/sample";
import { Footprints, Package, Store, Ticket } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function LocalStoreDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Store}>Tablou de bord magazin local</NicheTitle>
      <NicheKpis items={localStoreKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Trafic în magazin și tranzacții" subtitle="Săptămânal — iunie 2026" icon={Footprints}>
          <Bars data={localStoreTraffic} keys={[{ key: "visits", name: "Vizite" }, { key: "transactions", name: "Tranzacții" }]} height={220} />
        </SectionCard>

        <SectionCard title="Online → în magazin" subtitle="Adopția click & collect">
          <Bars data={localStoreClickCollect} keys={[{ key: "online", name: "Comenzi online" }, { key: "instore", name: "Ridicări în magazin" }]} height={220} />
          <p className="mt-2 text-xs text-muted-foreground">Conversie ridicare: <span className="font-700 text-foreground">+40% față de luna trecută</span></p>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Top SKU-uri" icon={Package}>
          <Table>
            <THead>
              <TH>Produs</TH>
              <TH className="text-right">Unități</TH>
              <TH className="text-right">Venituri</TH>
              <TH>Tendință</TH>
            </THead>
            <tbody>
              {localStoreSkus.map((s) => (
                <TR key={s.sku}>
                  <TD className="font-600">{s.sku}</TD>
                  <TD className="text-right">{s.units}</TD>
                  <TD className="text-right font-700">{s.revenue}</TD>
                  <TD>
                    <Badge tone={s.trend >= 0 ? "success" : "danger"}>
                      {s.trend >= 0 ? "+" : ""}{s.trend}%
                    </Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Promoții active" icon={Ticket}>
          <div className="space-y-3">
            {localStorePromos.map((p) => {
              const pct = parseInt(p.conv);
              return (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-600">{p.name}</span>
                    <span className="text-muted-foreground">{p.redemptions} utilizări</span>
                  </div>
                  <Progress value={pct * 5} tone={pct > 15 ? "success" : pct > 8 ? "primary" : "warning"} />
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.conv} conversie</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
