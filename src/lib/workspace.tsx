import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, storageUpload, storagePublicUrl } from "./supabase";
import { useAuth, PENDING_AGENCY_KEY } from "./auth";

export type Agency = { id: string; name: string; plan: string; initials: string; gradient: string };

export type Profile = { name: string; email: string; phone: string; role: string; avatarUrl?: string };
export type Branding = { brandColor: string | null; customDomain: string; logoUrl?: string };
export type AgencyInfo = { name: string; website: string; city: string };
export type ClientNotes = { objectives: string[]; feedback: string };

export const DEFAULT_OBJECTIVES = [
  "Generează 40+ lead-uri calificate",
  "Convertește 2 oferte de valoare mare",
  "Crește platforma principală cu 15%",
  "Scade costul pe lead",
];

type WorkspaceState = {
  agencies: Agency[];
  currentAgencyId: string;
  currentAgency: Agency;
  switchAgency: (id: string) => void;
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  saveProfile: () => Promise<{ error?: string }>;
  agencyInfo: AgencyInfo;
  setAgencyInfo: (a: Partial<AgencyInfo>) => void;
  saveAgency: () => Promise<{ error?: string }>;
  branding: Branding;
  setBranding: (b: Partial<Branding>) => void;
  saveBranding: () => Promise<{ error?: string }>;
  uploadLogo: (file: File) => Promise<{ error?: string }>;
  uploadAvatar: (file: File) => Promise<{ error?: string }>;
  objectivesFor: (clientId: string) => string[];
  addObjective: (clientId: string, text: string) => void;
  removeObjective: (clientId: string, idx: number) => void;
  applyObjectivesToAll: (clientIds: string[], objectives: string[]) => void;
  feedbackFor: (clientId: string) => string;
  setClientFeedback: (clientId: string, text: string) => void;
  // True once the agency is known (always true in demo; in live, after the
  // user's agency loads/provisions). Pages that hit the DB wait on this.
  agencyReady: boolean;
  live: boolean;
  // Platform (SaaS) admin — gates the cross-tenant Admin panel.
  isSaasAdmin: boolean;
  // True for a platform admin with no agency of their own — renders the
  // standalone admin control room instead of the agency app.
  isPlatformAdmin: boolean;
  // Client-viewer mode: a signed-in user linked to ONE client (no agency).
  // They see only the client portal, never the agency app.
  isViewer: boolean;
  viewerClientId: string;
  viewerClientName: string;
  viewerAgencyName: string;
  viewerNiche: string;
  viewerOnboarded: boolean;
  refreshViewer: () => void;
};

const defaultAgencies: Agency[] = [
  { id: "nova", name: "Nova Creative", plan: "Agenție Growth", initials: "NV", gradient: "from-amber-400 to-orange-500" },
  { id: "peak", name: "Peak Studio", plan: "Agenție Unlimited", initials: "PK", gradient: "from-indigo-500 to-indigo-600" },
  { id: "halo", name: "Halo Media", plan: "White Label Pro", initials: "HM", gradient: "from-sky-500 to-cyan-400" },
];

const GRADIENTS = ["from-amber-400 to-orange-500", "from-indigo-500 to-indigo-600", "from-sky-500 to-cyan-400", "from-emerald-500 to-teal-500"];
const TIER_LABEL: Record<string, string> = {
  starter: "Agenție Starter", growth: "Agenție Growth", unlimited: "Agenție Unlimited", white_label_pro: "White Label Pro",
};

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 6);
  return (base.length >= 2 ? base : "agency") + "-" + suffix;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbAgency(a: any, i: number): Agency {
  const name: string = a?.name ?? "Agenție";
  return {
    id: a.id,
    name,
    plan: TIER_LABEL[a.current_plan_tier] ?? "Agenție Starter",
    initials: name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "AG",
    gradient: GRADIENTS[i % GRADIENTS.length],
  };
}

const KEY = "dreamar-workspace";

