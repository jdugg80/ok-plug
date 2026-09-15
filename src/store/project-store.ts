import { create } from "zustand";
import type {
  VibeforgeProject,
  BrandKit,
  ProjectSummary,
} from "@/types/domain";
import type { NewAdJobInput } from "../../electron/main/services/job-service";

const AUTOSAVE_DELAY_MS = 1200;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

interface ProjectStoreState {
  activeProject: VibeforgeProject | null;
  activeBrandKit: BrandKit | null;
  recentProjects: ProjectSummary[];
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
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  activeProject: null,
  activeBrandKit: null,
  recentProjects: [],
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
      set({ activeProject: project, activeBrandKit: brandKit, isLoading: false });
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
      set({ activeProject: project, activeBrandKit: brandKit, isLoading: false });
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
      set({ activeProject: project, activeBrandKit: brandKit, isLoading: false });
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
    // Debounced autosave: fires ~1.2s after the last edit, so a pause
    // in typing (not an explicit click) is what commits to disk. Every
    // new edit resets the timer rather than stacking up separate saves.
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
    set({ activeProject: null, activeBrandKit: null, saveStatus: "idle" });
  },

  createAdJob: async (input) => {
    const { activeProject, activeBrandKit } = get();
    if (!activeProject || !activeBrandKit) return;

    set({ isLoading: true, error: null });
    try {
      const { assets } = await window.vibeforge.createAdJob(
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
        isLoading: false,
        saveStatus: "saved",
      });
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message });
      throw err;
    }
  },
}));
