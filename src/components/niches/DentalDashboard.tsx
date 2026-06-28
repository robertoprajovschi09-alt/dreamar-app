import { SectionCard, Badge } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars, Donut } from "@/components/charts";
import { dentalConversion, dentalFunnel, dentalKpis, dentalObjections, dentalTreatments } from "@/data/sample";
import { Activity, Stethoscope, ShieldAlert } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

const convTone = { High: "success", Medium: "warning", Low: "danger" } as const;

export default function DentalDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Stethoscope}>Tablou de bord clinică stomatologică</NicheTitle>
      <NicheKpis items={dentalKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Tratamente promovate" icon={Activity}>
          <Table>
            <THead>
              <TH>Tratament</TH>
              <TH className="text-right">Lead-uri calificate</TH>
              <TH>Interes pentru tratament</TH>
              <TH>Conversie</TH>
            </THead>
            <tbody>
              {dentalTreatments.map((t) => (
                <TR key={t.name}>
                  <TD className="font-600">{t.name}</TD>
                  <TD className="text-right font-700">{t.leads}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                        <div className="h-full gradient-primary" style={{ width: `${t.interest}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{t.interest}%</span>
                    </div>
                  </TD>
                  <TD><Badge tone={convTone[t.conversion as keyof typeof convTone]}>{t.conversion}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Conversie pacienți" subtitle="Distribuție status lead-uri">
          <Donut data={dentalConversion} centerValue="84" centerLabel="lead-uri" height={180} />
          <div className="mt-2 space-y-2">
            {dentalConversion.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ["#4F46E5", "#f5a524", "#f5803e"][i] }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-700">{d.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Pâlnie lead → pacient" subtitle="Lead-uri → Programate → Prezentate → Convertite">
          <Bars data={dentalFunnel} keys={[{ key: "value", name: "Pacienți" }]} height={200} />
        </SectionCard>

        <SectionCard title="Obiecții auzite" icon={ShieldAlert} action={<Badge tone="danger" dot>{dentalObjections.length}</Badge>}>
          <div className="space-y-2">
            {dentalObjections.map((o) => (
              <div key={o} className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                {o}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
