/**
 * Unity Core Import Service
 * PURE functions only — no Electron, no fs. Validates and maps a Unity Core
 * campaign manifest (schemaVersion 1.0 or 1.1) into Vibeforge project/brand/job
 * inputs. Never copies client contact email/phone into notes, prompts, or output.
 */

import { v4 as uuidv4 } from "uuid";
import { FORMAT_CATALOG } from "../../shared/format-catalog";
import type {
  BrandColor,
  BrandKit,
  CreativeBrief,
  CustomAdFormatSpec,
  VibeforgeProject,
} from "../../shared/types";

// ── Manifest shape (as verified from Joe's real 1.1 manifest) ───

export interface ManifestColor {
  hex: string;
  role: string;
  label?: string;
}

export interface ManifestFormat {
  lineItemIndex: number;
  lineItemType: string | null;
  platform: string | null;
  formatName: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  mediaType: string | null;
  renderable: boolean;
  vibeforgeFormatId: string | null;
}

export interface ManifestFile {
  type: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localPath: string | null;
}

export interface ManifestUnity {
  adIntakeId: string;
  campaignId: string;
  campaignName: string | null;
  flight?: { start: string | null; end: string | null } | null;
  blackout?: unknown;
  budget?: { amount?: number | null; clientStatedRange?: string | null } | null;
  // contact / secondaryContact intentionally omitted from the typed shape —
  // never read, never copied.
  lineItems?: unknown[];
}

export interface ManifestClient {
  businessName: string;
  website?: string | null;
  // contactEmail intentionally omitted — never read, never copied.
}

export interface ManifestBrand {
  colors: ManifestColor[];
  vibe?: string[];
  tone?: string[];
  adDirection?: string | null;
  toneOverride?: string | null;
}

export interface ManifestCreativeBrief {
  callToAction?: string | null;
  requiredDisclaimers?: string | null;
  keywords?: string[];
  phrases?: string[];
}

export interface UnityManifest {
  schemaVersion: string;
  client: ManifestClient;
  brand: ManifestBrand;
  adDirection?: string | null;
  toneOverride?: string | null;
  creativeBrief: ManifestCreativeBrief;
  formats: ManifestFormat[];
  files: ManifestFile[];
  unity: ManifestUnity;
}

export interface ValidateResult {
  ok: boolean;
  manifest?: UnityManifest;
  errors: string[];
  warnings: string[];
}

export interface SkippedFormat {
  platform: string | null;
  formatName: string | null;
  mediaType: string | null;
  reason: string;
}

