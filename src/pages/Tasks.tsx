import { useEffect, useState } from "react";
import { PageHeader, Button, Badge, Panel, Avatar, Input, Select } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import { useWorkspace } from "@/lib/workspace";
import { useClients } from "@/lib/clients";
import { supabase } from "@/lib/supabase";
import { tasks as seed } from "@/data/sample";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LIVE_COLS = [
  { key: "todo", title: "De făcut", tone: "neutral" },
  { key: "in_progress", title: "În lucru", tone: "info" },
  { key: "blocked", title: "Blocat", tone: "warning" },
  { key: "done", title: "Gata", tone: "success" },
] as const;
const DEMO_COLS = [
  { key: "todo", title: "De făcut", tone: "neutral" },
  { key: "in_progress", title: "În lucru", tone: "info" },
  { key: "overdue", title: "Întârziat", tone: "danger" },
  { key: "done", title: "Gata", tone: "success" },
] as const;

const prTone: Record<string, string> = { low: "neutral", medium: "warning", high: "danger", urgent: "danger" };
const TASK_TYPES = ["planning", "scripting", "filming", "editing", "design", "reporting", "approval", "meeting", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

type Task = { id: string; title: string; client: string; clientId: string; type: string; priority: string; status: string; assignee: string; assignedTo: string; due: string; rawDeadline: string; overdue?: boolean };
type TaskInput = { title: string; clientId: string; type: string; priority: string; deadline: string; assignedTo: string };

export default function Tasks() {
  const { push } = useToast();
  const { live, currentAgency, agencyReady, profile } = useWorkspace();
  const { clients } = useClients();
  const agencyId = currentAgency.id;
  const [tasks, setTasks] = useState<Task[]>(live ? [] : (seed as unknown as Task[]));
  const [loading, setLoading] = useState(live);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [myId, setMyId] = useState("");
  const columns = live ? LIVE_COLS : DEMO_COLS;

  async function reload() {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, task_type, priority, status, deadline, client_id, assigned_to, client:clients(name), assignee:profiles!tasks_assigned_to_fkey(full_name)")
      .eq("agency_id", agencyId).neq("status", "archived").order("created_at", { ascending: false });
    if (error) console.error("[tasks] load failed:", error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (data) setTasks(data.map((r: any) => {
      const overdue = !!r.deadline && new Date(r.deadline) < new Date() && r.status !== "done";
      return { id: r.id, title: r.title, client: r.client?.name ?? "", clientId: r.client_id ?? "", type: r.task_type, priority: r.priority, status: r.status, assignee: r.assignee?.full_name ?? "", assignedTo: r.assigned_to ?? "", due: r.deadline ? new Date(r.deadline).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—", rawDeadline: r.deadline ? String(r.deadline).slice(0, 10) : "", overdue };
    }));
    setLoading(false);
  }

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, agencyReady, agencyId]);

  // Load the agency's team so tasks can be assigned to a specific member.
  useEffect(() => {
    if (!live || !supabase || !agencyId) { setMembers([]); return; }
    let active = true;
    (async () => {
      const [{ data: u }, { data }] = await Promise.all([
        supabase!.auth.getUser(),
        supabase!.from("agency_members").select("profile_id, profile:profiles!agency_members_profile_id_fkey(full_name, email)").eq("agency_id", agencyId),
      ]);
      if (!active) return;
      setMyId(u.user?.id ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers((data ?? []).map((m: any) => ({ id: m.profile_id, name: m.profile?.full_name || m.profile?.email || "Membru" })));
    })();
    return () => { active = false; };
  }, [live, agencyId]);

  async function moveTo(status: string) {
    if (!draggingId) return;
    const t = tasks.find((x) => x.id === draggingId);
    setDraggingId(null); setOverCol(null);
    if (!t || t.status === status) return;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status, overdue: status === "done" ? false : x.overdue } : x)));
    if (live && supabase) {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", t.id);
      if (error) { push({ tone: "danger", title: "Sarcina nu a putut fi mutată", description: error.message }); void reload(); return; }
    }
    const col = columns.find((c) => c.key === status);
    push({ tone: status === "done" ? "success" : "info", title: "Sarcină mutată", description: `${t.title} → ${col?.title}` });
  }

  async function createTask(input: TaskInput) {
    if (!live || !supabase || !agencyId) {
      const t: Task = { id: "demo-" + Date.now(), title: input.title, client: clients.find((c) => c.id === input.clientId)?.name ?? "", clientId: input.clientId, type: input.type, priority: input.priority, status: "todo", assignee: members.find((m) => m.id === input.assignedTo)?.name ?? profile.name, assignedTo: input.assignedTo, due: input.deadline ? new Date(input.deadline).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—", rawDeadline: input.deadline };
      setTasks((prev) => [t, ...prev]);
      return {};
    }
    const { error } = await supabase.from("tasks").insert({ agency_id: agencyId, client_id: input.clientId || null, title: input.title, task_type: input.type, priority: input.priority, status: "todo", deadline: input.deadline || null, assigned_to: input.assignedTo || null });
    if (error) return { error: error.message };
    await reload();
    return {};
  }

  async function updateTask(id: string, input: TaskInput) {
    if (!live || !supabase || !agencyId) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: input.title, clientId: input.clientId, client: clients.find((c) => c.id === input.clientId)?.name ?? "", type: input.type, priority: input.priority, assignedTo: input.assignedTo, assignee: members.find((m) => m.id === input.assignedTo)?.name ?? t.assignee, due: input.deadline ? new Date(input.deadline).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) : "—", rawDeadline: input.deadline } : t)));
      return {};
    }
    const { error } = await supabase.from("tasks").update({ client_id: input.clientId || null, title: input.title, task_type: input.type, priority: input.priority, deadline: input.deadline || null, assigned_to: input.assignedTo || null }).eq("id", id);
    if (error) return { error: error.message };
    await reload();
    return {};
  }

  async function deleteTask(id: string, title: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id)); // optimistic
    if (live && supabase) {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) { push({ tone: "danger", title: "Sarcina nu a putut fi ștearsă", description: error.message }); void reload(); return; }
    }
    push({ tone: "warning", title: "Sarcină ștearsă", description: title });
  }

  if (loading) return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  return (
    <>
      <PageHeader title="Sarcini" subtitle="Trage cardurile între coloane pentru a actualiza statusul">
        <Button variant="primary" onClick={() => setComposerOpen(true)} disabled={live && !agencyId}><Plus className="h-4 w-4" /> Sarcină nouă</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const items = tasks.filter((t) => t.status === col.key || (col.key === "overdue" && t.overdue && t.status !== "done"));
          const isOver = overCol === col.key && draggingId;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => moveTo(col.key)}
              className={cn("flex flex-col gap-3 rounded-xl p-1 transition", isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40")}
            >
              <div className="flex items-center justify-between px-2 pt-1">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Badge tone={col.tone as any} dot>{col.title}</Badge>
                <span className="text-xs font-700 text-muted-foreground">{items.length}</span>
              </div>
              <div className="min-h-[80px] space-y-3">
                {items.map((t) => (
                  <Panel
                    key={t.id}
                    draggable
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => { setDraggingId(null); setOverCol(null); }}
                    onClick={() => setEditingTask(t)}
                    className={cn("group cursor-grab p-4 transition hover:shadow-glow active:cursor-grabbing", draggingId === t.id && "opacity-40")}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Badge tone={prTone[t.priority] as any}>{t.priority}</Badge>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t.type}
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(t.id, t.title); }} className="opacity-0 transition hover:text-danger group-hover:opacity-100" title="Șterge sarcina"><Trash2 className="h-3.5 w-3.5" /></button>
                        <GripVertical className="h-3.5 w-3.5 opacity-40" />
                      </span>
                    </div>
                    <p className="text-sm font-600 leading-snug">{t.title}</p>
                    {t.client && <p className="mt-1 text-xs text-muted-foreground">{t.client}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={t.assignee || "?"} size={24} />
                        <span className="text-xs text-muted-foreground">{t.assignee ? t.assignee.split(" ")[0] : "Neasignat"}</span>
                      </div>
                      <Badge tone={t.overdue ? "danger" : "neutral"}>{t.due}</Badge>
                    </div>
                  </Panel>
                ))}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Trage aici</div>}
              </div>
            </div>
          );
        })}
      </div>

      <TaskComposer open={composerOpen || !!editingTask} editing={editingTask} onClose={() => { setComposerOpen(false); setEditingTask(null); }} clients={clients} members={members} myId={myId}
        onSubmit={async (input) => {
          const res = editingTask ? await updateTask(editingTask.id, input) : await createTask(input);
          if (res.error) push({ tone: "danger", title: editingTask ? "Sarcina nu a putut fi actualizată" : "Sarcina nu a putut fi creată", description: res.error });
          else push({ tone: "success", title: editingTask ? "Sarcină actualizată" : "Sarcină creată", description: input.title });
          return res;
        }} />
    </>
  );
}

