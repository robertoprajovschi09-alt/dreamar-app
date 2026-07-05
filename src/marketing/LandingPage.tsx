import { Link } from "react-router-dom";

// Public landing for an internal tool: one sentence about what it is, one button
// into the app. No promises, no pricing, no superlatives.
export default function LandingPage() {
  return (
    <main className="grid min-h-[80vh] place-items-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="font-display text-2xl font-600 leading-snug md:text-3xl">
          Aplicația internă a agenției Dr Dream: clipuri, bani și obiective într-un singur loc.
        </h1>
        <div className="mt-8">
          <Link
            to="/dashboard"
            className="inline-block rounded-full bg-foreground px-6 py-3 text-sm font-500 text-background transition duration-200 motion-safe:hover:-translate-y-0.5"
          >
            Deschide aplicația
          </Link>
        </div>
      </div>
    </main>
  );
}
