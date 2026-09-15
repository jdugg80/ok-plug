/**
 * IPC channel names shared between main and renderer processes.
 * Use these constants on both sides to avoid typos.
 */

export const IpcChannels = {
  // Project operations
  ProjectCreate: "project:create",
  ProjectOpen: "project:open",
  ProjectSave: "project:save",
  ProjectList: "project:list",

  // Dialog operations
  DialogShowOpen: "dialog:show-open",
  DialogShowSave: "dialog:show-save",

  // Settings / AI key management (Step 3)
  SettingsGetAiKeyStatus: "settings:get-ai-key-status",
  SettingsSetAiKey: "settings:set-ai-key",
  SettingsClearAiKey: "settings:clear-ai-key",

  // App info
  AppGetVersion: "app:get-version",
} as const;

export type IpcChannelName = (typeof IpcChannels)[keyof typeof IpcChannels];
