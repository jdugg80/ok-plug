import { create } from "zustand";
import type {
  VibeforgeProject,
  BrandKit,
  ProjectSummary,
  AdJob,
} from "@/types/domain";
import type { NewAdJobInput } from "../../electron/main/services/job-service";

const AUTOSAVE_DELAY_MS = 1200;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

interface ProjectStoreState {
  activeProject: VibeforgeProject | null;
  activeBrandKit: BrandKit | null;
  recentProjects: ProjectSummary[];
  jobs: AdJob[];
  isLoading: boolean;
  saveStatus: "idle" | "pending" | "saving" | "saved" | "error";
  error: string | null;

  refreshRecentProjects: () => Promise<void>;
  createProject: (input: {
    name: string;
    businessName: string;
    website?: string;
    industry?: string;
  }) => Promise<boolean>;
  openProjectViaDialog: () => Promise<boolean>;
  openProjectByPath: (rootPath: string) => Promise<boolean>;
  updateBrandKit: (partial: Partial<BrandKit>) => void;
  saveActiveProject: () => Promise<void>;
  closeProject: () => void;
  createAdJob: (input: NewAdJobInput) => Promise<void>;
  loadJobs: () => Promise<void>;
  updateJobStatus: (jobId: string, status: AdJob["status"]) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  generateFromJob: (jobId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  activeProject: null,
  activeBrandKit: null,
  recentProjects: [],
  jobs: [],
  isLoading: false,
  saveStatus: "idle",
  error: null,

  refreshRecentProjects: async () => {
    const recentProjects = await window.vibeforge.listProjects();
    set({ recentProjects });
  },

  createProject: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const parentDirectory = await window.vibeforge.showOpenDialog();
      if (!parentDirectory) {
        set({ isLoading: false });
        return false;
      }
      const { project, brandKit } = await window.vibeforge.createProject({
        ...input,
        parentDirectory,
      });
      set({ activeProject: project, activeBrandKit: brandKit, jobs: [], isLoading: false });
      await get().refreshRecentProjects();
      return true;
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      return false;
    }
  },

  openProjectViaDialog: async () => {
    set({ isLoading: true, error: null });
    try {
      const rootPath = await window.vibeforge.showOpenDialog();
      if (!rootPath) {
        set({ isLoading: false });
        return false;
      }
      const { project, brandKit } = await window.vibeforge.openProject(rootPath);
      set({ activeProject: project, activeBrandKit: brandKit, jobs: [], isLoading: false });
      await get().refreshRecentProjects();
      return true;
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      return false;
    }
  },

  openProjectByPath: async (rootPath) => {
    set({ isLoading: true, error: null });
    try {
      const { project, brandKit } = await window.vibeforge.openProject(rootPath);
      set({ activeProject: project, activeBrandKit: brandKit, jobs: [], isLoading: false });
      await get().refreshRecentProjects();
      return true;
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      return false;
    }
  },

  updateBrandKit: (partial) => {
    const current = get().activeBrandKit;
    if (!current) return;
    set({
      activeBrandKit: { ...current, ...partial, updatedAt: new Date().toISOString() },
      saveStatus: "pending",
    });
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      get().saveActiveProject();
    }, AUTOSAVE_DELAY_MS);
  },

  saveActiveProject: async () => {
    const { activeProject, activeBrandKit } = get();
    if (!activeProject || !activeBrandKit) return;
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    set({ saveStatus: "saving" });
    try {
      await window.vibeforge.saveProject(activeProject, activeBrandKit);
      set({ saveStatus: "saved" });
    } catch (err) {
      set({ saveStatus: "error", error: (err as Error).message });
    }
  },

  closeProject: () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    set({ activeProject: null, activeBrandKit: null, jobs: [], saveStatus: "idle" });
  },

  createAdJob: async (input) => {
    const { activeProject, activeBrandKit } = get();
    if (!activeProject || !activeBrandKit) return;

    set({ isLoading: true, error: null });
    try {
      const { job, assets } = await window.vibeforge.createAdJob(
        activeProject,
        activeBrandKit,
        input
      );

      // Add the new assets to the project
      const updatedProject: VibeforgeProject = {
        ...activeProject,
        assets: [...activeProject.assets, ...assets],
        updatedAt: new Date().toISOString(),
      };

      // Save the project with the new assets
      await window.vibeforge.saveProject(updatedProject, activeBrandKit);

      set({
        activeProject: updatedProject,
        jobs: [...get().jobs, job],
        isLoading: false,
        saveStatus: "saved",
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      throw err;
    }
  },

  loadJobs: async () => {
    const { activeProject } = get();
    if (!activeProject?.rootPath) return;

    try {
      const jobs = await window.vibeforge.listAdJobs(activeProject.rootPath);
      set({ jobs });
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
  },

  updateJobStatus: async (jobId, status) => {
    const { activeProject } = get();
    if (!activeProject?.rootPath) return;

    try {
      await window.vibeforge.updateAdJobStatus(activeProject.rootPath, jobId, status);
      // Refresh jobs list
      await get().loadJobs();
    } catch (err) {
      console.error("Failed to update job status:", err);
    }
  },

  deleteJob: async (jobId) => {
    const { activeProject, activeBrandKit } = get();
    if (!activeProject?.rootPath || !activeBrandKit) return;

    try {
      await window.vibeforge.deleteAdJob(activeProject.rootPath, jobId);

      // Remove assets belonging to this job from the project
      const updatedProject: VibeforgeProject = {
        ...activeProject,
        assets: activeProject.assets.filter((a) => a.jobId !== jobId),
        updatedAt: new Date().toISOString(),
      };

      await window.vibeforge.saveProject(updatedProject, activeBrandKit);

      set({
        activeProject: updatedProject,
        jobs: get().jobs.filter((j) => j.id !== jobId),
      });
    } catch (err) {
      console.error("Failed to delete job:", err);
    }
  },

  generateFromJob: async (jobId) => {
    const { activeProject, activeBrandKit, jobs } = get();
    if (!activeProject || !activeBrandKit) return;

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    set({ isLoading: true, error: null });
    try {
      const result = await window.vibeforge.generateFromJob(
        job,
        activeProject,
        activeBrandKit
      );

      // Update project with new asset statuses and paths
      const updatedAssets = activeProject.assets.map((asset) => {
        const updated = result.assets.find((a) => a.id === asset.id);
        return updated || asset;
      });

      const updatedProject: VibeforgeProject = {
        ...activeProject,
        assets: updatedAssets,
        updatedAt: new Date().toISOString(),
      };

      await window.vibeforge.saveProject(updatedProject, activeBrandKit);

      set({
        activeProject: updatedProject,
        jobs: get().jobs.map((j) => (j.id === jobId ? result.job : j)),
        isLoading: false,
        saveStatus: "saved",
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
    }
  },
}));
