# drea.mar — Agency OS (front-end)

Premium multi-tenant AI SaaS for marketing agencies. This repo currently contains the **front-end dashboard layer** — the design system and all primary screens, built from the 9 reference screenshots (DataNest light SaaS + AI Content dark glass + PATH WOUNDED indigo). Backend (Supabase + Stripe + Claude AI) comes next.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Toggle **light / dark** with the sun-moon button in the top bar (or Settings → Appearance).

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** with HSL design tokens (light + dark) in `src/index.css`
- **recharts** for charts · **lucide-react** for icons · **react-router-dom** for routing

## Design system

- Violet/indigo primary, amber + green/red status accents (from the references)
- Tokens & themes: `src/index.css` (`:root` light, `.dark` dark)
- Primitives: `src/components/ui.tsx` (Button, Badge, Panel, SectionCard, Input, Segmented, EmptyState…)
- Charts: `src/components/charts.tsx` (theme-aware palettes) · KPI card: `src/components/StatCard.tsx`
- Shell: `src/components/layout/` (Sidebar, Topbar, AppShell) · Nav config: `src/lib/nav.ts`

## Screens (`src/pages/`)

| Route | Screen | Module |
|---|---|---|
| `/` | Agency Dashboard | KPIs, growth, portfolio health, AI alerts |
| `/clients` · `/clients/:id` | Client list + niche dashboard | Client Management, Niche dashboards (Real Estate detailed) |
| `/calendar` | Content Calendar | monthly grid, status pipeline |
| `/tasks` · `/approvals` | Tasks board, Approval workflow | Task Mgmt, Approvals |
| `/videos` | Video Performance Tracker | full metric table, AI score & rec |
| `/hooks` | Hook & Content Library | winning-pattern detection |
| `/impact` | Business Impact Tracker | manual inputs + revenue trend |
| `/strategy` | AI Strategy Room | grounded chat empty-state |
| `/reports` | AI Monthly Reports | editable sections, PDF/white-label |
| `/documents` | Document Library | folders, AI summaries |
| `/integrations` | Integrations | platform sync panel |
| `/billing` | Billing & Plan | hero + 4 EUR plans + usage |
| `/admin` | Admin Panel | cross-tenant agencies, MRR |
| `/settings` | Settings | profile, agency, white-label branding |
| `/portal` | Client Portal | client-facing view |

## Notes

- **No seeded data.** `src/data/sample.ts` is illustrative preview data only, to show the design populated. The real app will render live workspace data behind Supabase RLS, with the empty states already built.
- Next phase: Supabase schema + RLS multi-tenancy, Stripe subscriptions/limits, and Claude-powered AI (reports, Strategy Room, hook detection, health score).
