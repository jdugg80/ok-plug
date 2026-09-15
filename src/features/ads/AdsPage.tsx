import { ComingUp } from "@/components/ComingUp";

export function AdsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Ads</h1>
      <ComingUp
        title="Static Advertising Engine"
        phase="Build sequence · Step 6"
        description="Template-driven static ad canvases keyed to the Format Catalog — layout headline/CTA/logo/imagery within each format's dimensions and safe zone."
        dependsOn="AI text generation (Step 5)"
      />
    </div>
  );
}
