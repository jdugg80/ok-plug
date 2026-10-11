import { useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { FormatMultiSelect } from "@/components/FormatMultiSelect";
import { AdCanvas } from "@/components/AdCanvas";
import { FORMAT_CATALOG } from "@/types/domain";
import type { AdFormatSpec, AdDesignResult, CustomAdFormatSpec } from "@/types/domain";
import styles from "./GenerateAdsPage.module.css";

type AnyFormatSpec = AdFormatSpec | CustomAdFormatSpec;

interface GeneratedAd {
  formatId: string;
  spec: AnyFormatSpec;
  design: AdDesignResult;
  imageUrl?: string;
}

export function GenerateAdsPage() {
  const { activeProject, activeBrandKit, jobs } = useProjectStore();

  const [selectedFormats, setSelectedFormats] = useState<string[]>([
    "facebook-feed-universal-1x1",
    "facebook-feed-mobile-4x5",
    "instagram-feed-square-1x1",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[]>([]);

  // Export state
  const [exportingFormatId, setExportingFormatId] = useState<string | null>(null);
  const [exportedPaths, setExportedPaths] = useState<Record<string, string>>({});
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({});

  if (!activeProject || !activeBrandKit) {
    return (
      <div className={styles.page}>
        <p>Open a project with a brand kit to generate ads.</p>
      </div>
    );
  }

  // Build brand context from brand kit
  const brandContext = {
    name: activeBrandKit.businessName,
    tone: activeBrandKit.toneTags.join(", ") || "professional, engaging",
    vibe: activeBrandKit.vibeTags.join(", ") || "modern, clean",
  };

  async function handleGenerate() {
    if (selectedFormats.length === 0) {
      setError("Select at least one format.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedAds([]);
    setExportedPaths({});
    setExportErrors({});
    setProgress("Preparing brand context...");

    if (!activeBrandKit) {
      setError("No brand kit loaded.");
      setIsGenerating(false);
      return;
    }

    const results: GeneratedAd[] = [];

    for (let i = 0; i < selectedFormats.length; i++) {
      const formatId = selectedFormats[i];
      const spec =
        FORMAT_CATALOG.find((f: AdFormatSpec) => f.id === formatId) ??
        jobs
          .flatMap((j) => j.customFormatSpecs ?? [])
          .find((f) => f.id === formatId);
      if (!spec) continue;

      setProgress(`Designing ${spec.platform} ${spec.placement}... (${i + 1}/${selectedFormats.length})`);

      try {
        // Generate complete ad design
        const design = await window.vibeforge.generateAdDesign({
          formatSpec: spec,
          brandKit: activeBrandKit,
          keywords: [brandContext.name, brandContext.tone, brandContext.vibe],
        });

        // Try to fetch stock photo (placeholder for now)
        let imageUrl: string | undefined;
        if (design.imageSearchQuery) {
          try {
            // In production, this would call Unsplash API
            // For now, use a placeholder gradient
            imageUrl = undefined;
          } catch {
            // Continue without image
          }
        }

        results.push({
          formatId: spec.id,
          spec,
          design,
          imageUrl,
        });

        setGeneratedAds([...results]);
      } catch (err) {
        console.error(`Failed to generate for ${formatId}:`, err);
      }
    }

    setProgress("");
    setIsGenerating(false);

    if (results.length === 0) {
      setError("Generation failed. Check your API key in Settings.");
    }
  }

  async function handleExport(ad: GeneratedAd) {
    setExportingFormatId(ad.formatId);
    setExportErrors((prev) => {
      const next = { ...prev };
      delete next[ad.formatId];
      return next;
    });

    try {
      const filePath = await window.vibeforge.exportAsset(
        ad.design,
        { width: ad.spec.width, height: ad.spec.height, id: ad.spec.id },
        activeBrandKit?.fonts
      );
      setExportedPaths((prev) => ({ ...prev, [ad.formatId]: filePath }));
    } catch (err) {
      setExportErrors((prev) => ({
        ...prev,
        [ad.formatId]: (err as Error).message,
      }));
    } finally {
      setExportingFormatId(null);
    }
  }

  async function handleExportAll() {
    for (const ad of generatedAds) {
      if (!exportedPaths[ad.formatId]) {
        await handleExport(ad);
      }
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Generate Ads</h1>
      <p className={styles.subtitle}>
        AI designs complete ads based on your brand kit. Select formats and click Generate.
      </p>

      {/* Brand Kit Summary */}
      <div className={styles.brandSummary}>
        <h3>Brand Context</h3>
        <div className={styles.brandGrid}>
          <div>
            <span className={styles.label}>Business</span>
            <span className={styles.value}>{brandContext.name}</span>
          </div>
          <div>
            <span className={styles.label}>Tone</span>
            <span className={styles.value}>{brandContext.tone}</span>
          </div>
          <div>
            <span className={styles.label}>Vibe</span>
            <span className={styles.value}>{brandContext.vibe}</span>
          </div>
          <div>
            <span className={styles.label}>Colors</span>
            <span className={styles.value}>
              {activeBrandKit.colors.length > 0
                ? activeBrandKit.colors.map((c) => c.hex).join(", ")
                : "None set"}
            </span>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div className={styles.section}>
        <h3>Target Formats</h3>
        <p className={styles.hint}>
          Select the ad formats you need. One ad will be designed per format.
        </p>
        <FormatMultiSelect
          selected={selectedFormats}
          onChange={setSelectedFormats}
        />
      </div>

      {/* Generate Button */}
      {error && <p className={styles.error}>{error}</p>}
      {progress && <p className={styles.progress}>{progress}</p>}

      <button
        className={styles.generateBtn}
        onClick={handleGenerate}
        disabled={isGenerating || selectedFormats.length === 0}
      >
        {isGenerating
          ? "Designing..."
          : `Generate ${selectedFormats.length} Ads`}
      </button>

      {/* Generated Results */}
      {generatedAds.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>Generated Ads</h2>
            <button
              className="vf-btn vf-btn--primary"
              onClick={handleExportAll}
              disabled={isGenerating}
            >
              Export All as PNG
            </button>
          </div>
          <p className={styles.hint}>
            Each ad is exported as a watermarked PNG at retina resolution.
          </p>
          <div className={styles.grid}>
            {generatedAds.map((ad) => (
              <div key={ad.formatId} className={styles.previewCard}>
                <AdCanvas
                  formatSpec={ad.spec}
                  design={ad.design}
                  imageUrl={ad.imageUrl}
                />
                <div className={styles.exportActions}>
                  {exportedPaths[ad.formatId] ? (
                    <span className={styles.exportSuccess}>
                      Exported to renders/
                    </span>
                  ) : (
                    <button
                      className="vf-btn"
                      onClick={() => handleExport(ad)}
                      disabled={exportingFormatId === ad.formatId}
                    >
                      {exportingFormatId === ad.formatId
                        ? "Rendering..."
                        : "Export PNG"}
                    </button>
                  )}
                  {exportErrors[ad.formatId] && (
                    <span className={styles.exportError}>
                      {exportErrors[ad.formatId]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
