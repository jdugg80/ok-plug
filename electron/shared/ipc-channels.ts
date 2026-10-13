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

  // OpenAI key management
  SettingsGetOpenAIKeyStatus: "settings:get-openai-key-status",
  SettingsSetOpenAIKey: "settings:set-openai-key",
  SettingsClearOpenAIKey: "settings:clear-openai-key",

  // Provider choice
  SettingsGetProviderChoice: "settings:get-provider-choice",
  SettingsSetProviderChoice: "settings:set-provider-choice",

  // Ad Jobs (Step 4)
  AdJobCreate: "ad-job:create",
  AdJobList: "ad-job:list",
  AdJobGet: "ad-job:get",
  AdJobUpdateStatus: "ad-job:update-status",
  AdJobDelete: "ad-job:delete",

  // Asset operations
  AssetUpdateStatus: "asset:update-status",
  AssetImport: "asset:import",
  AssetReadImage: "asset:read-image",

  // AI Text Generation (Step 5)
  AiGenerateCopy: "ai:generate-copy",

  // AI Ad Design (Step 6)
  AiGenerateAdDesign: "ai:generate-ad-design",

  // Job-driven generation
  JobGenerate: "job:generate",
  JobLoadDesign: "job:load-design",

  // Asset Export (render + watermark + save)
  AssetExport: "asset:export",

  // Unity Core import
  UnityImportManifest: "unity:import-manifest",

  // App info
  AppGetVersion: "app:get-version",
} as const;

export type IpcChannelName = (typeof IpcChannels)[keyof typeof IpcChannels];