export interface MapResult {
  projectInput: {
    name: string;
    businessName: string;
    website?: string;
    notes?: string;
    unity: NonNullable<VibeforgeProject["unity"]>;
  };
  brandKitPatch: Partial<
    Pick<BrandKit, "businessName" | "website" | "colors" | "vibeTags" | "toneTags">
  >;
  jobInput: {
    businessName: string;
    brandKitId: string;
    requestedFormatIds: string[];
    creativeBrief: CreativeBrief;
    unityCoreJobId: string;
  };
  customFormatSpecs: CustomAdFormatSpec[];
  skipped: SkippedFormat[];
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function slugifyId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// ── validateManifest ───────────────────────────────────────────

export function validateManifest(raw: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["manifest is not an object"], warnings };
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== "1.0" && schemaVersion !== "1.1") {
    errors.push(
      `unknown schemaVersion: ${JSON.stringify(schemaVersion)} (expected "1.0" or "1.1")`
    );
    return { ok: false, errors, warnings };
  }

  if (schemaVersion === "1.0") {
    warnings.push("no sizes in this manifest; regenerate in Unity Core");
  }

  // client.businessName
  const client = raw.client;
  if (!isRecord(client) || typeof client.businessName !== "string" || !client.businessName.trim()) {
    errors.push("client.businessName is required");
  }

  // brand
  const brand = raw.brand;
  if (!isRecord(brand)) {
    errors.push("brand is required");
  }

  // formats array
  const formats = raw.formats;
  if (!Array.isArray(formats)) {
    errors.push("formats must be an array");
  }

  // unity.adIntakeId + unity.campaignId
  const unity = raw.unity;
  if (!isRecord(unity)) {
    errors.push("unity is required");
  } else {
    if (typeof unity.adIntakeId !== "string" || !unity.adIntakeId.trim()) {
      errors.push("unity.adIntakeId is required");
    }
    if (typeof unity.campaignId !== "string" || !unity.campaignId.trim()) {
      errors.push("unity.campaignId is required");
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // Normalize / sanitize colors: drop invalid hex with a warning
  const rawColors = isRecord(brand) && Array.isArray(brand.colors) ? brand.colors : [];
  const colors: ManifestColor[] = [];
  for (const c of rawColors) {
    if (!isRecord(c)) continue;
    const hex = typeof c.hex === "string" ? c.hex : null;
    const role = typeof c.role === "string" ? c.role : null;
    if (!hex || !role) {
      warnings.push("dropped color entry missing hex or role");
      continue;
    }
    if (!HEX_RE.test(hex)) {
      warnings.push(`dropped invalid hex color: ${hex}`);
      continue;
    }
    colors.push({
      hex,
      role,
      ...(typeof c.label === "string" ? { label: c.label } : {}),
    });
  }

  // Normalize formats
  const normFormats: ManifestFormat[] = [];
  if (Array.isArray(formats)) {
    for (const f of formats) {
      if (!isRecord(f)) continue;
      normFormats.push({
        lineItemIndex: asNumberOrNull(f.lineItemIndex) ?? 0,
        lineItemType: asStringOrNull(f.lineItemType),
        platform: asStringOrNull(f.platform),
        formatName: asStringOrNull(f.formatName),
        width: asNumberOrNull(f.width),
        height: asNumberOrNull(f.height),
        aspectRatio: asStringOrNull(f.aspectRatio),
        mediaType: asStringOrNull(f.mediaType),
        renderable: f.renderable === true,
        vibeforgeFormatId: asStringOrNull(f.vibeforgeFormatId),
      });
    }
  }

  // Normalize files (localPath never read)
  const normFiles: ManifestFile[] = [];
  if (Array.isArray(raw.files)) {
    for (const f of raw.files) {
      if (!isRecord(f)) continue;
      normFiles.push({
        type: typeof f.type === "string" ? f.type : "unknown",
        filename: typeof f.filename === "string" ? f.filename : "unknown",
        mimeType: typeof f.mimeType === "string" ? f.mimeType : "application/octet-stream",
        sizeBytes: asNumberOrNull(f.sizeBytes) ?? 0,
        localPath: null,
      });
    }
  }

  const brandRec = brand as Record<string, unknown>;
  const unityRec = unity as Record<string, unknown>;
  const clientRec = client as Record<string, unknown>;
  const cb = isRecord(raw.creativeBrief) ? raw.creativeBrief : {};

  const manifest: UnityManifest = {
    schemaVersion: schemaVersion as string,
    client: {
      businessName: clientRec.businessName as string,
      website: asStringOrNull(clientRec.website) ?? undefined,
    },
    brand: {
      colors,
      vibe: asStringArray(brandRec.vibe),
      tone: asStringArray(brandRec.tone),
      adDirection: asStringOrNull(brandRec.adDirection),
      toneOverride: asStringOrNull(brandRec.toneOverride),
    },
    adDirection: asStringOrNull(raw.adDirection),
    toneOverride: asStringOrNull(raw.toneOverride),
    creativeBrief: {
      callToAction: asStringOrNull(cb.callToAction),
      requiredDisclaimers: asStringOrNull(cb.requiredDisclaimers),
      keywords: asStringArray(cb.keywords),
      phrases: asStringArray(cb.phrases),
    },
    formats: normFormats,
    files: normFiles,
    unity: {
      adIntakeId: unityRec.adIntakeId as string,
      campaignId: unityRec.campaignId as string,
      campaignName: asStringOrNull(unityRec.campaignName),
      flight: isRecord(unityRec.flight)
        ? {
            start: asStringOrNull((unityRec.flight as Record<string, unknown>).start),
            end: asStringOrNull((unityRec.flight as Record<string, unknown>).end),
          }
        : null,
      blackout: unityRec.blackout ?? null,
      budget: isRecord(unityRec.budget)
        ? {
            amount: asNumberOrNull((unityRec.budget as Record<string, unknown>).amount),
            clientStatedRange: asStringOrNull(
              (unityRec.budget as Record<string, unknown>).clientStatedRange
            ),
          }
        : null,
      lineItems: Array.isArray(unityRec.lineItems) ? unityRec.lineItems : [],
    },
  };

  return { ok: true, manifest, errors, warnings };
}

// ── mapManifest ────────────────────────────────────────────────

export function mapManifest(
  manifest: UnityManifest,
  campaignFolder: string
): MapResult {
  const warnings: string[] = [];
  const skipped: SkippedFormat[] = [];

  // Colors -> BrandColor, dedupe by hex, coerce unknown role to "other",
  // keep label.
  const VALID_ROLES = new Set<BrandColor["role"]>([
    "primary",
    "secondary",
    "accent",
    "background",
    "text",
    "other",
  ]);
  const seenHex = new Set<string>();
  const colors: BrandColor[] = [];
  for (const c of manifest.brand.colors) {
    const key = c.hex.toLowerCase();
    if (seenHex.has(key)) continue;
    seenHex.add(key);
    let role: BrandColor["role"];
    if (VALID_ROLES.has(c.role as BrandColor["role"])) {
      role = c.role as BrandColor["role"];
    } else {
      role = "other";
      warnings.push(
        `color ${c.hex}: unknown role "${c.role}" coerced to "other"`
      );
    }
    colors.push({
      id: uuidv4(),
      hex: c.hex,
      role,
      ...(c.label ? { label: c.label } : {}),
    });
  }
  if (colors.length === 0) {
    warnings.push("no brand colors; add them in Brand Kit");
  }

  // Creative brief (never contact data)
  const callToAction = manifest.creativeBrief.callToAction ?? undefined;
  const requiredDisclaimers = manifest.creativeBrief.requiredDisclaimers ?? undefined;
  // adDirection can live at brand level or top-level; prefer brand, fall back
  const adDirection =
    manifest.brand.adDirection ?? manifest.adDirection ?? undefined;
  const toneOverride =
    manifest.brand.toneOverride ?? manifest.toneOverride ?? undefined;

  const creativeBrief: CreativeBrief = {
    keywords: manifest.creativeBrief.keywords ?? [],
    phrases: manifest.creativeBrief.phrases ?? [],
    referenceAssetPaths: [],
    screenshotPaths: [],
    ...(toneOverride ? { toneOverride } : {}),
    ...(callToAction ? { callToAction } : {}),
    ...(requiredDisclaimers ? { requiredDisclaimers } : {}),
    ...(adDirection ? { adDirection } : {}),
  };

  // Formats
  const requestedFormatIds: string[] = [];
  const customFormatSpecs: CustomAdFormatSpec[] = [];

  for (const f of manifest.formats) {
    if (f.renderable !== true) {
      let reason: string;
      if (f.mediaType === "video") {
        reason = "video not supported in v1";
      } else if (!f.platform || !f.formatName) {
        reason = "no format on this line item";
      } else if (f.width == null || f.height == null) {
        reason = "no size on this line item";
      } else {
        reason = "not renderable";
      }
      skipped.push({
        platform: f.platform,
        formatName: f.formatName,
        mediaType: f.mediaType,
        reason,
      });
      continue;
    }

    // renderable === true
    if (f.width == null || f.height == null) {
      skipped.push({
        platform: f.platform,
        formatName: f.formatName,
        mediaType: f.mediaType,
        reason: "no size on this line item",
      });
      continue;
    }
    if (f.vibeforgeFormatId) {
      const catalog = FORMAT_CATALOG.find((s) => s.id === f.vibeforgeFormatId);
      if (catalog) {
        requestedFormatIds.push(catalog.id);
      } else {
        warnings.push(
          `vibeforgeFormatId "${f.vibeforgeFormatId}" not found in FORMAT_CATALOG`
        );
        // Still synthesize a custom spec so the format is importable
        pushCustomSpec(f, requestedFormatIds, customFormatSpecs);
      }
    } else {
      pushCustomSpec(f, requestedFormatIds, customFormatSpecs);
    }
  }

  // Files summary (never read localPath)
  const fileCount = manifest.files.length;
  if (fileCount > 0) {
    warnings.push(
      `${fileCount} files referenced; logos/photos are not copied - add them to the Brand Kit by hand`
    );
  }

  // Project notes: campaignName, flight, budget range. NEVER contact data.
  const noteParts: string[] = [];
  if (manifest.unity.campaignName) {
    noteParts.push(`Campaign: ${manifest.unity.campaignName}`);
  }
  if (manifest.unity.flight?.start || manifest.unity.flight?.end) {
    noteParts.push(
      `Flight: ${manifest.unity.flight?.start ?? "?"} to ${manifest.unity.flight?.end ?? "?"}`
    );
  }
  if (manifest.unity.budget?.clientStatedRange) {
    noteParts.push(`Budget: ${manifest.unity.budget.clientStatedRange}`);
  }
  const notes = noteParts.length > 0 ? noteParts.join("\n") : undefined;

  const projectInput: MapResult["projectInput"] = {
    name: manifest.unity.campaignName || manifest.client.businessName,
    businessName: manifest.client.businessName,
    ...(manifest.client.website ? { website: manifest.client.website } : {}),
    ...(notes ? { notes } : {}),
    unity: {
      adIntakeId: manifest.unity.adIntakeId,
      campaignId: manifest.unity.campaignId,
      ...(manifest.unity.campaignName ? { campaignName: manifest.unity.campaignName } : {}),
      campaignFolder,
      manifestSchemaVersion: manifest.schemaVersion,
      importedAt: new Date().toISOString(),
    },
  };

  const brandKitPatch: MapResult["brandKitPatch"] = {
    businessName: manifest.client.businessName,
    ...(manifest.client.website ? { website: manifest.client.website } : {}),
    colors,
    vibeTags: manifest.brand.vibe ?? [],
    toneTags: manifest.brand.tone ?? [],
  };

  const jobInput: MapResult["jobInput"] = {
    businessName: manifest.client.businessName,
    brandKitId: "", // filled by the handler with the real brandKit.id
    requestedFormatIds,
    creativeBrief,
    unityCoreJobId: manifest.unity.campaignId,
  };

  return {
    projectInput,
    brandKitPatch,
    jobInput,
    customFormatSpecs,
    skipped,
    warnings,
  };
}

/**
 * Synthesize a custom format spec for a renderable entry with no catalog id.
 * Id convention: custom-<platform>-<formatName> slugified, NO size in the id
 * (the exporter appends -<W>x<H> to filenames).
 */
function pushCustomSpec(
  f: ManifestFormat,
  requestedFormatIds: string[],
  customFormatSpecs: CustomAdFormatSpec[]
): void {
  const platformSlug = slugifyId(f.platform ?? "unknown");
  const nameSlug = slugifyId(f.formatName ?? "format");
  const id = `custom-${platformSlug}-${nameSlug}`;

  const spec: CustomAdFormatSpec = {
    id,
    platform: "custom",
    // "<Platform> <FormatName>" with original manifest casing so the AI
    // prompt (${platform} ${placement}) and AdCanvas still name the real
    // platform, e.g. "Facebook Feed Post".
    placement: [f.platform, f.formatName].filter(Boolean).join(" ") || nameSlug,
    width: f.width ?? 0,
    height: f.height ?? 0,
    ratio: f.aspectRatio ?? `${f.width ?? 0}x${f.height ?? 0}`,
    mediaType: "static",
  };
  customFormatSpecs.push(spec);
  requestedFormatIds.push(id);
}
