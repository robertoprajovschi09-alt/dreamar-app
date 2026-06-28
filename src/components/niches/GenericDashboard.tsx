import { SectionCard, Badge, Button } from "@/components/ui";
import { AreaTrend } from "@/components/charts";
import { growthTrend, nicheLabels, type Client } from "@/data/sample";
import { LayoutGrid, Plus, Sliders } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

// The generic, config-driven template used by niches without a bespoke dashboard yet.
const genericMetrics = [
  { label: "Lead-uri / Solicitări", value: "—", sub: "adaugă luna aceasta" },
  { label: "Rezervări", value: "—", sub: "adaugă luna aceasta" },
  { label: "Impact venituri", value: "—", sub: "adaugă luna aceasta" },
  { label: "Acoperire", value: "—", sub: "din platformele conectate" },
];

export default function GenericDashboard({ client }: { client: Client }) {
  return (
    <div className="space-y-4">
      <NicheTitle icon={LayoutGrid}>Tablou de bord {nicheLabels[client.niche]}</NicheTitle>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-3 text-sm">
        <Sliders className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">
          Această nișă folosește <span className="font-700 text-foreground">șablonul bazat pe configurare</span>. Metricile, formularele și secțiunile din rapoarte sunt definite per nișă — fără modificări de schemă.
        </span>
        <Button variant="soft" size="sm" className="ml-auto"><Plus className="h-3.5 w-3.5" /> Configurează metricile</Button>
      </div>

      <NicheKpis items={genericMetrics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Acoperire și interacțiune" subtitle="Din platformele conectate">
          <AreaTrend data={growthTrend} keys={[{ key: "reach", name: "Acoperire (K)" }, { key: "followers", name: "Urmăritori (K)" }]} height={220} />
        </SectionCard>

        <SectionCard title="Metrici personalizate" icon={Plus}>
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sliders className="h-5 w-5" /></span>
            <p className="text-sm font-700">Definește ce contează pentru {nicheLabels[client.niche]}</p>
            <p className="max-w-[200px] text-xs text-muted-foreground">Adaugă metrici, formulare și secțiuni de raport adaptate acestui client.</p>
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Adaugă metrică</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
