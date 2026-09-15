import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import { NewProjectDialog } from "./NewProjectDialog";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const recentProjects = useProjectStore((s) => s.recentProjects);
  const refreshRecentProjects = useProjectStore((s) => s.refreshRecentProjects);
  const openProjectViaDialog = useProjectStore((s) => s.openProjectViaDialog);
  const openProjectByPath = useProjectStore((s) => s.openProjectByPath);
  const isLoading = useProjectStore((s) => s.isLoading);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);

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
        </div>
      </div>

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
    </div>
  );
}
