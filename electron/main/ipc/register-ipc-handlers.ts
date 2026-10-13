import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { IpcChannels } from "../../shared/ipc-channels";
import type { VibeforgeProject, BrandKit } from "../../shared/types";
import {
  getAnthropicKeyStatus,
  setAnthropicKey,
  clearAnthropicKey,
  getOpenAIKeyStatus,
  setOpenAIKey,
  clearOpenAIKey,
  getProviderChoice,
  setProviderChoice,
} from "../services/secure-storage-service";
import type { AiProviderName } from "../../shared/types";
import {
  createProject,
  openProject,
  saveProject,
  listRecentProjects,
  importAssetIntoProject,
  readProjectImageAsDataUri,
  IMPORTABLE_IMAGE_EXTENSIONS,
  ASSET_IMPORT_MAX_BYTES,
  type NewProjectInput,
  type ProjectAndBrandKit,
} from "../services/project-service";
import {
  createAdJob,
  addFormatsToJob,
  listAdJobs,
  getAdJob,
  updateAdJobStatus,
  deleteAdJob,
  updateAssetStatus,
  type NewAdJobInput,
} from "../services/job-service";
import { mapDbToBrandKit, mapDbToAdJob, mapIntakeStatusToJob, getNextIntakeStatus, getPreviousIntakeStatus, AdIntakeDBRow } from "../services/intake-service";
import { generateAdCopy, type GenerateTextInput } from "../services/ai-text-service";
import { generateAdDesign, type AdDesignInput } from "../services/ai-ad-design-service";
import { generateFromJob, loadDesignForResult } from "../services/job-orchestrator";
import { exportAdToPng } from "../services/export-service";
import { validateManifest, mapManifest } from "../services/unity-import-service";
import type { AdJob, AssetRecord, SourceAsset } from "../../shared/types";