function load<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const persisted = load({
    currentAgencyId: "nova",
    profile: { name: "Robert Casco", email: "robert@cascodent.ro", phone: "", role: "Proprietar agenție" } as Profile,
    agencyInfo: { name: "Nova Creative", website: "novacreative.ro", city: "Cluj-Napoca" } as AgencyInfo,
    branding: { brandColor: null, customDomain: "" } as Branding,
    clientData: {
      altmark: {
        objectives: ["Generează 40+ cereri de vizionare calificate", "Vinde 2 unități Altmark Garden", "Crește TikTok la 25k urmăritori", "Menține costul pe lead sub 6€"],
        feedback: "",
      },
    } as Record<string, ClientNotes>,
  });

  const [agencies] = useState(defaultAgencies);
  const [currentAgencyId, setCurrentAgencyId] = useState(persisted.currentAgencyId);
  const [profile, setProfileState] = useState<Profile>(persisted.profile);
  const [agencyInfo, setAgencyInfoState] = useState<AgencyInfo>(persisted.agencyInfo);
  const [branding, setBrandingState] = useState<Branding>(persisted.branding);
  const [clientData, setClientData] = useState<Record<string, ClientNotes>>(persisted.clientData);

  const { user, mode } = useAuth();
  const liveMode = mode === "live";
  const [liveAgencies, setLiveAgencies] = useState<Agency[]>([]);
  const [liveCurrentId, setLiveCurrentId] = useState<string | null>(null);
  const [agencyReady, setAgencyReady] = useState(false);
  const [isSaasAdmin, setIsSaasAdmin] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [viewer, setViewer] = useState<{ clientId: string; clientName: string; agencyName: string; niche: string; onboardedAt: string | null } | null>(null);
  // Full agency rows (incl. editable fields) keyed for Settings seeding.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [liveAgencyRows, setLiveAgencyRows] = useState<any[]>([]);

  // LIVE: load the signed-in user's agency, provisioning it (from the name
  // captured at signup) on first run. Runs only when Supabase is configured.
  useEffect(() => {
    if (!liveMode) { setAgencyReady(true); return; }
    if (!user || !supabase) { setAgencyReady(false); return; }
    let active = true;
    (async () => {
      setAgencyReady(false);
      const loadRows = () =>
        supabase!
          .from("agency_members")
          .select("agency:agencies(id, name, city, website, brand_color, custom_domain, logo_url, current_plan_tier)")
          .eq("profile_id", user.id);
      const first = await loadRows();
      // A read error must NOT be treated as "no agency" — provisioning then
      // would create a DUPLICATE agency for an existing user. Bail and let a
      // reload retry instead.
      if (first.error) {
        console.error("[workspace] membership read failed:", first.error.message);
        if (active) setAgencyReady(true);
        return;
      }
      let rows = first.data ?? [];
      if (rows.length === 0) {
        // No agency membership — a client VIEWER (linked via client_users) must
        // NOT trigger agency provisioning. A viewer can have MULTIPLE links
        // (invited to a second client) and links to archived clients, so never
        // use maybeSingle() here: with >1 row it errors, cu.data comes back
        // null, and the invited client would fall through into agency
        // provisioning. Pick the newest non-archived link instead.
        const cu = await supabase!
          .from("client_users")
          .select("client_id, created_at, client:clients(name, niche, onboarding_completed_at, archived_at, agency:agencies(name))")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false });
        if (cu.error) {
          // Same rule as the membership read: an error is NOT "no viewer" —
          // provisioning here would hand an invited client a whole agency.
          console.error("[workspace] viewer read failed:", cu.error.message);
          if (active) setAgencyReady(true);
          return;
        }
        const links = cu.data ?? [];
        if (links.length > 0) {
          if (!active) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c: any = links.find((l: any) => !l.client?.archived_at) ?? links[0];
          setViewer({ clientId: c.client_id, clientName: c.client?.name ?? "Brandul tău", agencyName: c.client?.agency?.name ?? "", niche: c.client?.niche ?? "custom", onboardedAt: c.client?.onboarding_completed_at ?? null });
          setProfileState((p) => ({ ...p, name: user.name, email: user.email, role: "Vizualizator client" }));
          setAgencyReady(true);
          return; // client viewer — never provision an agency
        }
        // Platform (SaaS) admin — no agency, no client. Render the admin control
        // room directly; NEVER provision an agency for them.
        const adm = await supabase!.from("profiles").select("is_saas_admin").eq("id", user.id).maybeSingle();
        if (adm.data?.is_saas_admin) {
          if (!active) return;
          setIsSaasAdmin(true);
          setPlatformAdmin(true);
          setProfileState((p) => ({ ...p, name: user.name, email: user.email, role: "Admin platformă" }));
          setAgencyReady(true);
          return;
        }
        const pendingKey = `${PENDING_AGENCY_KEY}:${(user.email || "").trim().toLowerCase()}`;
        const pending = localStorage.getItem(pendingKey) || localStorage.getItem(PENDING_AGENCY_KEY) || `${user.name}'s Agency`;
        const { error: rpcErr } = await supabase!.rpc("create_agency_with_owner", { p_name: pending, p_slug: slugify(pending) });
        if (rpcErr) {
          // Keep the pending name so a reload can retry; don't mark "ready with no agency" silently failed.
          console.error("[workspace] agency provisioning failed:", rpcErr.message);
          if (active) setAgencyReady(true);
          return;
        }
        localStorage.removeItem(pendingKey);
        localStorage.removeItem(PENDING_AGENCY_KEY);
        const re = await loadRows();
        rows = re.data ?? [];
      }
      if (!active) return;
      setViewer(null); // confirmed agency membership — not a viewer
      setPlatformAdmin(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ags = rows.map((r: any) => r.agency).filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = ags.map((a: any, i: number) => mapDbAgency(a, i)).filter((a: Agency) => a.id);
      setLiveAgencyRows(ags);
      setLiveAgencies(mapped);
      setLiveCurrentId((cur) => (cur && mapped.some((a) => a.id === cur) ? cur : mapped[0]?.id ?? null));
      // Seed the editable profile (phone from profiles; name/email from auth).
      const prof = (await supabase!.from("profiles").select("phone, is_saas_admin, avatar_url").eq("id", user.id).maybeSingle()).data;
      if (!active) return;
      setProfileState((p) => ({ ...p, name: user.name, email: user.email, role: prof?.is_saas_admin ? "Admin platformă" : "Proprietar agenție", phone: prof?.phone ?? "", avatarUrl: prof?.avatar_url ?? "" }));
      setIsSaasAdmin(!!prof?.is_saas_admin);
      setAgencyReady(true);
    })();
    return () => { active = false; };
  }, [liveMode, user?.id]);

  // LIVE: seed the editable agency + branding fields from the selected agency.
  useEffect(() => {
    if (!liveMode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = liveAgencyRows.find((a: any) => a.id === liveCurrentId);
    if (!cur) return;
    setAgencyInfoState({ name: cur.name, website: cur.website ?? "", city: cur.city ?? "" });
    setBrandingState({ brandColor: cur.brand_color ?? null, customDomain: cur.custom_domain ?? "", logoUrl: cur.logo_url ?? "" });
  }, [liveMode, liveCurrentId, liveAgencyRows]);

  // LIVE: keep name/email in sync with the auth user immediately (no DB wait),
  // so the topbar never flashes a previous session's identity.
  useEffect(() => {
    if (!liveMode || !user) return;
    // Only sync identity here — the ROLE is owned by the membership effect
    // (viewer/admin roles were being overwritten back to "Proprietar agenție").
    setProfileState((p) => ({ ...p, name: user.name, email: user.email }));
  }, [liveMode, user?.id, user?.name, user?.email]);

  // Persist everything that should survive reloads.
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ currentAgencyId, profile, agencyInfo, branding, clientData }));
  }, [currentAgencyId, profile, agencyInfo, branding, clientData]);

  const updateClient = (id: string, fn: (c: ClientNotes) => ClientNotes) =>
    setClientData((prev) => ({ ...prev, [id]: fn(prev[id] ?? { objectives: DEFAULT_OBJECTIVES, feedback: "" }) }));

  // Apply the brand color app-wide (overrides the theme's --primary when set).
  useEffect(() => {
    const root = document.documentElement;
    if (branding.brandColor) {
      const hsl = hexToHsl(branding.brandColor);
      if (hsl) {
        root.style.setProperty("--primary", hsl);
        root.style.setProperty("--ring", hsl);
      }
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    }
  }, [branding.brandColor]);

  // Effective workspace: live agency/profile when signed in to Supabase,
  // otherwise the demo data.
  const fallback: Agency = {
    id: "", name: liveMode ? (agencyReady ? "Agenția ta" : "Se încarcă…") : "Nova Creative",
    plan: "Agenție Starter", initials: "··", gradient: GRADIENTS[1],
  };
  const effAgencies = liveMode ? liveAgencies : agencies;
  const effCurrentId = liveMode ? (liveCurrentId ?? "") : currentAgencyId;
  const currentAgency = effAgencies.find((a) => a.id === effCurrentId) ?? effAgencies[0] ?? fallback;

  const refreshViewer = async () => {
    if (!liveMode || !supabase || !viewer?.clientId) return;
    const { data } = await supabase.from("clients").select("onboarding_completed_at").eq("id", viewer.clientId).maybeSingle();
    setViewer((v) => (v ? { ...v, onboardedAt: data?.onboarding_completed_at ?? v.onboardedAt } : v));
  };

  const value: WorkspaceState = {
    agencies: effAgencies,
    currentAgencyId: currentAgency.id,
    currentAgency,
    switchAgency: liveMode ? (id) => setLiveCurrentId(id) : setCurrentAgencyId,
    profile,
    setProfile: (p) => setProfileState((prev) => ({ ...prev, ...p })),
    saveProfile: async () => {
      if (!liveMode || !supabase || !user) return {};
      const { error } = await supabase.from("profiles").update({ full_name: profile.name, phone: profile.phone || null }).eq("id", user.id);
      if (error) return { error: error.message };
      await supabase.auth.updateUser({ data: { full_name: profile.name } });
      return {};
    },
    agencyInfo,
    setAgencyInfo: (a) => setAgencyInfoState((prev) => ({ ...prev, ...a })),
    saveAgency: async () => {
      if (!liveMode || !supabase) return {};
      const id = currentAgency.id;
      if (!id) return { error: "Nicio agenție selectată" };
      const { error } = await supabase.from("agencies").update({ name: agencyInfo.name, website: agencyInfo.website || null, city: agencyInfo.city || null }).eq("id", id);
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLiveAgencyRows((rows) => rows.map((a: any) => (a.id === id ? { ...a, name: agencyInfo.name, website: agencyInfo.website, city: agencyInfo.city } : a)));
      setLiveAgencies((ags) => ags.map((a) => (a.id === id ? { ...a, name: agencyInfo.name, initials: agencyInfo.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "AG" } : a)));
      return {};
    },
    branding,
    setBranding: (b) => setBrandingState((prev) => ({ ...prev, ...b })),
    saveBranding: async () => {
      if (!liveMode || !supabase) return {};
      const id = currentAgency.id;
      if (!id) return { error: "Nicio agenție selectată" };
      const { error } = await supabase.from("agencies").update({ brand_color: branding.brandColor, custom_domain: branding.customDomain || null }).eq("id", id);
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLiveAgencyRows((rows) => rows.map((a: any) => (a.id === id ? { ...a, brand_color: branding.brandColor, custom_domain: branding.customDomain } : a)));
      return {};
    },
    uploadLogo: async (file) => {
      if (!liveMode || !supabase || !currentAgency.id) return {};
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `agency/${currentAgency.id}/logo-${crypto.randomUUID()}.${ext}`;
      const up = await storageUpload("branding", path, file);
      if (up.error) return { error: up.error };
      const url = storagePublicUrl("branding", path);
      const { error } = await supabase.from("agencies").update({ logo_url: url }).eq("id", currentAgency.id);
      if (error) return { error: error.message };
      setBrandingState((b) => ({ ...b, logoUrl: url }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLiveAgencyRows((rows) => rows.map((a: any) => (a.id === currentAgency.id ? { ...a, logo_url: url } : a)));
      return {};
    },
    uploadAvatar: async (file) => {
      if (!liveMode || !supabase || !user) return {};
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `avatar/${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await storageUpload("branding", path, file);
      if (up.error) return { error: up.error };
      const url = storagePublicUrl("branding", path);
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) return { error: error.message };
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setProfileState((p) => ({ ...p, avatarUrl: url }));
      return {};
    },
    objectivesFor: (id) => clientData[id]?.objectives ?? DEFAULT_OBJECTIVES,
    addObjective: (id, text) => updateClient(id, (c) => ({ ...c, objectives: [...c.objectives, text] })),
    removeObjective: (id, idx) => updateClient(id, (c) => ({ ...c, objectives: c.objectives.filter((_, i) => i !== idx) })),
    applyObjectivesToAll: (ids, objs) =>
      setClientData((prev) => {
        const next = { ...prev };
        ids.forEach((id) => { next[id] = { objectives: [...objs], feedback: prev[id]?.feedback ?? "" }; });
        return next;
      }),
    feedbackFor: (id) => clientData[id]?.feedback ?? "",
    setClientFeedback: (id, text) => updateClient(id, (c) => ({ ...c, feedback: text })),
    agencyReady: liveMode ? agencyReady : true,
    live: liveMode,
    isSaasAdmin: liveMode ? isSaasAdmin : true,
    isPlatformAdmin: liveMode ? platformAdmin : false,
    isViewer: liveMode && !!viewer,
    viewerClientId: viewer?.clientId ?? "",
    viewerClientName: viewer?.clientName ?? "",
    viewerAgencyName: viewer?.agencyName ?? "",
    viewerNiche: viewer?.niche ?? "custom",
    viewerOnboarded: liveMode ? !!viewer?.onboardedAt : true,
    refreshViewer,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
