import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { AlertTriangle, RotateCw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // In a real app this would report to Sentry/Logflare etc.
    console.error("drea.mar caught a render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="panel max-w-md p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-800">Ceva nu a mers bine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Această secțiune a întâmpinat o eroare neașteptată. Restul datelor tale sunt în siguranță — aplicația funcționează în continuare.
            </p>
            <pre className="mt-4 max-h-28 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
              {this.state.error.message}
            </pre>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>Reîncarcă aplicația</Button>
              <Button variant="primary" onClick={this.reset}><RotateCw className="h-4 w-4" /> Încearcă din nou</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
