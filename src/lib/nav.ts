import {
  Anchor,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  FolderOpen,
  ListTodo,
  type LucideIcon,
  Megaphone,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string | number;
  end?: boolean;
};

export type NavGroup = { heading?: string; items: NavItem[] };

// Agency OS — five workspaces. Everything else is reached inside a client,
// inside a workspace, or via ⌘K (see `allDestinations`).
export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Săptămâna", to: "/dashboard", icon: Target, end: true },
      { label: "Clienți", to: "/clients", icon: Users, badge: 12 },
      { label: "Conținut", to: "/content", icon: CalendarDays },
      { label: "Aprobări", to: "/approvals", icon: ShieldCheck, badge: 3 },
      { label: "Agenție", to: "/agency", icon: Building2 },
    ],
  },
];

// Full destination list for the command palette (⌘K) — the slim sidebar never
// limits reach. Includes the sub-pages that now live inside workspaces/clients.
export const allDestinations: NavItem[] = [
  { label: "Săptămâna", to: "/dashboard", icon: Target, end: true },
  { label: "Clienți", to: "/clients", icon: Users },
  { label: "Conținut", to: "/content", icon: CalendarDays },
  { label: "Aprobări", to: "/approvals", icon: ShieldCheck },
  { label: "Agenție", to: "/agency", icon: Building2 },
  { label: "Calendar de conținut", to: "/calendar", icon: CalendarDays },
  { label: "Sarcini", to: "/tasks", icon: ListTodo },
  { label: "Bibliotecă de hook-uri", to: "/hooks", icon: Anchor },
  { label: "Performanță video", to: "/videos", icon: Video },
  { label: "Impact în afacere", to: "/impact", icon: TrendingUp },
  { label: "Campanii plătite", to: "/campaigns", icon: Megaphone },
  { label: "Documente", to: "/documents", icon: FolderOpen },
  { label: "Rapoarte lunare", to: "/reports", icon: FileText },
  { label: "Cameră de strategie AI", to: "/strategy", icon: Sparkles },
  { label: "Integrări", to: "/integrations", icon: Plug },
  { label: "Facturare și plan", to: "/billing", icon: CreditCard },
  { label: "Setări", to: "/settings", icon: Settings },
];
