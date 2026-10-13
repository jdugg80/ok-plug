import { useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { FormatMultiSelect } from "@/components/FormatMultiSelect";
import { AdCanvas, usePreviewLogos } from "@/components/AdCanvas";
import { FORMAT_CATALOG, buildAdDesignInput, combineFinePrint } from "@/types/domain";
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

  // Must run before any early return — resolves logo bytes for the previews.
  const logoDataUris = usePreviewLogos(activeProject?.rootPath, activeBrandKit?.logos);

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
    setProgress("Preparing brand context...");

    if (!activeBrandKit) {
      setError("No brand kit loaded.");
      setIsGenerating(false);
      return;
    }

    // activeProject is narrowed in the component body, but not across the
    // function boundary — re-check here for the logo resolution path.
    const projectRootPath = activeProject?.rootPath;
    if (!projectRootPath) {
      setError("No project loaded.");
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
        // Generate complete ad design.
        //
        // This path has no job context, so creativeBrief is undefined:
        // callToAction / requiredDisclaimers / adDirection are NOT set here.
        // brandKit.logos go into the prompt as metadata only; the app draws
        // the real logo at render time.
        const design = await window.vibeforge.generateAdDesign(
          buildAdDesignInput(spec, activeBrandKit, undefined, {
            projectRootPath,
          })
        );

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
          </div>
          <p className={styles.hint}>
            Open a job to approve and export.
          </p>
          <div className={styles.grid}>
            {generatedAds.map((ad) => (
              <div key={ad.formatId} className={styles.previewCard}>
                <AdCanvas
                  formatSpec={ad.spec}
                  design={ad.design}
                  imageUrl={ad.imageUrl}
                  brand={{
                    logos: activeBrandKit.logos,
                    logoDataUris,
                    fonts: activeBrandKit.fonts,
                    website: activeBrandKit.website,
                    adContact: activeBrandKit.adContact,
                    // No job on this page, so brand fine print only.
                    finePrint: combineFinePrint(undefined, activeBrandKit.finePrint),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
