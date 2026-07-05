import {
  Building2,
  CalendarDays,
  Clapperboard,
  ScrollText,
  Settings,
  Skull,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string | number;
  end?: boolean;
};

export type NavGroup = { heading?: string; items: NavItem[] };

// The nav inventory is LOCKED by the constitution to exactly these nine.
// Nothing else may appear in the sidebar, the mobile "Mai mult" sheet, or ⌘K.
export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Azi", to: "/dashboard", icon: Target, end: true },
      { label: "Pipeline", to: "/pipeline", icon: Clapperboard },
      { label: "Bani", to: "/money", icon: Wallet },
      { label: "Clienți", to: "/clients", icon: Users },
      { label: "Calendar", to: "/calendar", icon: CalendarDays },
      { label: "Scripturi", to: "/scripts", icon: ScrollText },
      { label: "Kill List", to: "/kill-list", icon: Skull },
      { label: "Agenție", to: "/agency", icon: Building2 },
      { label: "Setări", to: "/settings", icon: Settings },
    ],
  },
];

// The command palette reaches exactly the locked inventory — no more.
export const allDestinations: NavItem[] = navGroups[0].items;
