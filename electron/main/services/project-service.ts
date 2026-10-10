import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { VibeforgeProject, BrandKit, ProjectSummary } from "../../shared/types";
import { CURRENT_PROJECT_VERSION } from "../../shared/types";

const PROJECT_FILE_NAME = "project.vfproject.json";
const PROJECT_SUBFOLDERS = [
  "source/logos",
  "source/photos",
  "source/screenshots",
  "source/fonts",
  "previews",
  "renders",
  "exports",
  "cache",
];

interface ProjectFileContents {
  project: Omit<VibeforgeProject, "rootPath">;
  brandKit: BrandKit;
}

export interface ProjectAndBrandKit {
  project: VibeforgeProject;
  brandKit: BrandKit;
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_");
  return slug.length > 0 ? slug : "Untitled";
}

function recentProjectsFilePath(): string {
  return path.join(app.getPath("userData"), "recent-projects.json");
}

async function readRecentProjects(): Promise<ProjectSummary[]> {
  try {
    const raw = await fs.readFile(recentProjectsFilePath(), "utf-8");
    return JSON.parse(raw) as ProjectSummary[];
  } catch {
    return [];
  }
}

async function writeRecentProjects(list: ProjectSummary[]): Promise<void> {
  await fs.mkdir(path.dirname(recentProjectsFilePath()), { recursive: true });
  await fs.writeFile(recentProjectsFilePath(), JSON.stringify(list, null, 2), "utf-8");
}

async function touchRecentProject(project: VibeforgeProject): Promise<void> {
  if (!project.rootPath) return;
  const existing = await readRecentProjects();
  const withoutThis = existing.filter((p) => p.id !== project.id);
  const summary: ProjectSummary = {
    id: project.id,
    name: project.name,
    businessName: project.businessName,
    rootPath: project.rootPath,
    updatedAt: project.updatedAt,
  };
  const updated = [summary, ...withoutThis].slice(0, 20);
  await writeRecentProjects(updated);
}

export async function listRecentProjects(): Promise<ProjectSummary[]> {
  const list = await readRecentProjects();
  const stillPresent: ProjectSummary[] = [];
  for (const summary of list) {
    try {
      await fs.access(path.join(summary.rootPath, PROJECT_FILE_NAME));
      stillPresent.push(summary);
    } catch {
      // Stale entry — its folder moved or was deleted. Drop it silently.
    }
  }
  if (stillPresent.length !== list.length) {
    await writeRecentProjects(stillPresent);
  }
  return stillPresent;
}

export interface NewProjectInput {
  name: string;
  businessName: string;
  website?: string;
  industry?: string;
  notes?: string;
  parentDirectory: string;
}

async function writeProjectFile(
  rootPath: string,
  project: VibeforgeProject,
  brandKit: BrandKit
): Promise<void> {
  const { rootPath: _omit, ...persistable } = project;
  const contents: ProjectFileContents = { project: persistable, brandKit };
  const filePath = path.join(rootPath, PROJECT_FILE_NAME);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(contents, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function createProject(input: NewProjectInput): Promise<ProjectAndBrandKit> {
  const folderName = `${slugify(input.businessName)}_Vibeforge`;
  const rootPath = path.join(input.parentDirectory, folderName);

  await fs.mkdir(rootPath, { recursive: true });
  for (const sub of PROJECT_SUBFOLDERS) {
    await fs.mkdir(path.join(rootPath, sub), { recursive: true });
  }

  const now = new Date().toISOString();
  const brandKit: BrandKit = {
    id: uuidv4(),
    businessName: input.businessName,
    website: input.website,
    colors: [],
    fonts: [],
    logos: [],
    imagery: [],
    vibeTags: [],
    toneTags: [],
    approvedHeadlines: [],
    approved: false,
    createdAt: now,
    updatedAt: now,
  };

  const project: VibeforgeProject = {
    id: uuidv4(),
    name: input.name,
    businessName: input.businessName,
    website: input.website,
    industry: input.industry,
    notes: input.notes,
    brandKitId: brandKit.id,
    assets: [],
    createdAt: now,
    updatedAt: now,
    projectVersion: CURRENT_PROJECT_VERSION,
    rootPath,
  };

  await writeProjectFile(rootPath, project, brandKit);
  await touchRecentProject(project);
  return { project, brandKit };
}

export async function openProject(rootPath: string): Promise<ProjectAndBrandKit> {
  const filePath = path.join(rootPath, PROJECT_FILE_NAME);
  const raw = await fs.readFile(filePath, "utf-8");
  const contents = JSON.parse(raw) as ProjectFileContents;
  const project: VibeforgeProject = { ...contents.project, rootPath };
  await touchRecentProject(project);
  return { project, brandKit: contents.brandKit };
}

export async function saveProject(project: VibeforgeProject, brandKit: BrandKit): Promise<void> {
  if (!project.rootPath) {
    throw new Error("Cannot save a project that has no rootPath.");
  }
  const updated: VibeforgeProject = { ...project, updatedAt: new Date().toISOString() };
  await writeProjectFile(project.rootPath, updated, brandKit);
  await touchRecentProject(updated);
}
