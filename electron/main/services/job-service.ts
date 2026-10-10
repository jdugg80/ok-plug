import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AdJob, AssetRecord, VibeforgeProject, BrandKit } from "../../shared/types";
import { FORMAT_CATALOG } from "../../shared/format-catalog";

export interface NewAdJobInput {
  businessName: string;
  brandKitId: string;
  requestedFormatIds: string[];
  creativeBrief: {
    keywords: string[];
    phrases: string[];
    referenceAssetPaths: string[];
    screenshotPaths: string[];
    toneOverride?: string;
  };
  dueAt?: string;
}

/**
 * Create a new AdJob and corresponding AssetRecords (one per format).
 * Writes the job to the project's jobs/ directory and appends assets
 * to the project's assets array.
 */
export async function createAdJob(
  project: VibeforgeProject,
  brandKit: BrandKit,
  input: NewAdJobInput
): Promise<{ job: AdJob; assets: AssetRecord[] }> {
  const jobId = randomUUID();
  const now = new Date().toISOString();

  const job: AdJob = {
    id: jobId,
    businessId: brandKit.id,
    businessName: input.businessName,
    brandKitId: input.brandKitId,
    requestedFormatIds: input.requestedFormatIds,
    creativeBrief: input.creativeBrief,
    status: "queued",
    createdAt: now,
    dueAt: input.dueAt,
  };

  // Create one AssetRecord per requested format
  const assets: AssetRecord[] = input.requestedFormatIds.map((formatId) => {
    const formatSpec = FORMAT_CATALOG.find((f) => f.id === formatId);
    return {
      id: randomUUID(),
      projectId: project.id,
      jobId,
      formatSpecId: formatId,
      name: `${brandKit.businessName} — ${formatSpec?.placement ?? formatId}`,
      type: "static-ad",
      status: "draft",
      dimensions: formatSpec
        ? { width: formatSpec.width, height: formatSpec.height }
        : undefined,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Write job to disk
  if (project.rootPath) {
    const jobsDir = path.join(project.rootPath, "jobs");
    await fs.mkdir(jobsDir, { recursive: true });
    await fs.writeFile(
      path.join(jobsDir, `${jobId}.json`),
      JSON.stringify(job, null, 2)
    );
  }

  return { job, assets };
}

/**
 * List all AdJobs in a project's jobs/ directory.
 */
export async function listAdJobs(projectRootPath: string): Promise<AdJob[]> {
  const jobsDir = path.join(projectRootPath, "jobs");
  try {
    const files = await fs.readdir(jobsDir);
    const jobs: AdJob[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const content = await fs.readFile(path.join(jobsDir, file), "utf-8");
      jobs.push(JSON.parse(content));
    }
    return jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Get a single AdJob by ID.
 */
export async function getAdJob(
  projectRootPath: string,
  jobId: string
): Promise<AdJob | null> {
  try {
    const content = await fs.readFile(
      path.join(projectRootPath, "jobs", `${jobId}.json`),
      "utf-8"
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Update an AdJob's status. Writes the updated job back to disk.
 */
export async function updateAdJobStatus(
  projectRootPath: string,
  jobId: string,
  status: AdJob["status"]
): Promise<AdJob> {
  const jobPath = path.join(projectRootPath, "jobs", `${jobId}.json`);
  const content = await fs.readFile(jobPath, "utf-8");
  const job: AdJob = JSON.parse(content);
  job.status = status;
  await fs.writeFile(jobPath, JSON.stringify(job, null, 2));
  return job;
}

/**
 * Delete an AdJob and its JSON file.
 * Does NOT remove assets from the project — that's handled by the caller.
 */
export async function deleteAdJob(
  projectRootPath: string,
  jobId: string
): Promise<void> {
  try {
    await fs.unlink(path.join(projectRootPath, "jobs", `${jobId}.json`));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Update the status of a single asset within a project.
 * Finds the asset by ID in the project's assets array, updates its status,
 * and saves the project.
 */
export async function updateAssetStatus(
  project: VibeforgeProject,
  brandKit: BrandKit,
  assetId: string,
  status: AssetRecord["status"]
): Promise<VibeforgeProject> {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  asset.status = status;
  asset.updatedAt = new Date().toISOString();

  // Save project
  if (project.rootPath) {
    const projectFilePath = path.join(project.rootPath, "project.vfproject.json");
    const fileContents = {
      project: { ...project, rootPath: undefined },
      brandKit,
    };
    await fs.writeFile(projectFilePath, JSON.stringify(fileContents, null, 2));
  }

  return project;
}
