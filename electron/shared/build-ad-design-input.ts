/**
 * Shared assembly for AdDesignInput.
 *
 * Lives in electron/shared (not electron/main) so the renderer can import it
 * without pulling Electron, the AI SDKs, or node:fs into the Vite bundle.
 * Every import below is type-only for the same reason - a value import would
 * drag those packages into the renderer build.
 */
import type { AdFormatSpec } from "./format-catalog";
import type { BrandKit, CreativeBrief, CustomAdFormatSpec } from "./types";
import type { AdDesignInput } from "../main/services/ai-ad-design-service";

export interface BuildAdDesignInputOptions {
  /** Extra keywords merged in after the brief's own keywords. */
  extraKeywords?: string[];
  /** Kept for callers that thread it through. The prompt no longer reads logo
   *  files — logos are metadata-only there and drawn by the app at render time. */
  projectRootPath?: string;
}

/**
 * Build the input both generation paths use.
 *
 * The orchestrator passes a job's creativeBrief; the manual Generate Ads page
 * passes none, in which case callToAction / requiredDisclaimers / adDirection
 * are simply absent from the input.
 */
export function buildAdDesignInput(
  formatSpec: AdFormatSpec | CustomAdFormatSpec,
  brandKit: BrandKit,
  creativeBrief?: CreativeBrief,
  options: BuildAdDesignInputOptions = {}
): AdDesignInput {
  const keywords = [
    ...(creativeBrief?.keywords ?? []),
    ...(options.extraKeywords ?? []),
    brandKit.businessName,
    creativeBrief?.toneOverride || brandKit.toneTags.join(", "),
    brandKit.vibeTags.join(", "),
  ].filter(Boolean);

  return {
    formatSpec,
    brandKit,
    keywords,
    ...(creativeBrief?.callToAction ? { callToAction: creativeBrief.callToAction } : {}),
    ...(creativeBrief?.requiredDisclaimers
      ? { requiredDisclaimers: creativeBrief.requiredDisclaimers }
      : {}),
    ...(creativeBrief?.adDirection ? { adDirection: creativeBrief.adDirection } : {}),
    ...(options.projectRootPath ? { projectRootPath: options.projectRootPath } : {}),
  };
}