/**
 * Register all IPC handlers. Called once from main during app ready.
 * getMainWindow is needed by the dialog handlers, which must attach to
 * a parent window.
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // ── Settings: AI Key Management ──────────────────────────────

  ipcMain.handle(IpcChannels.SettingsGetAiKeyStatus, async () => {
    return getAnthropicKeyStatus();
  });

  ipcMain.handle(
    IpcChannels.SettingsSetAiKey,
    async (_event, rawKey: string) => {
      await setAnthropicKey(rawKey);
    }
  );

  ipcMain.handle(IpcChannels.SettingsClearAiKey, async () => {
    await clearAnthropicKey();
  });

  // ── Settings: OpenAI Key Management ──────────────────────────

  ipcMain.handle(IpcChannels.SettingsGetOpenAIKeyStatus, async () => {
    return getOpenAIKeyStatus();
  });

  ipcMain.handle(
    IpcChannels.SettingsSetOpenAIKey,
    async (_event, rawKey: string) => {
      await setOpenAIKey(rawKey);
    }
  );

  ipcMain.handle(IpcChannels.SettingsClearOpenAIKey, async () => {
    await clearOpenAIKey();
  });

  // ── Settings: Provider Choice ────────────────────────────────

  ipcMain.handle(IpcChannels.SettingsGetProviderChoice, async () => {
    return getProviderChoice();
  });

  ipcMain.handle(
    IpcChannels.SettingsSetProviderChoice,
    async (_event, provider: AiProviderName) => {
      await setProviderChoice(provider);
    }
  );

  // ── App Info ─────────────────────────────────────────────────

  ipcMain.handle(IpcChannels.AppGetVersion, async () => {
    return app.getVersion();
  });

  // ── Dialogs ──────────────────────────────────────────────────

  ipcMain.handle(IpcChannels.DialogShowOpen, async (): Promise<string | null> => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      title: "Choose a folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.DialogShowSave, async (_event, defaultPath?: string): Promise<string | null> => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showSaveDialog(win, {
      title: "Save",
      defaultPath,
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  // ── Project ──────────────────────────────────────────────────

  ipcMain.handle(
    IpcChannels.ProjectCreate,
    async (_event, input: NewProjectInput): Promise<ProjectAndBrandKit> => {
      return createProject(input);
    }
  );

  ipcMain.handle(
    IpcChannels.ProjectOpen,
    async (_event, rootPath: string): Promise<ProjectAndBrandKit> => {
      return openProject(rootPath);
    }
  );

  ipcMain.handle(
    IpcChannels.ProjectSave,
    async (_event, project: VibeforgeProject, brandKit: BrandKit): Promise<void> => {
      return saveProject(project, brandKit);
    }
  );

  ipcMain.handle(IpcChannels.ProjectList, async () => {
    return listRecentProjects();
  });

  // ── Ad Jobs (Step 4) ────────────────────────────────────────

  ipcMain.handle(
    IpcChannels.AdJobCreate,
    async (
      _event,
      project: VibeforgeProject,
      brandKit: BrandKit,
      input: NewAdJobInput
    ): Promise<{ job: AdJob; assets: AssetRecord[] }> => {
      return createAdJob(project, brandKit, input);
    }
  );

  ipcMain.handle(
    IpcChannels.AdJobList,
    async (_event, projectRootPath: string): Promise<AdJob[]> => {
      return listAdJobs(projectRootPath);
    }
  );

  ipcMain.handle(
    IpcChannels.AdJobGet,
    async (
      _event,
      projectRootPath: string,
      jobId: string
    ): Promise<AdJob | null> => {
      return getAdJob(projectRootPath, jobId);
    }
  );

  ipcMain.handle(
    IpcChannels.AdJobUpdateStatus,
    async (
      _event,
      projectRootPath: string,
      jobId: string,
      status: AdJob["status"]
    ): Promise<AdJob> => {
      return updateAdJobStatus(projectRootPath, jobId, status);
    }
  );

  ipcMain.handle(
    IpcChannels.AdJobDelete,
    async (_event, projectRootPath: string, jobId: string): Promise<void> => {
      await deleteAdJob(projectRootPath, jobId);
    }
  );

  // ── Asset Operations ─────────────────────────────────────────

  ipcMain.handle(
    IpcChannels.AssetUpdateStatus,
    async (
      _event,
      project: VibeforgeProject,
      brandKit: BrandKit,
      assetId: string,
      status: AssetRecord["status"]
    ): Promise<VibeforgeProject> => {
      return updateAssetStatus(project, brandKit, assetId, status);
    }
  );

  // Import a user-picked file into the project folder (Brand Kit v2).
  // The source file is copied, never moved or modified. Returns null on cancel.
  ipcMain.handle(
    IpcChannels.AssetImport,
    async (
      _event,
      projectRootPath: string,
      kind: SourceAsset["kind"] = "logo"
    ): Promise<SourceAsset | null> => {
      if (!projectRootPath) {
        throw new Error("No project root path supplied.");
      }
      const options: Electron.OpenDialogOptions = {
        title: "Choose an image",
        properties: ["openFile"],
        filters: [
          { name: "Images", extensions: [...IMPORTABLE_IMAGE_EXTENSIONS] },
        ],
      };
      const win = getMainWindow();
      const picked = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (picked.canceled || picked.filePaths.length === 0) {
        return null;
      }
      return importAssetIntoProject(projectRootPath, picked.filePaths[0], kind);
    }
  );

  // Reads a project-relative image as a data URI. Guarded against paths
  // escaping the project folder and against non-image extensions, and capped
  // by the same 5 MB limit as import.
  ipcMain.handle(
    IpcChannels.AssetReadImage,
    async (_event, projectRootPath: string, relativePath: string): Promise<string> => {
      if (!projectRootPath) {
        throw new Error("No project root path supplied.");
      }
      const dataUri = await readProjectImageAsDataUri(projectRootPath, relativePath);
      if (dataUri.length > ASSET_IMPORT_MAX_BYTES * 1.34) {
        throw new Error("Image is too large to load.");
      }
      return dataUri;
    }
  );

  // ── AI Text Generation (Step 5) ──────────────────────────────

  ipcMain.handle(
    IpcChannels.AiGenerateCopy,
    async (_event, input: GenerateTextInput) => {
      return generateAdCopy(input);
    }
  );

  // ── AI Ad Design (Step 6) ────────────────────────────────────

  ipcMain.handle(
    IpcChannels.AiGenerateAdDesign,
    async (_event, input: AdDesignInput) => {
      return generateAdDesign(input);
    }
  );

  // ── Job-Driven Generation ────────────────────────────────────

  ipcMain.handle(
    IpcChannels.JobGenerate,
    async (
      _event,
      job: AdJob,
      project: VibeforgeProject,
      brandKit: BrandKit
    ) => {
      return generateFromJob(job, project, brandKit);
    }
  );

  ipcMain.handle(
    IpcChannels.JobLoadDesign,
    async (_event, assetId: string, projectRootPath: string) => {
      return loadDesignForResult(assetId, projectRootPath);
    }
  );

  // ── Asset Export (exact-size PNG, no watermark) ──────────────

  ipcMain.handle(
    IpcChannels.AssetExport,
    async (
      _event,
      design: import("../services/ai-ad-design-service").AdDesignResult,
      formatSpec: { width: number; height: number; id: string },
      fonts?: import("../../shared/types").FontChoice[],
      outputDir?: string,
      projectRootPath?: string,
      jobId?: string,
      assetId?: string
    ): Promise<import("../services/export-service").ExportAssetResult> => {
      // jobId, assetId and projectRootPath are all required. Load the
      // project, find the asset, and only proceed if it is approved.
      if (!jobId || !assetId || !projectRootPath) {
        throw new Error(
          "jobId, assetId and projectRootPath are required to export."
        );
      }
      const { project, brandKit } = await openProject(projectRootPath);
      const asset = project.assets.find((a: AssetRecord) => a.id === assetId);
      if (!asset) {
        throw new Error(`Export refused: asset ${assetId} not found in project.`);
      }
      if (asset.status !== "approved") {
        throw new Error(
          `Export refused: asset ${assetId} status is "${asset.status}", not "approved".`
        );
      }

      // Job-level disclaimers merge (job-first, deduped) into the brand fine
      // print that the app draws into the footer. Missing job is not fatal.
      let requiredDisclaimers: string | undefined;
      if (jobId) {
        const job = await getAdJob(projectRootPath, jobId);
        requiredDisclaimers = job?.creativeBrief?.requiredDisclaimers;
      }

      return exportAdToPng({
        design,
        formatSpec,
        fonts,
        outputDir,
        projectRootPath,
        jobId,
        asset,
        brandKit,
        requiredDisclaimers,
      });
    }
  );

  // ── Unity Core Import ─────────────────────────────────────────

  ipcMain.handle(
    IpcChannels.UnityImportManifest,
    async (): Promise<{
      project: VibeforgeProject;
      brandKit: BrandKit;
      job: AdJob;
      skipped: import("../services/unity-import-service").SkippedFormat[];
      warnings: string[];
      created: boolean;
    }> => {
      // 1. Pick the campaign folder (starts at the Unity Core export root)
      const defaultCampaignDir = "D:\\OKM client advertising";
      const campaignDirOpts: Electron.OpenDialogOptions = {
        title: "Choose Unity Core campaign folder",
        properties: ["openDirectory"],
        defaultPath: defaultCampaignDir,
      };
      const win = getMainWindow();
      const campaignPick = win
        ? await dialog.showOpenDialog(win, campaignDirOpts)
        : await dialog.showOpenDialog(campaignDirOpts);
      if (campaignPick.canceled || campaignPick.filePaths.length === 0) {
        throw new Error("No campaign folder selected.");
      }
      const campaignFolder = campaignPick.filePaths[0];

      // 2. Read + validate manifest.json
      const manifestPath = path.join(campaignFolder, "manifest.json");
      let rawText: string;
      try {
        rawText = await fs.readFile(manifestPath, "utf-8");
      } catch {
        throw new Error(`No manifest.json in ${campaignFolder}`);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(rawText);
      } catch {
        throw new Error("manifest.json is not valid JSON.");
      }
      const validated = validateManifest(raw);
      if (!validated.ok || !validated.manifest) {
        throw new Error(`Manifest is invalid:\n${validated.errors.join("\n")}`);
      }
      const warnings = [...validated.warnings];
      const mapped = mapManifest(validated.manifest, campaignFolder);
      warnings.push(...mapped.warnings);

      const adIntakeId = validated.manifest.unity.adIntakeId;
      const campaignId = validated.manifest.unity.campaignId;

      // 3. Idempotent lookup: scan recent projects (max 20) for this adIntakeId
      const recent = await listRecentProjects();
      let existing: { rootPath: string; project: VibeforgeProject; brandKit: BrandKit } | null =
        null;
      const limit = Math.min(recent.length, 20);
      for (let i = 0; i < limit; i++) {
        try {
          const opened = await openProject(recent[i].rootPath);
          if (opened.project.unity?.adIntakeId === adIntakeId) {
            existing = {
              rootPath: recent[i].rootPath,
              project: opened.project,
              brandKit: opened.brandKit,
            };
            break;
          }
        } catch {
          // stale/broken recent entry — skip
        }
      }

      if (existing) {
        // ── UPDATE path: fill empty fields + add formats only ──
        const { project, brandKit } = existing;

        // Refresh unity metadata (folder may have moved; schema version may have bumped)
        project.unity = {
          ...project.unity!,
          campaignId,
          campaignFolder,
          manifestSchemaVersion: validated.manifest.schemaVersion,
          importedAt: new Date().toISOString(),
        };

        // Brand kit: fill ONLY empty fields — never overwrite existing edits
        if (brandKit.colors.length === 0 && mapped.brandKitPatch.colors) {
          brandKit.colors = mapped.brandKitPatch.colors;
        }
        if (brandKit.vibeTags.length === 0 && mapped.brandKitPatch.vibeTags) {
          brandKit.vibeTags = mapped.brandKitPatch.vibeTags;
        }
        if (brandKit.toneTags.length === 0 && mapped.brandKitPatch.toneTags) {
          brandKit.toneTags = mapped.brandKitPatch.toneTags;
        }
        if (!brandKit.website && mapped.brandKitPatch.website) {
          brandKit.website = mapped.brandKitPatch.website;
        }
        if (!brandKit.businessName && mapped.brandKitPatch.businessName) {
          brandKit.businessName = mapped.brandKitPatch.businessName;
        }

        // Job: find by unityCoreJobId, or create
        const jobs = await listAdJobs(project.rootPath!);
        let job = jobs.find((j) => j.unityCoreJobId === campaignId) ?? null;

        if (job) {
          // ADD new format ids / custom specs + new AssetRecords only —
          // never remove or overwrite existing assets/designs/statuses
          await addFormatsToJob(
            project,
            job,
            mapped.jobInput.requestedFormatIds,
            mapped.customFormatSpecs
          );
        } else {
          const created = await createAdJob(project, brandKit, {
            businessName: mapped.jobInput.businessName,
            brandKitId: brandKit.id,
            requestedFormatIds: mapped.jobInput.requestedFormatIds,
            creativeBrief: mapped.jobInput.creativeBrief,
            customFormatSpecs: mapped.customFormatSpecs,
            unityCoreJobId: campaignId,
          });
          job = created.job;
          project.assets.push(...created.assets);
        }

        brandKit.updatedAt = new Date().toISOString();
        await saveProject(project, brandKit);
        return { project, brandKit, job, skipped: mapped.skipped, warnings, created: false };
      }

      // ── CREATE path: project lives in Vibeforge's normal location ──
      const parentOpts: Electron.OpenDialogOptions = {
        title: "Choose where to create the Vibeforge project",
        properties: ["openDirectory"],
        defaultPath: app.getPath("documents"),
      };
      const parentPick = win
        ? await dialog.showOpenDialog(win, parentOpts)
        : await dialog.showOpenDialog(parentOpts);
      if (parentPick.canceled || parentPick.filePaths.length === 0) {
        throw new Error("No project location selected.");
      }
      const parentDirectory = parentPick.filePaths[0];

      const { project, brandKit } = await createProject({
        name: mapped.projectInput.name,
        businessName: mapped.projectInput.businessName,
        website: mapped.projectInput.website,
        notes: mapped.projectInput.notes,
        parentDirectory,
      });

      // Apply brand kit patch (fields were empty on a fresh project)
      if (mapped.brandKitPatch.businessName) brandKit.businessName = mapped.brandKitPatch.businessName;
      if (mapped.brandKitPatch.colors) brandKit.colors = mapped.brandKitPatch.colors;
      if (mapped.brandKitPatch.vibeTags) brandKit.vibeTags = mapped.brandKitPatch.vibeTags;
      if (mapped.brandKitPatch.toneTags) brandKit.toneTags = mapped.brandKitPatch.toneTags;
      if (mapped.brandKitPatch.website) brandKit.website = mapped.brandKitPatch.website;

      project.unity = mapped.projectInput.unity;

      // Persist project + unity block + brand patch BEFORE createAdJob so a
      // later failure cannot leave a project without its unity block.
      await saveProject(project, brandKit);

      const { job, assets } = await createAdJob(project, brandKit, {
        businessName: mapped.jobInput.businessName,
        brandKitId: brandKit.id,
        requestedFormatIds: mapped.jobInput.requestedFormatIds,
        creativeBrief: mapped.jobInput.creativeBrief,
        customFormatSpecs: mapped.customFormatSpecs,
        unityCoreJobId: campaignId,
      });
      project.assets.push(...assets);

      await saveProject(project, brandKit);
      return { project, brandKit, job, skipped: mapped.skipped, warnings, created: true };
    }
  );

  // ── Ad Intake Migration (Migration 097) ─────────────────────
  ipcMain.handle(
    "intake:migrate",
    async (_event, dbRow: any) => {
      // Map DB row to BrandKit
      const brandKit: BrandKit = mapDbToBrandKit({
        id: dbRow.id,
        request_type: dbRow.request_type,
        source: dbRow.source,
        contact_name: dbRow.contact_name,
        contact_email: dbRow.contact_email,
        contact_phone: dbRow.contact_phone,
        secondary_contact_name: dbRow.secondary_contact_name,
        secondary_contact_email: dbRow.secondary_contact_email,
        secondary_contact_phone: dbRow.secondary_contact_phone,
        status: dbRow.status,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
      });

      // Map DB row to AdJob
      const adJob: AdJob = mapDbToAdJob({
        id: dbRow.id,
        request_type: dbRow.request_type,
        source: dbRow.source,
        contact_name: dbRow.contact_name,
        contact_email: dbRow.contact_email,
        contact_phone: dbRow.contact_phone,
        secondary_contact_name: dbRow.secondary_contact_name,
        secondary_contact_email: dbRow.secondary_contact_email,
        secondary_contact_phone: dbRow.secondary_contact_phone,
        status: dbRow.status,
        created_at: dbRow.created_at,
        updated_at: dbRow.updated_at,
      });

      // Create a minimal project
      const project: VibeforgeProject = {
        id: "temp-project-" + dbRow.id,
        name: dbRow.contact_name || "Unnamed Project",
        businessName: dbRow.contact_name || "Unknown",
        businessId: "",
        website: "",
        industry: "advertising",
        notes: `Migrated from ad_intake id:${dbRow.id}, source:${dbRow.source}, status:${dbRow.status}`,
        brandKitId: brandKit.id,
        assets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectVersion: 1,
      };

      return { brandKit, adJob, project };
    }
  );

  // ── Intake Status Helpers ──────────────────────────────────
  ipcMain.handle(
    "intake:status:map",
    async (_event, status: string) => {
      return mapIntakeStatusToJob(status as AdIntakeDBRow["status"]);
    }
  );

  ipcMain.handle(
    "intake:status:previous",
    async (_event, status: string) => {
      const previous: any = {
        submitted: null,
        scanned: "submitted",
        quoted: "scanned",
        approved: "quoted",
        active: "approved",
        completed: "active",
        archived: "completed",
      };
      return previous[status] || null;
    }
  );

  ipcMain.handle(
    "intake:status:next",
    async (_event, status: string) => {
      const next: any = {
        submitted: "scanned",
        scanned: "quoted",
        quoted: "approved",
        approved: "active",
        active: "completed",
        completed: "archived",
        archived: null,
      };
      return next[status] || null;
    }
  );
}
