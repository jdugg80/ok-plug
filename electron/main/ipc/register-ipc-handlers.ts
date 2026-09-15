import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { IpcChannels } from "../../shared/ipc-channels";
import type { VibeforgeProject, BrandKit } from "../../shared/types";
import {
  getAnthropicKeyStatus,
  setAnthropicKey,
  clearAnthropicKey,
} from "../services/secure-storage-service";
import {
  createProject,
  openProject,
  saveProject,
  listRecentProjects,
  type NewProjectInput,
  type ProjectAndBrandKit,
} from "../services/project-service";

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
}
