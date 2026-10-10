import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { IpcChannels } from "../../shared/ipc-channels";
import type { VibeforgeProject, BrandKit } from "../../shared/types";
import { mapDbToBrandKit, mapDbToAdJob, mapIntakeStatusToJob, getNextIntakeStatus, getPreviousIntakeStatus, AdIntakeDBRow } from "../services/intake-service";
import type { AdJob, AssetRecord } from "../../shared/types";

/**
 * Register all IPC handlers. Called once from main during app ready.
 * getMainWindow is needed by the dialog handlers, which must attach to
 * a parent window.
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // ── Settings: AI Key Management ──────────────────────────────
  ipcMain.handle(IpcChannels.SettingsGetAiKeyStatus, async () => {
    return "key-status";
  });

  ipcMain.handle(
    IpcChannels.SettingsSetAiKey,
    async (_event, rawKey: string) => {}
  );

  ipcMain.handle(IpcChannels.SettingsClearAiKey, async () => {});

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
  ipcMain.handle(IpcChannels.ProjectCreate, async (_event, input: any) => {
    return { project: { id: "temp" }, brandKit: { id: "temp", businessName: "temp" } };
  });

  ipcMain.handle(IpcChannels.ProjectOpen, async (_event, rootPath: string) => {
    return { project: { id: "temp" }, brandKit: { id: "temp", businessName: "temp" } };
  });

  ipcMain.handle(IpcChannels.ProjectSave, async (_event, project: any, brandKit: any) => {});

  ipcMain.handle(IpcChannels.ProjectList, async () => []);
  // ── Ad Jobs (Step 4) ────────────────────────────────────────
  ipcMain.handle(
    IpcChannels.AdJobCreate,
    async (_event, project: any, brandKit: any, input: any) => {
      const adJob: AdJob = {
        id: "temp-job-id",
        businessId: "",
        businessName: input?.businessName || "Unknown",
        brandKitId: "",
        requestedFormatIds: input?.requestedFormatIds || ["facebook-feed-universal-1x1"],
        creativeBrief: input?.creativeBrief || { keywords: [], phrases: [], toneOverride: undefined },
        status: "queued",
        createdAt: new Date().toISOString(),
        dueAt: undefined,
      };
      const assets: AssetRecord[] = [];
      return { job: adJob, assets };
    }
  );

  ipcMain.handle(IpcChannels.AdJobList, async (_event, projectRootPath: string) => []);
  ipcMain.handle(
    IpcChannels.AdJobGet,
    async (_event, projectRootPath: string, jobId: string) => null
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