/**
 * Shared data types for Vibeforge.
 *
 * These types are shared between main and renderer processes.
 * Extend (don't replace) existing types when adding new fields.
 */

import type { AdFormatSpec, Platform, MediaType } from "./format-catalog";

// Re-export catalog types for convenience
export type { AdFormatSpec, Platform, MediaType };

// ── Brand Kit ──────────────────────────────────────────────────

export interface BrandColor {
  role: "primary" | "secondary" | "accent" | "background" | "text";
  hex: string;
}

export interface BrandKit {
  id: string;
  name: string;
  colors: BrandColor[];
  vibeTags: string[];
  toneTags: string[];
  status: "draft" | "approved";
  createdAt: string;
  updatedAt: string;
}

// ── Asset Record ───────────────────────────────────────────────

export interface AssetRecord {
  id: string;
  projectId: string;
  name: string;
  type: "image" | "video" | "html5" | "text";
  status: "draft" | "generating" | "review" | "approved" | "exported";
  filePath?: string;
  previewPath?: string;
  createdAt: string;
  updatedAt: string;
  // Blueprint v2 extensions
  jobId?: string;
  formatSpecId?: string;
  aiGenerationLog?: {
    prompt: string;
    model: string;
    generatedAt: string;
  }[];
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
  businessId?: string;
  brandKitId?: string;
  createdAt: string;
  updatedAt: string;
}
