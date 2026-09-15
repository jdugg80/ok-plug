import { ipcMain } from "electron";
import { IpcChannels } from "../../shared/ipc-channels";
import {
  getAnthropicKeyStatus,
  setAnthropicKey,
  clearAnthropicKey,
} from "../services/secure-storage-service";

/**
 * Register all IPC handlers. Called once from main during app ready.
 */
export function registerIpcHandlers(): void {
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
    const { app } = await import("electron");
    return app.getVersion();
  });
}