function TaskComposer({ open, editing, onClose, clients, members, myId, onSubmit }: {
  open: boolean; editing: Task | null; onClose: () => void; clients: { id: string; name: string }[];
  members: { id: string; name: string }[]; myId: string;
  onSubmit: (input: TaskInput) => Promise<{ error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (editing) { setTitle(editing.title); setClientId(editing.clientId); setType(editing.type); setPriority(editing.priority); setDeadline(editing.rawDeadline); setAssignedTo(editing.assignedTo); setBusy(false); }
    else { setTitle(""); setClientId(""); setType("other"); setPriority("medium"); setDeadline(""); setAssignedTo(myId); setBusy(false); }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const res = await onSubmit({ title: title.trim(), clientId, type, priority, deadline, assignedTo });
    setBusy(false);
    if (!res.error) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? "Editează sarcina" : "Sarcină nouă"} subtitle={editing ? "Actualizează această sarcină" : "Adaugă o sarcină pe board"} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={busy || !title.trim()} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Salvează modificările" : "Creează sarcina"}</Button></>}>
      <div className="space-y-4">
        <TField label="Titlu"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Scrie scriptul pentru turul proprietății" /></TField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TField label="Client (opțional)"><Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full"><option value="">Intern / niciunul</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></TField>
          <TField label="Termen limită (opțional)"><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></TField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TField label="Tip"><Select value={type} onChange={(e) => setType(e.target.value)} className="w-full">{TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></TField>
          <TField label="Prioritate"><Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full">{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></TField>
        </div>
        {members.length > 1 && (
          <TField label="Responsabil"><Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full"><option value="">Neasignat</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></TField>
        )}
      </div>
    </Modal>
  );
}

function TField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-700 text-muted-foreground">{label}</p>{children}</div>;
}
