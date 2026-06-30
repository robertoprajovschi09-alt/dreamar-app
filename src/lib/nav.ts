import {
  Anchor,
  CalendarDays,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  type LucideIcon,
  MessagesSquare,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
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

export type NavGroup = { heading: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    heading: "Spațiu de lucru",
    items: [
      { label: "Tablou de bord", to: "/dashboard", icon: LayoutDashboard, end: true },
      { label: "Clienți", to: "/clients", icon: Users, badge: 12 },
      { label: "Calendar de conținut", to: "/calendar", icon: CalendarDays },
      { label: "Campanii plătite", to: "/campaigns", icon: Megaphone },
      { label: "Sarcini", to: "/tasks", icon: ListTodo, badge: 4 },
      { label: "Aprobări", to: "/approvals", icon: ShieldCheck, badge: 3 },
    ],
  },
  {
    heading: "Inteligență",
    items: [
      { label: "Performanță video", to: "/videos", icon: Video },
      { label: "Bibliotecă de hook-uri", to: "/hooks", icon: Anchor },
      { label: "Impact în afacere", to: "/impact", icon: TrendingUp },
      { label: "Cameră de strategie AI", to: "/strategy", icon: Sparkles },
      { label: "Rapoarte lunare", to: "/reports", icon: FileText },
    ],
  },
  {
    heading: "Bibliotecă",
    items: [
      { label: "Documente", to: "/documents", icon: FolderOpen },
      { label: "Integrări", to: "/integrations", icon: Plug },
    ],
  },
  {
    heading: "Cont",
    items: [
      { label: "Facturare și plan", to: "/billing", icon: CreditCard },
      { label: "Setări", to: "/settings", icon: Settings },
    ],
  },
];
