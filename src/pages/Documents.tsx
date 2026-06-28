import { useEffect, useRef, useState } from "react";
import { PageHeader, Button, Badge, Panel, SearchInput, Input, Select, Progress } from "@/components/ui";
import { Modal } from "@/components/overlay";
import { PageSkeleton } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import { useWorkspace } from "@/lib/workspace";
import { supabase, storageUpload, storageRemove, storageSignedUrl } from "@/lib/supabase";
import { Download, File, FileText, FolderPlus, Image as ImageIcon, Loader2, Pencil, Sparkles, Trash2, Upload, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type DocType = "pdf" | "image" | "video" | "file";
type Doc = { id: string; name: string; type: DocType; size: string; tags: string[]; folderId: string | null; storagePath: string; date: string };
type Folder = { id: string; name: string };

const icon: Record<DocType, typeof FileText> = { pdf: FileText, video: Video, image: ImageIcon, file: File };
const iconTone: Record<DocType, string> = { pdf: "text-danger bg-danger/10", video: "text-primary bg-primary/10", image: "text-info bg-info/10", file: "text-muted-foreground bg-muted" };

// ---- Demo fallback data ----
const demoFolders: Folder[] = [
  { id: "brand", name: "Materiale de brand" }, { id: "briefs", name: "Brief-uri" }, { id: "footage", name: "Material brut" }, { id: "contracts", name: "Contracte" },
];
const demoDocs: Doc[] = [
  { id: "d1", name: "Ghid de brand Altmark.pdf", type: "pdf", size: "4.2 MB", tags: ["brand"], folderId: "brand", storagePath: "", date: "2 iun. 2026" },
  { id: "d2", name: "Brief campanie iunie.pdf", type: "pdf", size: "1.1 MB", tags: ["brief"], folderId: "briefs", storagePath: "", date: "1 iun. 2026" },
  { id: "d3", name: "Tur proprietate — brut.mp4", type: "video", size: "820 MB", tags: ["material brut"], folderId: "footage", storagePath: "", date: "16 iun. 2026" },
  { id: "d4", name: "Logo — principal.png", type: "image", size: "240 KB", tags: ["brand"], folderId: "brand", storagePath: "", date: "2 iun. 2026" },
  { id: "d5", name: "Contract de colaborare.pdf", type: "pdf", size: "320 KB", tags: ["juridic"], folderId: "contracts", storagePath: "", date: "10 ian. 2026" },
];

function docType(mime: string | null): DocType {
  if (!mime) return "file";
  if (mime.includes("pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function fmtSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const typeMap: Record<string, DocType> = { PDF: "pdf", Video: "video", Image: "image" };

export default function Documents() {
  const { push } = useToast();
  const { live, currentAgency, agencyReady } = useWorkspace();
  const agencyId = currentAgency.id;
  const [folders, setFolders] = useState<Folder[]>(live ? [] : demoFolders);
  const [docs, setDocs] = useState<Doc[]>(live ? [] : demoDocs);
  const [loading, setLoading] = useState(live);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [activeFolder, setActiveFolder] = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [q, setQ] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFolderId, setEditFolderId] = useState("");
  const [editTags, setEditTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) { setEditName(selected.name); setEditFolderId(selected.folderId ?? ""); setEditTags(selected.tags.join(", ")); }
  }, [selected]);

  async function reload() {
    if (!live || !supabase || !agencyId) return;
    setLoading(true);
    const [f, d] = await Promise.all([
      supabase.from("folders").select("id, name").eq("agency_id", agencyId).is("client_id", null).order("name"),
      supabase.from("documents").select("id, folder_id, storage_path, filename, mime_type, size_bytes, tags, created_at").eq("agency_id", agencyId).order("created_at", { ascending: false }),
    ]);
    if (f.error) console.error("[documents] folders:", f.error.message); else if (f.data) setFolders(f.data.map((r) => ({ id: r.id, name: r.name })));
    if (d.error) console.error("[documents] docs:", d.error.message);
    else if (d.data) setDocs(d.data.map((r) => ({
      id: r.id, name: r.filename, type: docType(r.mime_type), size: fmtSize(r.size_bytes), tags: r.tags ?? [],
      folderId: r.folder_id, storagePath: r.storage_path,
      date: new Date(r.created_at).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }),
    })));
    setLoading(false);
  }

  useEffect(() => {
    if (!live) { setLoading(false); return; }
    if (!agencyReady || !agencyId) { setLoading(true); return; }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, agencyReady, agencyId]);

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!live || !supabase || !agencyId) {
      push({ tone: "info", title: "Mod demo", description: "Autentifică-te într-un workspace live pentru a încărca fișiere reale." });
      return;
    }
    const folderId = activeFolder === "all" ? null : activeFolder;
    for (const file of Array.from(files)) {
      setUploading({ name: file.name, pct: 40 });
      const path = `${agencyId}/_agency/${crypto.randomUUID()}`;
      const up = await storageUpload("documents", path, file);
      if (up.error) { push({ tone: "danger", title: "Încărcarea a eșuat", description: `${file.name}: ${up.error}` }); continue; }
      setUploading({ name: file.name, pct: 85 });
      const ins = await supabase.from("documents").insert({ agency_id: agencyId, folder_id: folderId, storage_path: path, filename: file.name, mime_type: file.type || null, size_bytes: file.size });
      if (ins.error) { push({ tone: "danger", title: "Nu s-a putut salva fișierul", description: ins.error.message }); await storageRemove("documents", path); continue; }
    }
    setUploading(null);
    push({ tone: "success", title: "Încărcare finalizată", description: `${files.length} ${files.length === 1 ? "fișier încărcat" : "fișiere încărcate"}` });
    await reload();
  }

  async function saveFolder() {
    const name = folderName.trim();
    if (!name) return;
    const renaming = renamingId;
    setNewFolderOpen(false); setFolderName(""); setRenamingId(null);
    if (!live || !supabase || !agencyId) {
      if (renaming) setFolders((p) => p.map((f) => (f.id === renaming ? { ...f, name } : f)));
      else setFolders((p) => [...p, { id: "demo-" + name, name }]);
      return;
    }
    const q = renaming
      ? supabase.from("folders").update({ name }).eq("id", renaming)
      : supabase.from("folders").insert({ agency_id: agencyId, name });
    const { error } = await q;
    if (error) { push({ tone: "danger", title: renaming ? "Nu s-a putut redenumi folderul" : "Nu s-a putut crea folderul", description: error.message }); return; }
    push({ tone: "success", title: renaming ? "Folder redenumit" : "Folder creat", description: name });
    await reload();
  }

  async function deleteFolder(id: string, name: string) {
    if (activeFolder === id) setActiveFolder("all");
    setFolders((p) => p.filter((f) => f.id !== id));
    setDocs((p) => p.map((d) => (d.folderId === id ? { ...d, folderId: null } : d))); // FK on delete sets null
    if (live && supabase) {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) { push({ tone: "danger", title: "Nu s-a putut șterge folderul", description: error.message }); await reload(); return; }
    }
    push({ tone: "warning", title: "Folder șters", description: name });
  }

  async function download(d: Doc) {
    if (!live || !supabase || !d.storagePath) { push({ tone: "info", title: "Descărcare", description: "Disponibilă pentru fișierele încărcate într-un workspace live." }); return; }
    const { url, error } = await storageSignedUrl("documents", d.storagePath, 60);
    if (error || !url) { push({ tone: "danger", title: "Nu s-a putut obține fișierul", description: error }); return; }
    window.open(url, "_blank");
  }

  async function remove(d: Doc) {
    setSelected(null);
    if (!live || !supabase) { setDocs((p) => p.filter((x) => x.id !== d.id)); return; }
    if (d.storagePath) await storageRemove("documents", d.storagePath);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) { push({ tone: "danger", title: "Nu s-a putut șterge", description: error.message }); return; }
    push({ tone: "warning", title: "Fișier șters", description: d.name });
    await reload();
  }

  async function saveDoc() {
    if (!selected) return;
    const name = editName.trim() || selected.name;
    const folderId = editFolderId || null;
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    const id = selected.id;
    setDocs((p) => p.map((d) => (d.id === id ? { ...d, name, folderId, tags } : d)));
    setSelected(null);
    if (live && supabase) {
      const { error } = await supabase.from("documents").update({ filename: name, folder_id: folderId, tags }).eq("id", id);
      if (error) { push({ tone: "danger", title: "Nu s-au putut salva modificările", description: error.message }); await reload(); return; }
    }
    push({ tone: "success", title: "Fișier actualizat", description: name });
  }

  const docsInFolder = (id: string) => docs.filter((d) => d.folderId === id).length;
  const visibleFiles = docs.filter((f) => {
    if (activeFolder !== "all" && f.folderId !== activeFolder) return false;
    if (typeFilter !== "All" && f.type !== typeMap[typeFilter]) return false;
    if (q && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (loading) return <PageSkeleton variant="grid" />;

  return (
    <>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
      <PageHeader title="Bibliotecă de documente" subtitle="Fișiere de brand, brief-uri și material video — stocate privat per agenție">
        <Button variant="outline" onClick={() => { setRenamingId(null); setFolderName(""); setNewFolderOpen(true); }}><FolderPlus className="h-4 w-4" /> Folder nou</Button>
        <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={live && !agencyId}><Upload className="h-4 w-4" /> Încarcă</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <Panel className="h-fit p-3">
          <p className="px-2 pb-2 text-xs font-700 uppercase tracking-wide text-muted-foreground">Foldere</p>
          <div className="space-y-0.5">
            <FolderButton label="Toate fișierele" count={docs.length} active={activeFolder === "all"} onClick={() => setActiveFolder("all")} />
            {folders.map((f) => (
              <FolderButton key={f.id} label={f.name} count={docsInFolder(f.id)} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)}
                onRename={() => { setRenamingId(f.id); setFolderName(f.name); setNewFolderOpen(true); }}
                onDelete={() => deleteFolder(f.id, f.name)} />
            ))}
            {folders.length === 0 && <p className="px-2.5 py-2 text-xs text-muted-foreground">Încă niciun folder.</p>}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <SearchInput placeholder="Caută documente…" className="sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-1.5 sm:ml-auto">
              {[["All", "Toate"], ["PDF", "PDF"], ["Video", "Video"], ["Image", "Imagini"]].map(([t, label]) => (
                <button key={t} onClick={() => setTypeFilter(t)} className={cn("rounded-full px-3 py-1.5 text-xs font-600 transition", typeFilter === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>{label}</button>
              ))}
            </div>
          </Panel>

          <button onClick={() => fileRef.current?.click()} className="grid-bg flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-center transition hover:border-primary/40">
            {uploading ? (
              <div className="w-full max-w-sm">
                <div className="mb-2 flex items-center gap-2 text-sm font-600"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Se încarcă {uploading.name}… {uploading.pct}%</div>
                <Progress value={uploading.pct} />
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-600">Apasă pentru a încărca</p>
                <p className="text-xs text-muted-foreground">PDF-uri, imagini, video și fișiere de brand · stocate privat în workspace-ul tău</p>
              </>
            )}
          </button>

          {visibleFiles.length === 0 ? (
            <Panel className="py-12 text-center text-sm text-muted-foreground">{docs.length === 0 ? "Încă niciun document — încarcă primul tău fișier." : "Niciun document nu corespunde acestui filtru."}</Panel>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFiles.map((f) => {
                const Icon = icon[f.type];
                return (
                  <button key={f.id} onClick={() => setSelected(f)} className="panel p-4 text-left transition hover:-translate-y-0.5 hover:shadow-glow">
                    <div className="flex items-start gap-3">
                      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", iconTone[f.type])}><Icon className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-600">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.size} · {f.date}</p>
                      </div>
                    </div>
                    {f.tags.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5">{f.tags.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={selected ? `${selected.size} · ${selected.date}` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="ghost" className="text-danger" onClick={() => selected && remove(selected)}><Trash2 className="h-4 w-4" /> Șterge</Button>
            <Button variant="outline" className="ml-auto" onClick={() => selected && download(selected)}><Download className="h-4 w-4" /> Descarcă</Button>
            <Button variant="primary" onClick={saveDoc}>Salvează modificările</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className={cn("grid h-36 place-items-center rounded-xl", iconTone[selected.type])}>
              {(() => { const I = icon[selected.type]; return <I className="h-12 w-12 opacity-70" />; })()}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-700 text-muted-foreground">Nume fișier</p>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-700 text-muted-foreground">Folder</p>
                <Select value={editFolderId} onChange={(e) => setEditFolderId(e.target.value)}>
                  <option value="">Fără folder</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-700 text-muted-foreground">Etichete (separate prin virgulă)</p>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="brand, juridic" />
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /> Rezumatele AI sosesc odată cu motorul de rapoarte.</div>
          </div>
        )}
      </Modal>

      <Modal open={newFolderOpen} onClose={() => { setNewFolderOpen(false); setFolderName(""); setRenamingId(null); }} title={renamingId ? "Redenumește folderul" : "Folder nou"} size="sm"
        footer={<><Button variant="ghost" onClick={() => { setNewFolderOpen(false); setFolderName(""); setRenamingId(null); }}>Anulează</Button><Button variant="primary" className="ml-auto" disabled={!folderName.trim()} onClick={saveFolder}>{renamingId ? "Redenumește" : "Creează folder"}</Button></>}>
        <Input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="ex. Materiale de brand" onKeyDown={(e) => { if (e.key === "Enter") saveFolder(); }} />
      </Modal>
    </>
  );
}

function FolderButton({ label, count, active, onClick, onRename, onDelete }: { label: string; count: number; active: boolean; onClick: () => void; onRename?: () => void; onDelete?: () => void }) {
  return (
    <div className={cn("group/f flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-600 transition", active ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <FileText className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
      </button>
      {onRename || onDelete ? (
        <>
          <span className="text-xs group-hover/f:hidden">{count}</span>
          <span className="hidden items-center gap-0.5 group-hover/f:flex">
            {onRename && <button onClick={onRename} className="grid h-6 w-6 place-items-center rounded hover:bg-background/60" title="Redenumește folderul"><Pencil className="h-3 w-3" /></button>}
            {onDelete && <button onClick={onDelete} className="grid h-6 w-6 place-items-center rounded hover:text-danger" title="Șterge folderul"><Trash2 className="h-3 w-3" /></button>}
          </span>
        </>
      ) : <span className="text-xs">{count}</span>}
    </div>
  );
}
