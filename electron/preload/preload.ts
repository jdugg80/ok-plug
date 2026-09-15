import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipc-channels";
import type { AiKeyStatus } from "../main/services/secure-storage-service";

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
};

contextBridge.exposeInMainWorld("vibeforge", vibeforgeApi);

export type VibeforgeApi = typeof vibeforgeApi;
