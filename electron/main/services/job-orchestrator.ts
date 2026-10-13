/**
 * Job Orchestrator
 * Drives the full generation pipeline from an AdJob:
 *   Job (queued) → iterate formats → AI generate → persist design JSON → update statuses
 */

import { promises as fs } from "fs";
import path from "path";
import type { AdJob, AssetRecord, VibeforgeProject, BrandKit } from "../../shared/types";
import type { AdDesignResult } from "./ai-ad-design-service";
import { generateAdDesign, type AdDesignInput } from "./ai-ad-design-service";
import { buildAdDesignInput } from "../../shared/build-ad-design-input";
import { updateAdJobStatus } from "./job-service";
import { FORMAT_CATALOG } from "../../shared/format-catalog";

export interface GenerateFromJobResult {
  job: AdJob;
  assets: AssetRecord[];
  designPaths: Record<string, string>; // assetId → design JSON path
}

/**
 * Generate ads for all formats in a job.
 *
 * Pipeline:
 * 1. Set job status → "in-progress"
 * 2. For each requested format:
 *    a. Set asset status → "generating"
 *    b. Call AI to generate AdDesignResult
 *    c. Save design JSON to renders/{assetId}-design.json
 *    d. Set asset status → "ready"
 * 3. Set job status → "needs-review"
 * 4. Save updated project with asset changes
 */
export async function generateFromJob(
  job: AdJob,
  project: VibeforgeProject,
  brandKit: BrandKit,
  onProgress?: (message: string) => void
): Promise<GenerateFromJobResult> {
  if (!project.rootPath) {
    throw new Error("Project has no root path");
  }

  const rendersDir = path.join(project.rootPath, "renders");
  await fs.mkdir(rendersDir, { recursive: true });

  // Step 1: Set job status → "in-progress"
  onProgress?.(`Starting job for ${job.businessName}...`);
  await updateAdJobStatus(project.rootPath, job.id, "in-progress");
  job.status = "in-progress";

  const designPaths: Record<string, string> = {};
  const updatedAssets: AssetRecord[] = [];

  // Step 2: Generate for each format
  for (let i = 0; i < job.requestedFormatIds.length; i++) {
    const formatId = job.requestedFormatIds[i];
    const formatSpec =
      FORMAT_CATALOG.find((f) => f.id === formatId) ??
      job.customFormatSpecs?.find((f) => f.id === formatId);

    // Find the corresponding asset in the project
    const asset = project.assets.find(
      (a) => a.jobId === job.id && a.formatSpecId === formatId
    );

    if (!asset) {
      onProgress?.(`Asset not found for ${formatId}, skipping...`);
      continue;
    }

    onProgress?.(
      `Generating ${formatSpec?.platform} ${formatSpec?.placement}... (${i + 1}/${job.requestedFormatIds.length})`
    );

    // Set asset status → "generating"
    asset.status = "generating";
    asset.updatedAt = new Date().toISOString();

    try {
      const input: AdDesignInput = buildAdDesignInput(
        formatSpec!,
        brandKit,
        job.creativeBrief,
        { projectRootPath: project.rootPath }
      );

      // Generate design via AI
      const design: AdDesignResult = await generateAdDesign(input);

      // Save design JSON to disk
      const designFileName = `${asset.id}-design.json`;
      const designPath = path.join(rendersDir, designFileName);
      await fs.writeFile(designPath, JSON.stringify(design, null, 2));

      // Update asset
      asset.status = "ready";
      asset.filePath = designPath;
      asset.updatedAt = new Date().toISOString();

      // Log the generation
      asset.aiGenerationLog = [
        ...(asset.aiGenerationLog || []),
        {
          prompt: JSON.stringify(input),
          model: "ai-provider",
          generatedAt: new Date().toISOString(),
        },
      ];

      designPaths[asset.id] = designPath;
      updatedAssets.push(asset);
    } catch (err) {
      console.error(`Failed to generate for ${formatId}:`, err);
      asset.status = "draft"; // Revert on failure
      asset.updatedAt = new Date().toISOString();
    }
  }

  // Step 3: Set job status → "needs-review"
  onProgress?.("Generation complete. Updating job status...");
  await updateAdJobStatus(project.rootPath, job.id, "needs-review");
  job.status = "needs-review";

  // Step 4: Save the project with updated assets
  const projectFilePath = path.join(project.rootPath, "project.vfproject.json");
  const fileContents = {
    project: { ...project, rootPath: undefined },
    brandKit,
  };
  await fs.writeFile(projectFilePath, JSON.stringify(fileContents, null, 2));

  onProgress?.("Done!");

  return {
    job,
    assets: updatedAssets,
    designPaths,
  };
}

/**
 * Load a design result from disk for a given asset.
 */
export async function loadDesignForResult(
  assetId: string,
  projectRootPath: string
): Promise<AdDesignResult | null> {
  try {
    const designPath = path.join(projectRootPath, "renders", `${assetId}-design.json`);
    const content = await fs.readFile(designPath, "utf-8");
    return JSON.parse(content) as AdDesignResult;
  } catch {
    return null;
  }
}
