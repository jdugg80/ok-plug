import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import { NewProjectDialog } from "./NewProjectDialog";
import { UnityImportSummaryDialog } from "./UnityImportSummaryDialog";
import { ipcErrorMessage } from "@/lib/ipc-error";
import type { UnityImportResult } from "../../../electron/preload/preload";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const refreshRecentProjects = useProjectStore((s) => s.refreshRecentProjects);
  const openProjectViaDialog = useProjectStore((s) => s.openProjectViaDialog);
  const openProjectByPath = useProjectStore((s) => s.openProjectByPath);
  const loadJobs = useProjectStore((s) => s.loadJobs);
  const isLoading = useProjectStore((s) => s.isLoading);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<UnityImportResult | null>(null);

  useEffect(() => {
    refreshRecentProjects();
  }, [refreshRecentProjects]);

  async function handleOpenViaDialog() {
    const opened = await openProjectViaDialog();
    if (opened) navigate("/brand-kit");
  }

  async function handleOpenRecent(rootPath: string) {
    const opened = await openProjectByPath(rootPath);
    if (opened) navigate("/brand-kit");
  }

  async function handleImportUnityCore() {
    setIsImporting(true);
    setImportError(null);
    try {
      const result = await window.vibeforge.importFromUnityCore();
      setImportResult(result);
      await refreshRecentProjects();
    } catch (err) {
      const message = ipcErrorMessage(err);
      if (
        !message.includes("No campaign folder selected.") &&
        !message.includes("No project location selected.")
      ) {
        setImportError(message);
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleOpenImportedProject() {
    if (!importResult?.project.rootPath) return;
    const rootPath = importResult.project.rootPath;
    setImportResult(null);
    const opened = await openProjectByPath(rootPath);
    if (opened) {
      await loadJobs();
      navigate("/brand-kit");
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Scan or define a brand, then generate ads, logos, motion, and overlays from one
            consistent system.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button className="vf-btn" onClick={handleOpenViaDialog} disabled={isLoading}>
            Open Project…
          </button>
          <button
            className="vf-btn vf-btn--primary"
            onClick={() => setShowNewProjectDialog(true)}
            disabled={isLoading}
          >
            New Project
          </button>
          <button
            className="vf-btn"
            onClick={handleImportUnityCore}
            disabled={isLoading || isImporting}
          >
            {isImporting ? "Importing…" : "Import from Unity Core…"}
          </button>
        </div>
      </div>

      {importError && <p className={styles.importError}>{importError}</p>}

      <section>
        <h2 className={styles.sectionTitle}>Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <p className={styles.empty}>
            No projects yet. Create one to build its Brand Kit and start generating assets.
          </p>
        ) : (
          <ul className={styles.projectList}>
            {recentProjects.map((p) => (
              <li key={p.id}>
                <button className={styles.projectCard} onClick={() => handleOpenRecent(p.rootPath)}>
                  <div className={styles.projectCardThumb}>
                    {p.businessName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className={styles.projectCardMeta}>
                    <div className={styles.projectCardName}>{p.businessName}</div>
                    <div className={styles.projectCardSub}>{p.name}</div>
                  </div>
                  <div className={styles.projectCardDate}>
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showNewProjectDialog && (
        <NewProjectDialog
          onClose={() => setShowNewProjectDialog(false)}
          onCreated={() => {
            setShowNewProjectDialog(false);
            navigate("/brand-kit");
          }}
        />
      )}

      {importResult && (
        <UnityImportSummaryDialog
          result={importResult}
          onClose={() => setImportResult(null)}
          onOpenProject={handleOpenImportedProject}
        />
      )}
    </div>
  );
}
