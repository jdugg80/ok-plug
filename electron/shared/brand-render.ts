/**
 * Brand render helpers - pure, Electron-free, and safe to import from both the
 * main-process renderer (Puppeteer HTML) and the React preview.
 *
 * Nothing here does I/O. Logo file reading / downscaling happens in the callers
 * (export-service in main, the pages via the readImage IPC in the renderer).
 */
import type { AdContact, FontChoice, SourceAsset } from "./types";

/**
 * Everything the renderer needs to draw the brand furniture. The caller
 * resolves `logoDataUri` itself; this type stays agnostic about how.
 */
export interface RenderBrand {
  /** Already-resolved data URI for the chosen logo. Undefined = draw nothing. */
  logoDataUri?: string;
  website?: string;
  adContact?: AdContact;
  /** Combined job + brand fine print, already deduped and job-first. */
  finePrint?: string[];
}

export interface SafeInsets {
  /** Fractions of canvas size, 0-1. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const DEFAULT_INSETS: SafeInsets = { top: 0.04, bottom: 0.04, left: 0.05, right: 0.05 };

/**
 * Numeric safe-zone insets keyed by catalog format id.
 * Values outside the default come from AdFormatSpec.safeZoneNotes prose in
 * format-catalog.ts, converted to fractions.
 */
const SAFE_INSET_TABLE: Record<string, SafeInsets> = {
  "facebook-stories-reels-9x16": { top: 0.14, bottom: 0.2, left: 0.05, right: 0.05 },
  "instagram-stories": { top: 0.14, bottom: 0.35, left: 0.05, right: 0.05 },
  "instagram-reels": { top: 0.14, bottom: 0.35, left: 0.05, right: 0.05 },
  // ASSUMPTION: youtube-shorts-ad had no safeZoneNotes in the catalog. 10% top /
  // 20% bottom mirrors the facebook stories/reels values; flag if wrong.
  "youtube-shorts-ad": { top: 0.1, bottom: 0.2, left: 0.05, right: 0.05 },
  // TikTok's notes are absolute px against a 1080x1920 reference frame.
  "tiktok-infeed-video-standard": {
    top: 160 / 1920,
    bottom: 440 / 1920,
    left: 80 / 1080,
    right: 80 / 1080,
  },
};

export function getSafeInsets(spec: { id?: string; width: number; height: number }): SafeInsets {
  const entry = spec.id ? SAFE_INSET_TABLE[spec.id] : undefined;
  return entry ? { ...entry } : { ...DEFAULT_INSETS };
}

/** Compact strip for tiny canvases: single row, logo left, website right. */
export function isCompactCanvas(width: number, height: number): boolean {
  return height < 120 || width < 200;
}

/**
 * Job-level requiredDisclaimers first, then brand-level fine print, deduped
 * case-insensitively. Empty lines are dropped.
 */
export function combineFinePrint(
  requiredDisclaimers: string | undefined,
  brandFinePrint: readonly string[] | undefined
): string[] {
  const jobLines = (requiredDisclaimers ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const brandLines = (brandFinePrint ?? []).map((line) => line.trim()).filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of [...jobLines, ...brandLines]) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/**
 * Parse a background into an RGB triple, or null when it cannot be judged.
 *
 * Only a *flat* colour counts: a bare #abc / #aabbcc hex, or a bare rgb()/rgba()
 * call. Anything else - CSS gradients, url(...) photos, named colours, or an
 * empty string - returns null, and callers then assume a DARK canvas.
 *
 * (Deliberately NOT "first hex stop of a gradient": a gradient is dominated by
 * its darkest or lightest stop, not its first, so guessing from stop one is as
 * likely to be wrong as right. Assuming dark is the safer default because most
 * ads the model produces are dark, and an onDark logo on a dark canvas is the
 * common case.)
 */
function parseFlatBackground(input?: string): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const value = input.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,[^)]*)?\s*\)$/i.exec(
    value
  );
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    if (r <= 255 && g <= 255 && b <= 255) return { r, g, b };
  }

  return null;
}

/** True when the background is a flat colour we could judge luminance from. */
export function isFlatBackground(input?: string): boolean {
  return parseFlatBackground(input) !== null;
}

/** What the logo picker decided, and why, when it could not find a clean match. */
export interface LogoChoice {
  logo: SourceAsset;
  /**
   * Set only when the chosen logo's variant does NOT suit the background -
   * i.e. it was used as a last resort. Callers must surface this to the user.
   */
  warning?: string;
}

