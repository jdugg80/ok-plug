import { ipcMain, dialog, app, BrowserWindow } from "electron";
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
  type NewProjectInput,
  type ProjectAndBrandKit,
} from "../services/project-service";
import {
  createAdJob,
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
import type { AdJob, AssetRecord } from "../../shared/types";

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
