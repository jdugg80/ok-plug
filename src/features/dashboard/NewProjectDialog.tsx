import { useState, type FormEvent } from "react";
import { useProjectStore } from "@/store/project-store";
import styles from "./NewProjectDialog.module.css";

interface NewProjectDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewProjectDialog({ onClose, onCreated }: NewProjectDialogProps) {
  const createProject = useProjectStore((s) => s.createProject);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);

  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    const created = await createProject({
      name: `${businessName.trim()} Project`,
      businessName: businessName.trim(),
      website: website.trim() || undefined,
      industry: industry.trim() || undefined,
    });
    if (created) onCreated();
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="new-project-title">
      <div className={styles.dialog}>
        <h2 id="new-project-title" className={styles.title}>
          New Project
        </h2>
        <p className={styles.subtitle}>
          You'll choose or build the Brand Kit next — this just sets up the project folder.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>Business name</span>
            <input
              autoFocus
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Riverside Coffee Co."
              required
            />
          </label>
          <label className={styles.field}>
            <span>Website (optional)</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </label>
          <label className={styles.field}>
            <span>Industry (optional)</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Food & Beverage"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className="vf-btn" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="vf-btn vf-btn--primary"
              disabled={isLoading || !businessName.trim()}
            >
              {isLoading ? "Creating…" : "Choose Folder & Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
