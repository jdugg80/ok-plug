import { create } from "zustand";
import type { VibeforgeProject, BrandKit, ProjectSummary } from "@/types/domain";

interface ProjectStoreState {
  activeProject: VibeforgeProject | null;
  activeBrandKit: BrandKit | null;
  recentProjects: ProjectSummary[];
  isLoading: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
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
      saveStatus: "idle",
    });
  },

  saveActiveProject: async () => {
    const { activeProject, activeBrandKit } = get();
    if (!activeProject || !activeBrandKit) return;
    set({ saveStatus: "saving" });
    try {
      await window.vibeforge.saveProject(activeProject, activeBrandKit);
      set({ saveStatus: "saved" });
    } catch (err) {
      set({ saveStatus: "error", error: (err as Error).message });
    }
  },

  closeProject: () => set({ activeProject: null, activeBrandKit: null, saveStatus: "idle" }),
}));
