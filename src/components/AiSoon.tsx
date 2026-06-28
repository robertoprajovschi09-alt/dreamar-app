import { Link } from "react-router-dom";
import { PageHeader, Panel, Button } from "@/components/ui";
import { Sparkles } from "lucide-react";

/**
 * Live-mode placeholder for AI features that are not wired yet. Keeps the page
 * reachable (and honest) instead of showing mock/sample data in a real account.
 */
export function AiComingSoon({ title, subtitle, blurb }: { title: string; subtitle: string; blurb: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Panel className="mx-auto mt-4 flex max-w-lg flex-col items-center gap-3 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></span>
        <h2 className="font-display text-lg font-800">Funcție AI — în curând</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{blurb}</p>
        <Link to="/dashboard"><Button variant="outline" className="mt-1">Înapoi la tablou</Button></Link>
      </Panel>
    </>
  );
}
