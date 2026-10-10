import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipc-channels";
import type { AiKeyStatus } from "../main/services/secure-storage-service";
import type { AiProviderName } from "../shared/types";
import type { VibeforgeProject, BrandKit, ProjectSummary, AdJob, AssetRecord } from "../shared/types";
import type { NewProjectInput, ProjectAndBrandKit } from "../main/services/project-service";
import type { NewAdJobInput } from "../main/services/job-service";
import type { GenerateTextInput, GeneratedCopy } from "../main/services/ai-text-service";
import type { AdDesignInput, AdDesignResult } from "../main/services/ai-ad-design-service";
import type { FontChoice } from "../shared/types";

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

  // ── Settings: OpenAI Key Management ──────────────────────────
  getOpenAIKeyStatus: (): Promise<AiKeyStatus> =>
    ipcRenderer.invoke(IpcChannels.SettingsGetOpenAIKeyStatus),

  setOpenAIKey: (key: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SettingsSetOpenAIKey, key),

  clearOpenAIKey: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SettingsClearOpenAIKey),

  // ── Settings: Provider Choice ────────────────────────────────
  getProviderChoice: (): Promise<AiProviderName> =>
    ipcRenderer.invoke(IpcChannels.SettingsGetProviderChoice),

  setProviderChoice: (provider: AiProviderName): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SettingsSetProviderChoice, provider),

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

  // ── Ad Jobs (Step 4) ────────────────────────────────────────
  createAdJob: (
    project: VibeforgeProject,
    brandKit: BrandKit,
    input: NewAdJobInput
  ): Promise<{ job: AdJob; assets: AssetRecord[] }> =>
    ipcRenderer.invoke(IpcChannels.AdJobCreate, project, brandKit, input),

  listAdJobs: (projectRootPath: string): Promise<AdJob[]> =>
    ipcRenderer.invoke(IpcChannels.AdJobList, projectRootPath),

  getAdJob: (projectRootPath: string, jobId: string): Promise<AdJob | null> =>
    ipcRenderer.invoke(IpcChannels.AdJobGet, projectRootPath, jobId),

  updateAdJobStatus: (
    projectRootPath: string,
    jobId: string,
    status: AdJob["status"]
  ): Promise<AdJob> =>
    ipcRenderer.invoke(IpcChannels.AdJobUpdateStatus, projectRootPath, jobId, status),

  deleteAdJob: (projectRootPath: string, jobId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.AdJobDelete, projectRootPath, jobId),

  // ── Asset Operations ────────────────────────────────

  updateAssetStatus: (
    project: VibeforgeProject,
    brandKit: BrandKit,
    assetId: string,
    status: AssetRecord["status"]
  ): Promise<VibeforgeProject> =>
    ipcRenderer.invoke(IpcChannels.AssetUpdateStatus, project, brandKit, assetId, status),

  // ── Job-Driven Generation ───────────────────────────

  generateFromJob: (
    job: AdJob,
    project: VibeforgeProject,
    brandKit: BrandKit
  ): Promise<{
    job: AdJob;
    assets: AssetRecord[];
    designPaths: Record<string, string>;
  }> =>
    ipcRenderer.invoke(IpcChannels.JobGenerate, job, project, brandKit),

  loadDesignForResult: (
    assetId: string,
    projectRootPath: string
  ): Promise<AdDesignResult | null> =>
    ipcRenderer.invoke("job:load-design", assetId, projectRootPath),

  // ── AI Text Generation (Step 5) ─────────────────

  generateAdCopy: (input: GenerateTextInput): Promise<GeneratedCopy> =>
    ipcRenderer.invoke(IpcChannels.AiGenerateCopy, input),

  // ── AI Ad Design (Step 6) ────────────────────────

  generateAdDesign: (input: AdDesignInput): Promise<AdDesignResult> =>
    ipcRenderer.invoke(IpcChannels.AiGenerateAdDesign, input),

  // ── Asset Export (render + watermark) ────────────────

  exportAsset: (
    design: AdDesignResult,
    formatSpec: { width: number; height: number; id: string },
    fonts?: FontChoice[],
    outputDir?: string
  ): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.AssetExport, design, formatSpec, fonts, outputDir),
};

contextBridge.exposeInMainWorld("vibeforge", vibeforgeApi);

export type VibeforgeApi = typeof vibeforgeApi;
