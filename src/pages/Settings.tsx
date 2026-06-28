import { useEffect, useRef, useState } from "react";
import { PageHeader, Button, Panel, SectionCard, Input, Badge, Avatar, Segmented, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { useTheme } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/lib/toast";
import { supabase } from "@/lib/supabase";
import { Building2, Check, Copy, Loader2, Moon, Palette, RotateCcw, Sun, Trash2, User, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = { agency_owner: "Proprietar agenție", agency_team_member: "Membru echipă", content_creator: "Creator de conținut" };

const tabs = ["Profile", "Agency", "Branding", "Team", "Appearance"] as const;
const TAB_LABEL: Record<(typeof tabs)[number], string> = { Profile: "Profil", Agency: "Agenție", Branding: "Branding", Team: "Echipă", Appearance: "Aspect" };
const swatches = ["#4F46E5", "#f5803e", "#1fae7a", "#0ea5e9", "#e0556b", "#d4a017", "#111827"];

export default function Settings() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Profile");
  const { theme, setTheme } = useTheme();
  const { profile, setProfile, saveProfile, agencyInfo, setAgencyInfo, saveAgency, branding, setBranding, saveBranding, uploadLogo, uploadAvatar, currentAgency, live } = useWorkspace();
  const { push } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  async function save(key: string, fn: () => Promise<{ error?: string }>, okTitle: string, okDesc?: string) {
    setSaving(key);
    const { error } = await fn();
    setSaving(null);
    if (error) push({ tone: "danger", title: "Nu s-a putut salva", description: error });
    else push({ tone: "success", title: okTitle, description: okDesc });
  }
  async function pickUpload(key: string, file: File | undefined, fn: (f: File) => Promise<{ error?: string }>, okTitle: string) {
    if (!file) return;
    if (!live) { push({ tone: "info", title: "Doar în spațiul de lucru live", description: "Încărcarea imaginilor necesită un spațiu de lucru Supabase live." }); return; }
    setSaving(key);
    const { error } = await fn(file);
    setSaving(null);
    if (error) push({ tone: "danger", title: "Încărcare eșuată", description: error });
    else push({ tone: "success", title: okTitle });
  }

  return (
    <>
      <PageHeader title="Setări" subtitle="Gestionează-ți contul, agenția și brandingul white-label — modificările se păstrează după reîncărcare" />

      <Segmented value={tab} onChange={setTab} options={tabs.map((t) => ({ label: TAB_LABEL[t], value: t }))} />

      {tab === "Profile" && (
        <SectionCard title="Profilul tău" icon={User}>
          <div className="flex items-center gap-4">
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickUpload("avatar", e.target.files?.[0], uploadAvatar, "Fotografie actualizată"); e.target.value = ""; }} />
            <Avatar name={profile.name || "?"} src={profile.avatarUrl || undefined} size={64} />
            <Button variant="outline" size="sm" disabled={saving === "avatar"} onClick={() => avatarRef.current?.click()}>{saving === "avatar" && <Loader2 className="h-4 w-4 animate-spin" />} Schimbă fotografia</Button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nume complet"><Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} /></Field>
            <Field label={live ? "Email (autentificare)" : "Email"}><Input value={profile.email} disabled={live} onChange={(e) => setProfile({ email: e.target.value })} /></Field>
            <Field label="Rol"><Input value={profile.role} disabled /></Field>
            <Field label="Telefon"><Input value={profile.phone} placeholder="+40 ..." onChange={(e) => setProfile({ phone: e.target.value })} /></Field>
          </div>
          <div className="mt-5"><Button variant="primary" disabled={saving === "profile"} onClick={() => save("profile", saveProfile, "Profil salvat")}>{saving === "profile" && <Loader2 className="h-4 w-4 animate-spin" />} Salvează modificările</Button></div>
        </SectionCard>
      )}

      {tab === "Agency" && (
        <SectionCard title="Detalii agenție" icon={Building2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nume agenție"><Input value={agencyInfo.name} onChange={(e) => setAgencyInfo({ name: e.target.value })} /></Field>
            <Field label="Website"><Input value={agencyInfo.website} onChange={(e) => setAgencyInfo({ website: e.target.value })} /></Field>
            <Field label="Oraș"><Input value={agencyInfo.city} onChange={(e) => setAgencyInfo({ city: e.target.value })} /></Field>
            <Field label="Plan"><Input value={currentAgency.plan} disabled /></Field>
          </div>
          <div className="mt-5"><Button variant="primary" disabled={saving === "agency"} onClick={() => save("agency", saveAgency, "Detalii agenție salvate")}>{saving === "agency" && <Loader2 className="h-4 w-4 animate-spin" />} Salvează modificările</Button></div>
        </SectionCard>
      )}

      {tab === "Branding" && (
        <SectionCard title="Branding white-label" icon={Palette} subtitle="Alege o culoare de brand și vezi cum se recolorează toată aplicația — se păstrează după reîncărcare">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-700 text-muted-foreground">Logo agenție</p>
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { pickUpload("logo", e.target.files?.[0], uploadLogo, "Logo actualizat"); e.target.value = ""; }} />
              <button onClick={() => logoRef.current?.click()} disabled={saving === "logo"} className="grid h-28 w-full place-items-center gap-1 rounded-xl border border-dashed border-border bg-muted/30 p-2 text-sm text-muted-foreground transition hover:border-primary/40">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="Logo agenție" className="max-h-20 max-w-full object-contain" />
                ) : saving === "logo" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Încarcă logo (PNG/SVG)</>
                )}
              </button>
              {branding.logoUrl && <button onClick={() => logoRef.current?.click()} className="mt-1.5 text-xs font-600 text-primary hover:underline">Înlocuiește logo</button>}
            </div>
            <div>
              <p className="mb-2 text-xs font-700 text-muted-foreground">Culoare de brand</p>
              <div className="flex flex-wrap gap-2">
                {swatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBranding({ brandColor: c })}
                    className={cn("grid h-10 w-10 place-items-center rounded-lg ring-2 transition", branding.brandColor === c ? "ring-foreground" : "ring-transparent hover:ring-border")}
                    style={{ background: c }}
                  >
                    {branding.brandColor === c && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
                <button
                  onClick={() => setBranding({ brandColor: null })}
                  className={cn("flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-600 transition", !branding.brandColor ? "border-foreground" : "border-border hover:bg-muted")}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Implicit
                </button>
              </div>
              <div className="mt-4">
                <Field label="Domeniu personalizat"><Input value={branding.customDomain} placeholder="rapoarte.agentiata.ro" onChange={(e) => setBranding({ customDomain: e.target.value })} /></Field>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Button variant="primary" disabled={saving === "branding"} onClick={() => save("branding", saveBranding, "Branding salvat", branding.brandColor ? "Culoarea de brand a fost aplicată în toată aplicația" : "Se folosește culoarea implicită a temei")}>{saving === "branding" && <Loader2 className="h-4 w-4 animate-spin" />} Salvează brandingul</Button>
            <Badge tone="primary">Gata de white-label</Badge>
          </div>
        </SectionCard>
      )}

      {tab === "Team" && <TeamTab />}

      {tab === "Appearance" && (
        <SectionCard title="Aspect" icon={Palette}>
          <p className="mb-3 text-sm text-muted-foreground">Alege cum arată drea.mar pentru tine. Preferința ta este reținută.</p>
          <div className="grid grid-cols-2 gap-4 sm:max-w-md">
            <button onClick={() => setTheme("light")} className={cn("rounded-xl border-2 p-4 text-left transition", theme === "light" ? "border-primary" : "border-border")}>
              <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-[#f7f7fb]"><Sun className="h-6 w-6 text-amber-500" /></div>
              <p className="text-sm font-700">Luminos</p>
            </button>
            <button onClick={() => setTheme("dark")} className={cn("rounded-xl border-2 p-4 text-left transition", theme === "dark" ? "border-primary" : "border-border")}>
              <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-[#0d0b16]"><Moon className="h-6 w-6 text-indigo-400" /></div>
              <p className="text-sm font-700">Întunecat</p>
            </button>
          </div>
        </SectionCard>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

type Member = { id: string; name: string; email: string; role: string };

const DEMO_MEMBERS: Member[] = [
  { id: "d1", name: "Robert Casco", email: "robert@cascodent.ro", role: "agency_owner" },
  { id: "d2", name: "Ana Mihai", email: "ana@novacreative.ro", role: "agency_team_member" },
  { id: "d3", name: "Marius L.", email: "marius@novacreative.ro", role: "content_creator" },
];

function TeamTab() {
  const { live, currentAgency, agencyReady } = useWorkspace();
  const { push } = useToast();
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function reload() {
    if (!live || !supabase || !currentAgency.id) { setMembers(DEMO_MEMBERS); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("agency_members")
      .select("id, role, profile:profiles!agency_members_profile_id_fkey(full_name, email)")
      .eq("agency_id", currentAgency.id);
    setLoading(false);
    if (error) { push({ tone: "danger", title: "Nu s-a putut încărca echipa", description: error.message }); return; }
    const order: Record<string, number> = { agency_owner: 0, agency_team_member: 1, content_creator: 2 };
    setMembers(
      (data ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => ({ id: m.id, name: m.profile?.full_name || m.profile?.email || "Invitație în așteptare", email: m.profile?.email || "", role: m.role as string }))
        .sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
    );
  }

  useEffect(() => {
    if (!live) { setMembers(DEMO_MEMBERS); return; }
    if (agencyReady && currentAgency.id) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, agencyReady, currentAgency.id]);

  async function removeMember(m: Member) {
    if (m.role === "agency_owner") return;
    setMembers((p) => p.filter((x) => x.id !== m.id));
    if (live && supabase) {
      const { error } = await supabase.from("agency_members").delete().eq("id", m.id);
      if (error) { push({ tone: "danger", title: "Nu s-a putut elimina", description: error.message }); reload(); return; }
    }
    push({ tone: "warning", title: "Membru eliminat", description: m.name });
  }

  return (
    <>
      <SectionCard title="Membrii echipei" icon={Users} action={<Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invită</Button>}>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se încarcă echipa…</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="group flex items-center gap-3 py-3">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-600">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Badge tone={m.role === "agency_owner" ? "primary" : "neutral"}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                {m.role !== "agency_owner" && (
                  <button onClick={() => removeMember(m)} title="Elimină membru" className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{live ? "Doar proprietarul agenției poate invita sau elimina membri. Numărul de locuri este limitat de planul tău." : "2 din 3 locuri folosite pe planul Growth."}</p>
      </SectionCard>
      <InviteMemberModal open={inviteOpen} onClose={() => setInviteOpen(false)} live={live} onInvited={reload} />
    </>
  );
}

function InviteMemberModal({ open, onClose, live, onInvited }: { open: boolean; onClose: () => void; live: boolean; onInvited: () => void }) {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agency_team_member");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string | null; existing: boolean } | null>(null);

  function close() { setEmail(""); setRole("agency_team_member"); setResult(null); onClose(); }

  async function submit() {
    if (!email.trim()) return;
    if (!live || !supabase) { push({ tone: "info", title: "Doar în spațiul de lucru live", description: "Invitațiile în echipă necesită un spațiu de lucru Supabase live." }); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("invite-team-member", { body: { email: email.trim(), role } });
    setBusy(false);
    if (error || data?.error) { push({ tone: "danger", title: "Invitație eșuată", description: data?.error || error?.message || "Eroare necunoscută" }); return; }
    setResult({ email: data.email, password: data.password ?? null, existing: !!data.existing });
    onInvited();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Invită un membru în echipă"
      subtitle="Va primi acces la spațiul de lucru al acestei agenții"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>Gata</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Anulează</Button>
            <Button variant="primary" disabled={busy || !email.trim()} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Trimite invitația</Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm">{result.existing ? <>Utilizatorul existent <b>{result.email}</b> a fost adăugat în agenția ta.</> : <>L-ai invitat pe <b>{result.email}</b>. Distribuie aceste date de acces temporare:</>}</p>
          {result.password && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Parolă temporară</span>
                <button onClick={() => { navigator.clipboard?.writeText(result.password!); push({ tone: "success", title: "Copiat" }); }} className="flex items-center gap-1 text-xs font-700 text-primary"><Copy className="h-3.5 w-3.5" /> Copiază</button>
              </div>
              <code className="mt-1 block font-mono text-sm">{result.password}</code>
              <p className="mt-2 text-xs text-muted-foreground">Roagă-l să o schimbe după prima autentificare.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Adresă de email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="coleg@agentie.ro" /></Field>
          <Field label="Rol"><Select value={role} onChange={(e) => setRole(e.target.value)}><option value="agency_team_member">Membru echipă</option><option value="content_creator">Creator de conținut</option></Select></Field>
        </div>
      )}
    </Modal>
  );
}
