/**
 * Export Service
 * Renders an ad design to an exact-pixel PNG, verifies dimensions,
 * writes it to the output folder, and maintains export-manifest.json.
 * Does not load projects — the IPC handler resolves project/asset context.
 */

import { promises as fs } from "fs";
import path from "path";
import type { AdDesignResult } from "./ai-ad-design-service";
import type { FontChoice } from "../../shared/types";
import type { ExportManifest, AssetRecord } from "../../shared/types";
import { renderAdToPng } from "./render-service";

const CRM_UPLOAD_CAP_BYTES = 10 * 1024 * 1024;

// Lazy-loaded sharp (dynamic import — ESM-only package in CJS context)
let sharpInstance: any = null;
async function getSharp(): Promise<any> {
  if (!sharpInstance) {
    sharpInstance = (await import("sharp")).default;
  }
  return sharpInstance;
}

export interface ExportAssetInput {
  design: AdDesignResult;
  formatSpec: { width: number; height: number; id: string };
  fonts?: FontChoice[];
  outputDir?: string;
  /** Project root; used to resolve the default exports\ folder when outputDir is omitted. */
  projectRootPath?: string;
  /** Job id for export-manifest.json grouping. */
  jobId?: string;
  /** Asset being exported. Must be status "approved". */
  asset?: AssetRecord;
}

export interface ExportAssetResult {
  filePath: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  manifestUpdated: boolean;
  warnings: string[];
}

function slugify(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Write the buffer with O_EXCL (flag "wx"). On EEXIST advance to the next
 * numeric suffix and retry. Never overwrites an existing file.
 */
async function writeUniquePng(
  dir: string,
  baseName: string,
  buf: Buffer
): Promise<string> {
  let n = 1;
  while (true) {
    const name = n === 1 ? `${baseName}.png` : `${baseName}-${n}.png`;
    const candidate = path.join(dir, name);
    try {
      await fs.writeFile(candidate, buf, { flag: "wx" });
      return candidate;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        n++;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Export an ad design as an exact width x height PNG.
 * No watermark is applied (watermark-service is for client previews only).
 * Dimensions are verified on the in-memory buffer BEFORE writing; on
 * mismatch nothing is left on disk. The asset (when provided) must be
 * "approved"; approvedAt is taken from the asset record.
 */
export async function exportAdToPng(input: ExportAssetInput): Promise<ExportAssetResult> {
  const { design, formatSpec, fonts, jobId, asset } = input;
  const warnings: string[] = [];

  // Refuse non-approved assets when asset context is provided
  if (asset && asset.status !== "approved") {
    throw new Error(
      `Export refused: asset ${asset.id} status is "${asset.status}", not "approved".`
    );
  }

  // Resolve output directory — no silent fallback to cwd/home
  let outDir = input.outputDir;
  if (!outDir) {
    if (!input.projectRootPath) {
      throw new Error(
        "No output directory: pass outputDir or projectRootPath."
      );
    }
    outDir = path.join(input.projectRootPath, "exports");
  }
  await fs.mkdir(outDir, { recursive: true });

  // Render at scale 1 so the PNG is exactly width x height pixels
  const formatLike = { ...formatSpec } as Parameters<typeof renderAdToPng>[1];
  const pngBuffer = await renderAdToPng(design, formatLike, fonts, 1);

  // Verify pixel size on the in-memory buffer BEFORE writing
  const sharp = await getSharp();
  const meta = await sharp(pngBuffer).metadata();
  if (meta.width !== formatSpec.width || meta.height !== formatSpec.height) {
    throw new Error(
      `Export size mismatch: expected ${formatSpec.width}x${formatSpec.height}, got ${meta.width}x${meta.height}`
    );
  }

  // Write with O_EXCL; advance suffix on collision. Never overwrite.
  const baseName = `${slugify(formatSpec.id)}-${formatSpec.width}x${formatSpec.height}`;
  const filePath = await writeUniquePng(outDir, baseName, pngBuffer);

  const stat = await fs.stat(filePath);
  if (stat.size > CRM_UPLOAD_CAP_BYTES) {
    warnings.push(
      `Export is ${stat.size} bytes, above the ${CRM_UPLOAD_CAP_BYTES}-byte (10 MB) CRM upload cap.`
    );
  }

  // Merge into export-manifest.json for approved assets with a known job
  let manifestUpdated = false;
  if (jobId && asset) {
    let approvedAt = asset.approvedAt;
    if (!approvedAt) {
      approvedAt = asset.updatedAt;
      warnings.push("approvedAt missing, used updatedAt");
    }
    const jobIdWarning = await mergeExportManifest(outDir, jobId, {
      formatSpecId: formatSpec.id,
      filePath,
      fileSizeBytes: stat.size,
      approvedAt,
    });
    if (jobIdWarning) {
      warnings.push(jobIdWarning);
    }
    manifestUpdated = true;
  }

  return {
    filePath,
    width: meta.width as number,
    height: meta.height as number,
    fileSizeBytes: stat.size,
    manifestUpdated,
    warnings,
  };
}

/**
 * Atomically read, merge, and write exports/export-manifest.json.
 * Replaces any prior entry with the same formatSpecId+filePath; never
 * deletes other entries. Writes to a temp file then renames.
 * If the existing manifest has a different jobId, merges anyway and
 * returns a warning describing the change.
 */
async function mergeExportManifest(
  exportsDir: string,
  jobId: string,
  entry: ExportManifest["assets"][number]
): Promise<string | undefined> {
  const manifestPath = path.join(exportsDir, "export-manifest.json");
  let manifest: ExportManifest = { jobId, assets: [] };
  let jobIdWarning: string | undefined;

  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as ExportManifest;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.assets)) {
      if (parsed.jobId && parsed.jobId !== jobId) {
        jobIdWarning = `export-manifest jobId changed from ${parsed.jobId} to ${jobId}`;
      }
      manifest = parsed;
    }
  } catch {
    // No existing manifest — start fresh
  }

  manifest.jobId = jobId;
  const idx = manifest.assets.findIndex(
    (a) => a.formatSpecId === entry.formatSpecId && a.filePath === entry.filePath
  );
  if (idx >= 0) {
    manifest.assets[idx] = entry;
  } else {
    manifest.assets.push(entry);
  }

  const tmpPath = `${manifestPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2), "utf-8");
  await fs.rename(tmpPath, manifestPath);

  return jobIdWarning;
}
