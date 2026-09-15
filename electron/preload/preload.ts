import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipc-channels";
import type { AiKeyStatus } from "../main/services/secure-storage-service";
import type { VibeforgeProject, BrandKit, ProjectSummary } from "../shared/types";
import type { NewProjectInput, ProjectAndBrandKit } from "../main/services/project-service";

/**
 * Exposed to the renderer via contextBridge.
 * The raw API key is never exposed — only AiKeyStatus.
 */
const vibeforgeApi = {
  // ── App Info ─────────────────────────────────────────────────
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.AppGetVersion),

  // ── Settings: AI Key Management ──────────────────────────────
  getAiKeyStatus: (): Promise<AiKeyStatus> =>
    ipcRenderer.invoke(IpcChannels.SettingsGetAiKeyStatus),

  setAiApiKey: (key: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SettingsSetAiKey, key),

  clearAiApiKey: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SettingsClearAiKey),

  // ── Dialogs ──────────────────────────────────────────────────
  showOpenDialog: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DialogShowOpen),

  showSaveDialog: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DialogShowSave, defaultPath),

  // ── Project ──────────────────────────────────────────────────
  createProject: (input: NewProjectInput): Promise<ProjectAndBrandKit> =>
    ipcRenderer.invoke(IpcChannels.ProjectCreate, input),

  openProject: (rootPath: string): Promise<ProjectAndBrandKit> =>
    ipcRenderer.invoke(IpcChannels.ProjectOpen, rootPath),

  saveProject: (project: VibeforgeProject, brandKit: BrandKit): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ProjectSave, project, brandKit),

  listProjects: (): Promise<ProjectSummary[]> =>
    ipcRenderer.invoke(IpcChannels.ProjectList),
};

contextBridge.exposeInMainWorld("vibeforge", vibeforgeApi);

export type VibeforgeApi = typeof vibeforgeApi;
