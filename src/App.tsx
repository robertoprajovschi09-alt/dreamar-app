import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ViewerShell } from "@/components/layout/ViewerShell";
import { AdminShell } from "@/components/layout/AdminShell";
import { RequireAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace";
import { MarketingLayout } from "@/marketing/MarketingLayout";

// Marketing (public)
const LandingPage = lazy(() => import("@/marketing/LandingPage"));
const PricingPage = lazy(() => import("@/marketing/PricingPage"));
const LoginPage = lazy(() => import("@/marketing/LoginPage"));
const SignupPage = lazy(() => import("@/marketing/SignupPage"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));

// App (authenticated) — lazy so the heavy charting/page code is split per route.
const AgencyDashboard = lazy(() => import("@/pages/AgencyDashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const ContentCalendar = lazy(() => import("@/pages/ContentCalendar"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const VideoTracker = lazy(() => import("@/pages/VideoTracker"));
const HookLibrary = lazy(() => import("@/pages/HookLibrary"));
const BusinessImpact = lazy(() => import("@/pages/BusinessImpact"));
const StrategyRoom = lazy(() => import("@/pages/StrategyRoom"));
const Reports = lazy(() => import("@/pages/Reports"));
const Documents = lazy(() => import("@/pages/Documents"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Billing = lazy(() => import("@/pages/Billing"));
const Settings = lazy(() => import("@/pages/Settings"));
const ClientPortal = lazy(() => import("@/pages/ClientPortal"));

function RouteFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
const S = (el: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

// Platform admins get the standalone control room; client viewers get a
// portal-only shell; everyone else gets the agency app.
function GatedShell() {
  const { live, agencyReady, isViewer, isPlatformAdmin } = useWorkspace();
  if (live && !agencyReady) {
    return <div className="grid min-h-screen place-items-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }
  if (isPlatformAdmin) return <AdminShell />;
  return isViewer ? <ViewerShell /> : <AppShell />;
}

export default function App() {
  return (
    <Routes>
      {/* ---- Public marketing site ---- */}
      <Route element={<MarketingLayout />}>
        <Route index element={S(<LandingPage />)} />
        <Route path="pricing" element={S(<PricingPage />)} />
      </Route>
      <Route path="login" element={S(<LoginPage />)} />
      <Route path="signup" element={S(<SignupPage />)} />
      <Route path="admin/login" element={S(<AdminLogin />)} />

      {/* ---- Authenticated app ---- */}
      <Route
        element={
          <RequireAuth>
            <GatedShell />
          </RequireAuth>
        }
      >
        <Route path="dashboard" element={<AgencyDashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="calendar" element={<ContentCalendar />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="videos" element={<VideoTracker />} />
        <Route path="hooks" element={<HookLibrary />} />
        <Route path="impact" element={<BusinessImpact />} />
        <Route path="strategy" element={<StrategyRoom />} />
        <Route path="reports" element={<Reports />} />
        <Route path="documents" element={<Documents />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="billing" element={<Billing />} />
        {/* Admin is no longer part of the agency app — platform admins reach it
            via the footer → /admin/login, which renders the standalone AdminShell.
            Any stray agency user hitting /admin is bounced to their dashboard. */}
        <Route path="admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="portal" element={<ClientPortal />} />
      </Route>
    </Routes>
  );
}
