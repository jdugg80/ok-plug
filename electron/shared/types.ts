/**
 * Shared data types for Vibeforge, used by both main and renderer.
 *
 * CreativeBrief / AdJob / ExportManifest below are unchanged from the
 * Step 1-2 pass. BrandKit / AssetRecord / VibeforgeProject have been
 * completed here — the versions committed in Step 1-2 were minimal
 * placeholders (no rootPath, no assets array, no website/fonts/logos on
 * BrandKit) that nothing real had been built against yet, so filling
 * them out now is a completion, not a breaking change to working code.
 */

import type { AdFormatSpec, Platform, MediaType } from "./format-catalog";

export type { AdFormatSpec, Platform, MediaType };

// ── Brand Kit ──────────────────────────────────────────────────

export interface BrandColor {
  id: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "background" | "text" | "other";
  label?: string;
  confidence?: number;
}

export interface FontChoice {
  id: string;
  family: string;
  role: "display" | "heading" | "body" | "caption";
  fallback?: string;
  source?: "system" | "google" | "uploaded";
}

export interface SourceAsset {
  id: string;
  relativePath: string;
  originalFileName: string;
  kind: "logo" | "photo" | "screenshot" | "other";
  width?: number;
  height?: number;
  addedAt: string;
}

export interface BrandKit {
  id: string;
  businessName: string;
  website?: string;
  colors: BrandColor[];
  fonts: FontChoice[];
  logos: SourceAsset[];
  imagery: SourceAsset[];
  vibeTags: string[];
  toneTags: string[];
  approvedHeadlines: string[];
  approved: boolean;
  scanSourceUrl?: string;
  scannedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Asset Record ───────────────────────────────────────────────

export type AssetType = "static-ad" | "animated-ad" | "logo" | "overlay" | "stinger";
export type AssetStatus = "draft" | "generating" | "ready" | "review" | "approved" | "exported" | "archived";

export interface AssetRecord {
  id: string;
  projectId: string;
  jobId?: string;
  formatSpecId?: string;
  name: string;
  type: AssetType;
  templateId?: string;
  templateVersion?: string;
  status: AssetStatus;
  dimensions?: { width: number; height: number };
  inputs?: Record<string, unknown>;
  filePath?: string;
  previewPath?: string;
  exportPaths?: string[];
  aiGenerationLog?: {
    prompt: string;
    model: string;
    generatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

// ── Creative Brief ─────────────────────────────────────────────

export interface CreativeBrief {
  keywords: string[];
  phrases: string[];
  referenceAssetPaths: string[];
  screenshotPaths: string[];
  toneOverride?: string;
}

// ── Ad Job ─────────────────────────────────────────────────────

export interface AdJob {
  id: string;
  unityCoreJobId?: string;
  businessId: string;
  businessName: string;
  brandKitId: string;
  requestedFormatIds: string[];
  creativeBrief: CreativeBrief;
  status:
    | "queued"
    | "in-progress"
    | "needs-review"
    | "approved"
    | "delivered"
    | "failed";
  createdAt: string;
  dueAt?: string;
}

// ── Export Manifest ────────────────────────────────────────────

export interface ExportManifest {
  jobId: string;
  assets: {
    formatSpecId: string;
    filePath: string;
    fileSizeBytes: number;
    approvedAt: string;
  }[];
  deliveredAt?: string;
}

// ── Project ────────────────────────────────────────────────────

export interface VibeforgeProject {
  id: string;
  name: string;
  businessName: string;
  businessId?: string;
  website?: string;
  industry?: string;
  notes?: string;
  brandKitId: string;
  assets: AssetRecord[];
  createdAt: string;
  updatedAt: string;
  projectVersion: number;
  /** Absolute path to the project's root folder. Not persisted inside the file itself. */
  rootPath?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  businessName: string;
  rootPath: string;
  updatedAt: string;
  thumbnailPath?: string;
}

export const CURRENT_PROJECT_VERSION = 1;
