import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/store/project-store";
import { FormatMultiSelect } from "@/components/FormatMultiSelect";
import styles from "./AdJobIntakePage.module.css";

export function AdJobIntakePage() {
  const navigate = useNavigate();
  const { activeProject, activeBrandKit, createAdJob } = useProjectStore();

  const [keywords, setKeywords] = useState("");
  const [phrases, setPhrases] = useState("");
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [toneOverride, setToneOverride] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeProject || !activeBrandKit) {
    return (
      <div className={styles.page}>
        <p className={styles.noProject}>
          Open a project first to create an ad job.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedFormats.length === 0) {
      setError("Select at least one format.");
      return;
    }
    if (!activeBrandKit) {
      setError("No brand kit loaded.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const phraseList = phrases
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);

      await createAdJob({
        businessName: activeBrandKit.businessName,
        brandKitId: activeBrandKit.id,
        requestedFormatIds: selectedFormats,
        creativeBrief: {
          keywords: keywordList,
          phrases: phraseList,
          referenceAssetPaths: [],
          screenshotPaths: [],
          toneOverride: toneOverride || undefined,
        },
      });

      navigate("/ads");
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>New Ad Job</h1>
      <p className={styles.subtitle}>
        Create a manual ad job for {activeBrandKit.businessName}. This will
        generate one asset per selected format.
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Creative Brief</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="keywords">
              Keywords (comma-separated)
            </label>
            <input
              id="keywords"
              type="text"
              className={styles.input}
              placeholder="e.g. summer, sale, 50% off, limited time"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phrases">
              Phrases (one per line)
            </label>
            <textarea
              id="phrases"
              className={styles.textarea}
              rows={4}
              placeholder={"e.g. Don't miss out!\nShop now and save big.\nLimited time offer."}
              value={phrases}
              onChange={(e) => setPhrases(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tone">
              Tone Override (optional)
            </label>
            <input
              id="tone"
              type="text"
              className={styles.input}
              placeholder="e.g. urgent, playful, professional"
              value={toneOverride}
              onChange={(e) => setToneOverride(e.target.value)}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Target Formats</h2>
          <p className={styles.hint}>
            Select all the ad formats you need. One asset will be created per
            format.
          </p>
          <FormatMultiSelect
            selected={selectedFormats}
            onChange={setSelectedFormats}
          />
        </section>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate("/ads")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || selectedFormats.length === 0}
          >
            {isSubmitting ? "Creating..." : `Create Job (${selectedFormats.length} formats)`}
          </button>
        </div>
      </form>
    </div>
  );
}
