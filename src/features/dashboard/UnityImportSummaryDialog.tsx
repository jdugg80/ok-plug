import type { UnityImportResult } from "../../../electron/preload/preload";
import { FORMAT_CATALOG } from "@/types/domain";
import type { AdFormatSpec, CustomAdFormatSpec } from "@/types/domain";
import styles from "./UnityImportSummaryDialog.module.css";

interface UnityImportSummaryDialogProps {
  result: UnityImportResult;
  onClose: () => void;
  onOpenProject: () => void;
}

export function UnityImportSummaryDialog({
  result,
  onClose,
  onOpenProject,
}: UnityImportSummaryDialogProps) {
  const specs: (AdFormatSpec | CustomAdFormatSpec)[] = [
    ...(result.job.customFormatSpecs ?? []),
    ...result.job.requestedFormatIds
      .filter(
        (id) => !(result.job.customFormatSpecs ?? []).some((s) => s.id === id)
      )
      .map((id) => FORMAT_CATALOG.find((f) => f.id === id))
      .filter((s): s is AdFormatSpec => s !== undefined),
  ];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="unity-import-title">
      <div className={styles.dialog}>
        <h2 id="unity-import-title" className={styles.title}>
          {result.created ? "Import Complete" : "Update Complete"}
        </h2>
        <p className={styles.subtitle}>
          {result.project.unity?.campaignName ?? result.project.businessName}
        </p>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Imported Formats</h3>
          {specs.length === 0 ? (
            <p className={styles.emptyText}>No formats imported.</p>
          ) : (
            <ul className={styles.formatList}>
              {specs.map((spec) => (
                <li key={spec.id} className={styles.formatItem}>
                  <span className={styles.formatName}>
                    {spec.platform} {spec.placement}
                  </span>
                  <span className={styles.formatSize}>
                    {spec.width}×{spec.height}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {result.skipped.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Skipped</h3>
            <ul className={styles.formatList}>
              {result.skipped.map((s, i) => (
                <li key={i} className={styles.formatItem}>
                  <span className={styles.formatName}>
                    {s.platform ?? "?"} {s.formatName ?? "?"}
                  </span>
                  <span className={styles.skippedReason}>{s.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Warnings</h3>
            <ul className={styles.warningList}>
              {result.warnings.map((w, i) => (
                <li key={i} className={styles.warningItem}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.actions}>
          <button className="vf-btn" onClick={onClose}>
            Close
          </button>
          <button className="vf-btn vf-btn--primary" onClick={onOpenProject}>
            Open project
          </button>
        </div>
      </div>
    </div>
  );
}
