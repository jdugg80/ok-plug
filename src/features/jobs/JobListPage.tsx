import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import type { AdJob } from "@/types/domain";
import styles from "./JobListPage.module.css";

const STATUS_LABELS: Record<AdJob["status"], string> = {
  queued: "Queued",
  "in-progress": "In Progress",
  "needs-review": "Needs Review",
  approved: "Approved",
  delivered: "Delivered",
  failed: "Failed",
};

const STATUS_COLORS: Record<AdJob["status"], string> = {
  queued: "#888",
  "in-progress": "#3b82f6",
  "needs-review": "#f59e0b",
  approved: "#22c55e",
  delivered: "#8b5cf6",
  failed: "#ef4444",
};

export function JobListPage() {
  const { activeProject, jobs, loadJobs, deleteJob } = useProjectStore();

  useEffect(() => {
    if (activeProject) {
      loadJobs();
    }
  }, [activeProject]);

  if (!activeProject) {
    return (
      <div className={styles.page}>
        <p>Open a project to view ad jobs.</p>
      </div>
    );
  }

  async function handleDelete(e: React.MouseEvent, jobId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this job and all its assets?")) {
      await deleteJob(jobId);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Ad Jobs</h1>
        <Link to="/ads/new" className={styles.newJobBtn}>
          New Ad Job
        </Link>
      </div>

      <p className={styles.subtitle}>
        Ad jobs create one asset per requested format. Generate ads from a job's creative brief.
      </p>

      {jobs.length === 0 ? (
        <div className={styles.empty}>
          <p>No ad jobs yet. Create one to get started.</p>
        </div>
      ) : (
        <div className={styles.jobList}>
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/ads/${job.id}`}
              className={styles.jobCard}
            >
              <div className={styles.jobHeader}>
                <span className={styles.jobName}>{job.businessName}</span>
                <span
                  className={styles.statusBadge}
                  style={{
                    background: STATUS_COLORS[job.status],
                    color: "#fff",
                  }}
                >
                  {STATUS_LABELS[job.status]}
                </span>
              </div>

              <div className={styles.jobMeta}>
                <span>{job.requestedFormatIds.length} format(s)</span>
                <span>{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>

              {job.creativeBrief.keywords.length > 0 && (
                <div className={styles.keywords}>
                  {job.creativeBrief.keywords.slice(0, 3).map((kw) => (
                    <span key={kw} className={styles.keyword}>
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              <button
                className={styles.deleteBtn}
                onClick={(e) => handleDelete(e, job.id)}
                title="Delete job"
              >
                Delete
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
