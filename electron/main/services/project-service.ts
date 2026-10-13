import { app } from "electron";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { VibeforgeProject, BrandKit, ProjectSummary, AdContact, SourceAsset } from "../../shared/types";
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

/**
 * Trim each entry, drop empties, and dedupe case-insensitively while keeping
 * the first occurrence's original casing. Non-string entries are discarded.
 */
function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function cleanAdContact(value: unknown): AdContact {
  const raw = (typeof value === "object" && value !== null ? value : {}) as AdContact;
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const address = typeof raw.address === "string" ? raw.address.trim() : "";
  const out: AdContact = {};
  if (phone) out.phone = phone;
  if (email) out.email = email;
  if (address) out.address = address;
  return out;
}

/**
 * Bring a BrandKit up to the Brand Kit v2 shape WITHOUT touching disk.
 *
 * Projects saved before v2 arrive with taglines / adContact / finePrint
 * missing entirely; this fills the defaults so no caller ever sees undefined.
 * The normalized values are only written back by the user's next normal save —
 * calling this function never rewrites project.vfproject.json on its own.
 *
 * Every field not named below is passed through untouched.
 */
export function normalizeBrandKit(kit: BrandKit): BrandKit {
  return {
    ...kit,
    taglines: cleanStringList(kit.taglines),
    adContact: cleanAdContact(kit.adContact),
    finePrint: cleanStringList(kit.finePrint),
    approvedHeadlines: cleanStringList(kit.approvedHeadlines),
  };
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
  const brandKit: BrandKit = normalizeBrandKit({
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
  });

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
  // Load path only: normalizes in memory so legacy projects get the v2
  // defaults. Deliberately does NOT write back here — see normalizeBrandKit.
  return { project, brandKit: normalizeBrandKit(contents.brandKit) };
}

export async function saveProject(project: VibeforgeProject, brandKit: BrandKit): Promise<void> {
  if (!project.rootPath) {
    throw new Error("Cannot save a project that has no rootPath.");
  }
  const updated: VibeforgeProject = { ...project, updatedAt: new Date().toISOString() };
  await writeProjectFile(project.rootPath, updated, brandKit);
  await touchRecentProject(updated);
}

// ── Asset import / image read (Brand Kit v2) ─────────────────────

export const IMPORTABLE_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "svg"] as const;
export const ASSET_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const KIND_SUBFOLDER: Record<SourceAsset["kind"], string> = {
  logo: "source/logos",
  photo: "source/photos",
  screenshot: "source/screenshots",
  other: "source/photos",
};

// Lazy-loaded sharp (dynamic import - ESM-only package in CJS context)
let sharpInstance: any = null;
async function getSharp(): Promise<any> {
  if (!sharpInstance) {
    sharpInstance = (await import("sharp")).default;
  }
  return sharpInstance;
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).replace(/^\./, "").toLowerCase();
}

/**
 * Resolve a project-relative asset path to an absolute one, refusing anything
 * that escapes the project folder (absolute paths, ".." traversal, other drives).
 */
export function resolveProjectAssetPath(rootPath: string, relativePath: string): string {
  if (!rootPath) {
    throw new Error("Project has no root path.");
  }
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Asset path must be relative to the project folder.");
  }
  const absRoot = path.resolve(rootPath);
  const abs = path.resolve(absRoot, relativePath);
  const rootWithSep = absRoot.endsWith(path.sep) ? absRoot : absRoot + path.sep;
  if (abs !== absRoot && !abs.startsWith(rootWithSep)) {
    throw new Error("Asset path is outside the project folder.");
  }
  return abs;
}

/**
 * Copy a user-selected file into the project folder and return the SourceAsset
 * describing it. The source file is never modified or deleted.
 */
export async function importAssetIntoProject(
  rootPath: string,
  sourceFilePath: string,
  kind: SourceAsset["kind"] = "logo"
): Promise<SourceAsset> {
  const ext = extensionOf(sourceFilePath);
  if (!(IMPORTABLE_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `Unsupported file type ".${ext}". Allowed: ${IMPORTABLE_IMAGE_EXTENSIONS.join(", ")}.`
    );
  }

  const stat = await fs.stat(sourceFilePath);
  if (!stat.isFile()) {
    throw new Error("That path is not a file.");
  }
  if (stat.size > ASSET_IMPORT_MAX_BYTES) {
    const mb = Math.round(ASSET_IMPORT_MAX_BYTES / (1024 * 1024));
    throw new Error(`File is larger than ${mb} MB.`);
  }

  const id = uuidv4();
  const safeName = path.basename(sourceFilePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = `${KIND_SUBFOLDER[kind]}/${id}-${safeName}`.split(path.sep).join("/");

  const destination = resolveProjectAssetPath(rootPath, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(sourceFilePath, destination);

  // Dimensions are best-effort: a malformed SVG simply gets no width/height.
  let width: number | undefined;
  let height: number | undefined;
  try {
    const sharp = await getSharp();
    const meta = await sharp(destination).metadata();
    if (typeof meta.width === "number") width = meta.width;
    if (typeof meta.height === "number") height = meta.height;
  } catch {
    // leave undefined
  }

  return {
    id,
    relativePath,
    originalFileName: path.basename(sourceFilePath),
    kind,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    addedAt: new Date().toISOString(),
  };
}

/**
 * Read a project-relative image and return it as a data URI. This is the one
 * representation that loads in both the renderer (<img src>) and the Puppeteer
 * export HTML, with no custom protocol or webSecurity changes.
 */
export async function readProjectImageAsDataUri(
  rootPath: string,
  relativePath: string
): Promise<string> {
  const absolute = resolveProjectAssetPath(rootPath, relativePath);
  const mime = IMAGE_MIME[extensionOf(absolute)];
  if (!mime) {
    throw new Error(`Unsupported image type ".${extensionOf(absolute)}".`);
  }
  const buffer = await fs.readFile(absolute);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
