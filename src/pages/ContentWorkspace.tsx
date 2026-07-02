import { useSearchParams } from "react-router-dom";
import { Segmented } from "@/components/ui";
import ContentCalendar from "@/pages/ContentCalendar";
import Tasks from "@/pages/Tasks";
import HookLibrary from "@/pages/HookLibrary";

const TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "board", label: "Board" },
  { id: "hooks", label: "Hook-uri" },
];

// Content Workspace — cross-client production. Calendar to plan, Board to track,
// Hooks as a writing aid. (Hooks becomes a composer drawer in a later phase.)
export default function ContentWorkspace() {
  const [params, setParams] = useSearchParams();
  // URL param wins; otherwise reopen on the last-used view (board people live in board).
  const remembered = typeof window !== "undefined" ? localStorage.getItem("dreamar-content-tab") : null;
  const tab = TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab")!
    : TABS.some((t) => t.id === remembered) ? remembered! : "calendar";
  const switchTab = (v: string) => {
    try { localStorage.setItem("dreamar-content-tab", v); } catch { /* ignore */ }
    setParams({ tab: v }, { replace: true });
  };
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={switchTab} options={TABS.map((t) => ({ label: t.label, value: t.id }))} />
      {tab === "board" ? <Tasks /> : tab === "hooks" ? <HookLibrary /> : <ContentCalendar />}
    </div>
  );
}
