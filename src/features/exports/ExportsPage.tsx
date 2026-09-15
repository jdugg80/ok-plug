import { ComingUp } from "@/components/ComingUp";

export function ExportsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Exports</h1>
      <ComingUp
        title="Export & Delivery to OKLaunch"
        phase="Build sequence · Step 11"
        description="Packages approved AssetRecords into an ExportManifest and delivers to OKLaunch's sponsor ad engine."
        dependsOn="Static render pipeline (Steps 6-7) and confirmed OKLaunch intake format (Step 0)"
      />
    </div>
  );
}
