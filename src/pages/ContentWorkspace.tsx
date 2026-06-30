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
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "calendar";
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS.map((t) => ({ label: t.label, value: t.id }))} />
      {tab === "board" ? <Tasks /> : tab === "hooks" ? <HookLibrary /> : <ContentCalendar />}
    </div>
  );
}
