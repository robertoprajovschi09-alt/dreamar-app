import { SectionCard, Badge, Progress } from "@/components/ui";
import { Table, THead, TH, TR, TD } from "@/components/table";
import { Bars } from "@/components/charts";
import { fitnessClasses, fitnessKpis, fitnessTrend, trainerContent, transformations } from "@/data/sample";
import { Dumbbell, Flame, TrendingUp, Users } from "lucide-react";
import { NicheKpis, NicheTitle } from "./shared";

export default function FitnessDashboard() {
  return (
    <div className="space-y-4">
      <NicheTitle icon={Dumbbell}>Tablou de bord fitness</NicheTitle>
      <NicheKpis items={fitnessKpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Abonamente și sesiuni de probă" subtitle="Influențate de conținut" icon={TrendingUp}>
          <Bars
            data={fitnessTrend}
            keys={[{ key: "memberships", name: "Abonamente vândute" }, { key: "trials", name: "Sesiuni de probă" }]}
            height={220}
          />
        </SectionCard>

        <SectionCard title="Promovare clase" icon={Flame}>
          <div className="space-y-3">
            {fitnessClasses.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-600">{c.name}</span>
                  <span className="text-muted-foreground">{c.signups} înscrieri</span>
                </div>
                <Progress value={c.fill} tone={c.fill > 85 ? "success" : c.fill > 65 ? "primary" : "warning"} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Performanța conținutului antrenorilor" icon={Users}>
          <Table>
            <THead>
              <TH>Antrenor</TH>
              <TH className="text-right">Postări</TH>
              <TH className="text-right">Vizualizări medii</TH>
              <TH>Format de top</TH>
            </THead>
            <tbody>
              {trainerContent.map((t) => (
                <TR key={t.trainer}>
                  <TD className="font-600">{t.trainer}</TD>
                  <TD className="text-right">{t.posts}</TD>
                  <TD className="text-right font-700">{t.avgViews}</TD>
                  <TD><Badge tone="primary">{t.topFormat}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </SectionCard>

        <SectionCard title="Conținut de transformare" subtitle="Povești de succes ale membrilor" icon={Flame}>
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-gradient-to-br from-primary/10 to-transparent p-3">
            <span className="font-display text-3xl font-800 text-primary">12</span>
            <span className="text-sm text-muted-foreground">povești de transformare postate luna aceasta</span>
          </div>
          <div className="space-y-2">
            {transformations.map((t) => (
              <div key={t.name} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-800 text-white">
                  {t.name.slice(0, 1)}
                </span>
                <span className="text-sm font-600">{t.name}</span>
                <span className="ml-auto text-xs text-success">{t.result}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