/**
 * Pick the logo to draw.
 *
 * Order, in tiers:
 *   1. variant that matches the background (primary first within that tier)
 *   2. variant "any"                       (primary first within that tier)
 *   3. a MISMATCHED logo, as a last resort - returned with the warning
 *      "no compatible logo variant" so the caller can tell the user.
 * Returns null only when there are no logos at all.
 *
 * The background may be a flat hex or rgb() colour. Anything else - gradients,
 * photo URLs, named colours, missing - is UNPARSEABLE and we assume a DARK
 * canvas, so an onDark logo is preferred.
 */
export function chooseLogo(
  logos: readonly SourceAsset[] | undefined,
  backgroundColor: string | undefined
): LogoChoice | null {
  const list = (logos ?? []).filter(Boolean);
  if (list.length === 0) return null;

  const rgb = parseFlatBackground(backgroundColor);
  // Unparseable (or absent) background -> assume DARK and prefer onDark.
  const wanted: NonNullable<SourceAsset["variant"]> = rgb
    ? (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255 < 0.5
      ? "onDark"
      : "onLight"
    : "onDark";

  const variantOf = (logo: SourceAsset): NonNullable<SourceAsset["variant"]> =>
    logo.variant ?? "any";
  const byPrimaryThenFirst = (a: SourceAsset, b: SourceAsset): number =>
    (b.isPrimary === true ? 1 : 0) - (a.isPrimary === true ? 1 : 0);

  const matching = list
    .filter((l) => variantOf(l) === wanted)
    .sort(byPrimaryThenFirst);
  const anyVariant = list
    .filter((l) => variantOf(l) === "any")
    .sort(byPrimaryThenFirst);
  const mismatched = list
    .filter((l) => variantOf(l) !== wanted && variantOf(l) !== "any")
    .sort(byPrimaryThenFirst);

  const tier1 = matching[0];
  if (tier1) return { logo: tier1 };
  const tier2 = anyVariant[0];
  if (tier2) return { logo: tier2 };
  const tier3 = mismatched[0];
  if (tier3) {
    return {
      logo: tier3,
      warning: `no compatible logo variant (wanted "${wanted}", logo is "${variantOf(tier3)}")`,
    };
  }
  return null;
}

/**
 * One contact line, tagged with the field it came from so the renderer can
 * drop it by name (drop order: email, address, phone, website) instead of by
 * array position.
 */
export interface ContactPart {
  name: "website" | "phone" | "email" | "address";
  text: string;
}

/** Contact parts in the order the footer draws them, empty ones omitted. */
export function assembleContactParts(brand?: RenderBrand): ContactPart[] {
  if (!brand) return [];
  const out: ContactPart[] = [];
  const website = brand.website?.trim();
  if (website) out.push({ name: "website", text: website });
  const contact = brand.adContact ?? {};
  if (contact.phone?.trim()) out.push({ name: "phone", text: contact.phone.trim() });
  if (contact.email?.trim()) out.push({ name: "email", text: contact.email.trim() });
  if (contact.address?.trim()) out.push({ name: "address", text: contact.address.trim() });
  return out;
}

/** Fine print lines, trimmed and non-empty only. */
export function assembleFinePrint(brand?: RenderBrand): string[] {
  return (brand?.finePrint ?? []).map((l) => l.trim()).filter(Boolean);
}

/**
 * Map an element role to a CSS font stack from the brand's font choices.
 * Shared so the PNG renderer and the React preview agree on the body stack
 * (the brand footer must never fall back to the browser default).
 */
export function resolveFontStack(
  role: "headline" | "subhead" | "cta" | "body",
  fonts?: FontChoice[]
): string {
  if (!fonts || fonts.length === 0) return "Arial, Helvetica, sans-serif";

  const roleMap: Record<string, FontChoice["role"][]> = {
    headline: ["display", "heading"],
    subhead: ["heading", "body"],
    cta: ["body", "caption"],
    body: ["body", "caption"],
  };

  for (const preferredRole of roleMap[role] ?? []) {
    const match = fonts.find((f) => f.role === preferredRole);
    if (match) {
      const fallback = match.fallback || "Arial";
      return `'${match.family}', '${fallback}', sans-serif`;
    }
  }

  if (fonts.length > 0) {
    const fallback = fonts[0].fallback || "Arial";
    return `'${fonts[0].family}', '${fallback}', sans-serif`;
  }

  return "Arial, Helvetica, sans-serif";
}
