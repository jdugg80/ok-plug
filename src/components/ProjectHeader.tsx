import { useProjectStore } from "@/store/project-store";
import styles from "./ProjectHeader.module.css";

export function ProjectHeader() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeBrandKit = useProjectStore((s) => s.activeBrandKit);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const saveActiveProject = useProjectStore((s) => s.saveActiveProject);

  if (!activeProject) {
    return (
      <header className={styles.header}>
        <span className={styles.noProject}>No project open</span>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.thumb} aria-hidden="true">
          {activeProject.businessName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className={styles.businessName}>{activeProject.businessName}</div>
          <div className={styles.projectName}>{activeProject.name}</div>
        </div>
        {activeBrandKit?.approved ? (
          <span className="vf-badge vf-badge--approved">Brand Kit Approved</span>
        ) : (
          <span className="vf-badge">Brand Kit Draft</span>
        )}
      </div>
      <div className={styles.actions}>
        <span className={styles.saveStatus} data-status={saveStatus}>
          {saveStatus === "pending" && "Saving soon…"}
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
          {saveStatus === "idle" && "No changes"}
        </span>
        <button className="vf-btn vf-btn--primary" onClick={() => saveActiveProject()}>
          Save Project
        </button>
      </div>
    </header>
  );
}
