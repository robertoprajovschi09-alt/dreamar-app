import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars } from "@/components/charts";
import { properties, realEstateFunnel, realEstateKpis, hooks } from "@/data/sample";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Building2, Home, Sparkles } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function RealEstateDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Building2}>Tablou de bord imobiliare</NicheTitle>
      <NicheKpis items={realEstateKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Proprietăți promovate" icon={Home}>
          <Table>
            <THead>
              <TH>Proprietate</TH>
              <TH>Preț</TH>
              <TH className="text-right">Vizualizări</TH>
              <TH className="text-right">Mesaje</TH>
              <TH className="text-right">Vizionări</TH>
              <TH className="text-right">Oferte</TH>
              <TH>Status</TH>
            </THead>
            <tbody>
              {properties.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <p className="font-600">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.type} · {p.area}</p>
                  </TD>
                  <TD className="font-600">{formatCurrency(p.price)}</TD>
                  <TD className="text-right">{formatNumber(p.views)}</TD>
                  <TD className="text-right">{p.messages}</TD>
                  <TD className="text-right">{p.viewings}</TD>
                  <TD className="text-right font-700">{p.offers}</TD>
                  <TD>
                    <Badge tone={p.status === "Reserved" ? "success" : p.status === "Negotiating" ? "warning" : "neutral"}>
                      {p.status}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Pâlnie de lead-uri" subtitle="Vizualizări → Oferte">
            <Bars data={realEstateFunnel} keys={[{ key: "value", name: "Număr (rel.)" }]} height={180} />
          </SectionCard>
          <SectionCard title="Top hook-uri" icon={Sparkles}>
            <div className="space-y-2">
              {hooks.slice(0, 3).map((h) => (
                <div key={h.id} className="rounded-lg border border-border p-2.5">
                  <p className="text-sm font-600 leading-snug">{h.text}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge tone="success">{h.avgScore}</Badge> {h.pattern}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
