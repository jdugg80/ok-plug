import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { BrandKitPage } from "@/features/brand-kit/BrandKitPage";
import { AdsPage } from "@/features/ads/AdsPage";
import { AdJobIntakePage } from "@/features/jobs/AdJobIntakePage";
import { LogosPage } from "@/features/logos/LogosPage";
import { OverlaysPage } from "@/features/overlays/OverlaysPage";
import { ExportsPage } from "@/features/exports/ExportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

// HashRouter, not BrowserRouter: the renderer loads via file:// in
// production, where a history-API router can't resolve nested paths.
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/brand-kit" element={<BrandKitPage />} />
          <Route path="/ads" element={<AdsPage />} />
          <Route path="/ads/new" element={<AdJobIntakePage />} />
          <Route path="/logos" element={<LogosPage />} />
          <Route path="/overlays" element={<OverlaysPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
