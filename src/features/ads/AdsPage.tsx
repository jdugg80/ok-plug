import { Link } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import { ComingUp } from "@/components/ComingUp";

export function AdsPage() {
  const { activeProject } = useProjectStore();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Ads</h1>
        {activeProject && (
          <Link
            to="/ads/new"
            style={{
              padding: "8px 16px",
              background: "var(--vf-accent)",
              color: "#fff",
              borderRadius: "var(--vf-radius-md)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            New Ad Job
          </Link>
        )}
      </div>

      {activeProject ? (
        <div>
          <p style={{ color: "var(--vf-text-faint)", fontSize: 14 }}>
            Create ad jobs with a creative brief. Each job generates one asset
            per selected format.
          </p>
        </div>
      ) : (
        <ComingUp
          title="Static Advertising Engine"
          phase="Build sequence · Step 6"
          description="Template-driven static ad canvases keyed to the Format Catalog — layout headline/CTA/logo/imagery within each format's dimensions and safe zone."
          dependsOn="AI text generation (Step 5)"
        />
      )}
    </div>
  );
}
