import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import { AdCanvas } from "@/components/AdCanvas";
import { FORMAT_CATALOG } from "@/types/domain";
import type { AdJob, AssetRecord, AdDesignResult, AdFormatSpec, CustomAdFormatSpec } from "@/types/domain";
import styles from "./JobDetailPage.module.css";

type AnyFormatSpec = AdFormatSpec | CustomAdFormatSpec;

const STATUS_LABELS: Record<AdJob["status"], string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  "needs-review": "Needs Review",
  approved: "Approved",
  delivered: "Delivered",
  failed: "Failed",
};

const ASSET_STATUS_LABELS: Record<AssetRecord["status"], string> = {
  draft: "Draft",
  generating: "Generating...",
  ready: "Ready",
  review: "In Review",
  approved: "Approved",
  exported: "Exported",
  archived: "Archived",
};

const ASSET_STATUS_COLORS: Record<AssetRecord["status"], string> = {
  draft: "#888",
  generating: "#3b82f6",
  ready: "#22c55e",
  review: "#f59e0b",
  approved: "#22c55e",
  exported: "#8b5cf6",
  archived: "#666",
};

interface AssetWithDesign {
  asset: AssetRecord;
  spec: AnyFormatSpec | undefined;
  design: AdDesignResult | null;
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const {
    activeProject,
    activeBrandKit,
    jobs,
    loadJobs,
    generateFromJob,
    updateJobStatus,
  } = useProjectStore();

  const [job, setJob] = useState<AdJob | undefined>(undefined);
  const [assetsWithDesigns, setAssetsWithDesigns] = useState<AssetWithDesign[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [exportingAssetId, setExportingAssetId] = useState<string | null>(null);
  const [exportedPaths, setExportedPaths] = useState<Record<string, string>>({});

  // Load job + assets
  const loadJobData = useCallback(async () => {
    if (!activeProject || !jobId) return;

    // Find job from store or load it
    let foundJob = jobs.find((j) => j.id === jobId);
    if (!foundJob && activeProject.rootPath) {
      foundJob = (await window.vibeforge.getAdJob(activeProject.rootPath, jobId)) ?? undefined;
    }
    if (!foundJob) return;
    setJob(foundJob);

    // Load design results for each asset
    const jobAssets = activeProject.assets.filter((a) => a.jobId === jobId);
    const withDesigns: AssetWithDesign[] = await Promise.all(
      jobAssets.map(async (asset) => {
        const spec =
          FORMAT_CATALOG.find((f) => f.id === asset.formatSpecId) ??
          foundJob.customFormatSpecs?.find((f) => f.id === asset.formatSpecId);
        let design: AdDesignResult | null = null;
        if (activeProject.rootPath && asset.status !== "draft") {
          design = await window.vibeforge.loadDesignForResult(
            asset.id,
            activeProject.rootPath
          );
        }
        return { asset, spec, design };
      })
    );
    setAssetsWithDesigns(withDesigns);
  }, [activeProject, jobId, jobs]);

  useEffect(() => {
    loadJobs().then(() => loadJobData());
  }, [activeProject, jobId]);

  if (!activeProject || !job) {
    return (
      <div className={styles.page}>
        <p>Loading job...</p>
      </div>
    );
  }

  async function handleGenerate() {
    if (!job) return;
    setGenerating(true);
    setProgress("Starting generation...");
    await generateFromJob(job.id);
    setProgress("Reloading...");
    await loadJobData();
    setProgress("");
    setGenerating(false);
  }

  async function handleExport(assetId: string, design: AdDesignResult, spec: AnyFormatSpec) {
    setExportingAssetId(assetId);
    try {
      const filePath = await window.vibeforge.exportAsset(
        design,
        { width: spec.width, height: spec.height, id: spec.id },
        activeBrandKit?.fonts
      );
      setExportedPaths((prev) => ({ ...prev, [assetId]: filePath }));
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportingAssetId(null);
    }
  }

  async function handleApprove() {
    if (!job) return;
    await updateJobStatus(job.id, "approved");
    setJob({ ...job, status: "approved" });
  }

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate("/ads")}>
        Back to Jobs
      </button>

      {/* Job Header */}
      <div className={styles.jobHeader}>
        <div>
          <h1 className={styles.title}>{job.businessName}</h1>
          <div className={styles.meta}>
            <span>{job.requestedFormatIds.length} format(s)</span>
            <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <span
          className={styles.statusBadge}
          style={{ background: job.status === "needs-review" ? "#f59e0b" : "#3b82f6" }}
        >
          {STATUS_LABELS[job.status]}
        </span>
      </div>

      {/* Creative Brief */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Creative Brief</h2>
        <div className={styles.briefGrid}>
          <div>
            <span className={styles.label}>Keywords</span>
            <span className={styles.value}>
              {job.creativeBrief.keywords.length > 0
                ? job.creativeBrief.keywords.join(", ")
                : "None"}
            </span>
          </div>
          <div>
            <span className={styles.label}>Phrases</span>
            <span className={styles.value}>
              {job.creativeBrief.phrases.length > 0
                ? job.creativeBrief.phrases.join("; ")
                : "None"}
            </span>
          </div>
          {job.creativeBrief.toneOverride && (
            <div>
              <span className={styles.label}>Tone Override</span>
              <span className={styles.value}>{job.creativeBrief.toneOverride}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {job.status === "queued" && (
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? progress || "Generating..." : "Generate All Ads"}
          </button>
        )}
        {job.status === "needs-review" && (
          <button className={styles.approveBtn} onClick={handleApprove}>
            Approve Job
          </button>
        )}
      </div>

      {/* Assets */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Assets</h2>
        <div className={styles.assetGrid}>
          {assetsWithDesigns.map(({ asset, spec, design }) => (
            <div key={asset.id} className={styles.assetCard}>
              {design && spec ? (
                <AdCanvas
                  formatSpec={spec}
                  design={design}
                />
              ) : (
                <div className={styles.placeholder}>
                  {asset.status === "generating" ? "Generating..." : "No design yet"}
                </div>
              )}

              <div className={styles.assetInfo}>
                <div className={styles.assetHeader}>
                  <span className={styles.assetName}>
                    {spec ? `${spec.platform} ${spec.placement}` : asset.formatSpecId}
                  </span>
                  <span
                    className={styles.assetStatus}
                    style={{ color: ASSET_STATUS_COLORS[asset.status] }}
                  >
                    {ASSET_STATUS_LABELS[asset.status]}
                  </span>
                </div>

                {design && spec && (
                  <div className={styles.assetActions}>
                    {exportedPaths[asset.id] ? (
                      <span className={styles.exportSuccess}>Exported</span>
                    ) : (
                      <button
                        className="vf-btn"
                        onClick={() => handleExport(asset.id, design, spec)}
                        disabled={exportingAssetId === asset.id}
                      >
                        {exportingAssetId === asset.id ? "Rendering..." : "Export PNG"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
