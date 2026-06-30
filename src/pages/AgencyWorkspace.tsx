import { useSearchParams } from "react-router-dom";
import { Segmented } from "@/components/ui";
import Settings from "@/pages/Settings";
import Billing from "@/pages/Billing";
import Integrations from "@/pages/Integrations";

const TABS = [
  { id: "settings", label: "Setări" },
  { id: "billing", label: "Facturare" },
  { id: "integrations", label: "Integrări" },
];

// Agency Workspace — everything about the agency itself (team, plan, integrations).
export default function AgencyWorkspace() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "settings";
  return (
    <div className="space-y-4">
      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS.map((t) => ({ label: t.label, value: t.id }))} />
      {tab === "billing" ? <Billing /> : tab === "integrations" ? <Integrations /> : <Settings />}
    </div>
  );
}
