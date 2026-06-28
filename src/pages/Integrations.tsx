import { PageHeader, Button, Badge, Panel } from "@/components/ui";
import { PageSkeleton } from "@/components/Skeleton";
import { integrations } from "@/data/sample";
import { useToast } from "@/lib/toast";
import { useFakeLoad } from "@/lib/hooks";
import { Check, Plug, RefreshCw } from "lucide-react";

export default function Integrations() {
  const { push } = useToast();
  const loading = useFakeLoad();
  const connected = integrations.filter((i) => i.status === "connected").length;

  if (loading) return <PageSkeleton variant="grid" />;

  return (
    <>
      <PageHeader title="Integrări" subtitle={`${connected} din ${integrations.length} platforme conectate`}>
        <Button variant="outline" onClick={() => push({ tone: "success", title: "Se sincronizează toate platformele", description: `Se actualizează ${connected} surse conectate` })}><RefreshCw className="h-4 w-4" /> Sincronizează tot</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((i) => {
          const on = i.status === "connected";
          return (
            <Panel key={i.name} className="flex items-center gap-4 p-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${i.color} font-display text-base font-800 text-white`}>
                {i.name.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-700">{i.name}</p>
                  {on && <Check className="h-3.5 w-3.5 text-success" />}
                </div>
                <p className="text-xs text-muted-foreground">{i.note}</p>
              </div>
              {on ? (
                <Button variant="outline" size="sm" onClick={() => push({ tone: "info", title: "Integrările vin în curând", description: `Sincronizarea ${i.name} sosește odată cu motorul de integrări.` })}><RefreshCw className="h-3.5 w-3.5" /> Sincronizează</Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => push({ tone: "info", title: "Integrările vin în curând", description: `Conectarea ${i.name} sosește odată cu motorul de integrări.` })}><Plug className="h-3.5 w-3.5" /> Conectează</Button>
              )}
            </Panel>
          );
        })}
      </div>

      <Panel className="grid-bg flex flex-col items-center justify-center gap-3 p-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Plug className="h-5 w-5" /></span>
        <p className="font-display font-700">Ai nevoie de altă integrare?</p>
        <p className="max-w-md text-sm text-muted-foreground">Solicită un conector — Google Business, Pinterest, Snapchat, LinkedIn Ads și altele sunt pe foaia de parcurs.</p>
        <Button variant="outline" size="sm" onClick={() => push({ tone: "info", title: "Solicitare primită", description: "Te anunțăm când devine disponibilă" })}>Solicită integrare</Button>
      </Panel>
    </>
  );
}
