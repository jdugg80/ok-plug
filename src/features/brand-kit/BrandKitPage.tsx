import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import type { BrandColor, BrandKit, FontChoice, SourceAsset } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";
import styles from "./BrandKitPage.module.css";

const COLOR_ROLES: BrandColor["role"][] = ["primary", "secondary", "accent", "background", "text"];

// "+ Add Color" picks the first of these that the kit does not already use,
// falling back to "accent". The dropdown above still lists COLOR_ROLES.
const ADD_COLOR_ROLE_ORDER: BrandColor["role"][] = ["primary", "secondary", "background", "text"];

// Warned about in a non-blocking banner; never enforced, never rewritten.
const CRITICAL_COLOR_ROLES: BrandColor["role"][] = ["primary", "background", "text"];

const FONT_ROLES: FontChoice["role"][] = ["display", "heading", "body", "caption"];
const FONT_SOURCES: NonNullable<FontChoice["source"]>[] = ["system", "google", "uploaded"];
const MAX_FONTS = 4;

const LOGO_VARIANTS: { value: NonNullable<SourceAsset["variant"]>; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "onLight", label: "On light" },
  { value: "onDark", label: "On dark" },
];

const TAGLINE_MAX_LENGTH = 120;
const FINE_PRINT_MAX_LENGTH = 300;

type TagField = "vibeTags" | "toneTags";
type ListField = "taglines" | "approvedHeadlines" | "finePrint";

/** "#abc" -> "#aabbcc", "#AABBCC" -> "#aabbcc"; anything else -> null. */
function normalizeHexInput(raw: string): string | null {
  const value = raw.trim();
  const six = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = /^#?([0-9a-fA-F]{3})$/.exec(value);
  if (three) {
    const [a, b, c] = three[1].toLowerCase().split("");
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}

function nextAvailableColorRole(colors: BrandColor[]): BrandColor["role"] {
  const used = new Set(colors.map((c) => c.role));
  return ADD_COLOR_ROLE_ORDER.find((role) => !used.has(role)) ?? "accent";
}

/**
 * Trim, default to https:// when the user typed no scheme, and accept only
 * http(s). Returns the value to store, or an error message to show inline.
 */
function normalizeWebsite(raw: string): { value?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { error: "Enter a valid web address." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Only http:// and https:// addresses are allowed." };
  }
  return { value: withScheme };
}

export function BrandKitPage() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const brandKit = useProjectStore((s) => s.activeBrandKit);
  const updateBrandKit = useProjectStore((s) => s.updateBrandKit);

  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});
  const [hexErrors, setHexErrors] = useState<Record<string, string>>({});
  const [logoError, setLogoError] = useState<string | null>(null);

  if (!activeProject || !brandKit) {
    return (
      <p className={styles.noProject}>
        Open or create a project from the Dashboard to edit its Brand Kit.
      </p>
    );
  }

  const colors = brandKit.colors ?? [];
  const fonts = brandKit.fonts ?? [];
  const logos = brandKit.logos ?? [];
  const taglines = brandKit.taglines ?? [];
  const approvedHeadlines = brandKit.approvedHeadlines ?? [];
  const finePrint = brandKit.finePrint ?? [];
  const adContact = brandKit.adContact ?? {};

  const usedColorRoles = new Set(colors.map((c) => c.role));
  const missingColorRoles = CRITICAL_COLOR_ROLES.filter((role) => !usedColorRoles.has(role));

  function addColor() {
    if (!brandKit) return;
    const current = brandKit.colors ?? [];
    const next: BrandColor = {
      id: uuidv4(),
      hex: "#ff3d8a",
      role: nextAvailableColorRole(current),
    };
    updateBrandKit({ colors: [...current, next] });
  }

  function updateColor(id: string, patch: Partial<BrandColor>) {
    if (!brandKit) return;
    updateBrandKit({
      colors: (brandKit.colors ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeColor(id: string) {
    if (!brandKit) return;
    updateBrandKit({ colors: (brandKit.colors ?? []).filter((c) => c.id !== id) });
  }

  function commitHex(id: string, raw: string) {
    const normalized = normalizeHexInput(raw);
    if (!normalized) {
      setHexErrors((prev) => ({ ...prev, [id]: "Use #RRGGBB, or #ABC for a shorthand." }));
      return;
    }
    setHexErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHexDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    updateColor(id, { hex: normalized });
  }

  function addTag(field: TagField, value: string) {
    if (!brandKit || !value.trim()) return;
    updateBrandKit({ [field]: [...brandKit[field], value.trim()] });
  }

  function removeTag(field: TagField, tag: string) {
    if (!brandKit) return;
    updateBrandKit({ [field]: brandKit[field].filter((t) => t !== tag) });
  }

  function addListEntry(field: ListField, value: string) {
    if (!brandKit) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    const existing = brandKit[field] ?? [];
    if (existing.some((entry) => entry.trim().toLowerCase() === trimmed.toLowerCase())) return;
    updateBrandKit({ [field]: [...existing, trimmed] } as Partial<BrandKit>);
  }

  function removeListEntry(field: ListField, value: string) {
    if (!brandKit) return;
    const existing = brandKit[field] ?? [];
    updateBrandKit({
      [field]: existing.filter((entry) => entry !== value),
    } as Partial<BrandKit>);
  }

  function updateAdContact(patch: Partial<NonNullable<BrandKit["adContact"]>>) {
    if (!brandKit) return;
    updateBrandKit({ adContact: { ...(brandKit.adContact ?? {}), ...patch } });
  }

  function commitAdContactField(
    field: "phone" | "email" | "address",
    raw: string
  ) {
    const trimmed = raw.trim();
    const current = (brandKit?.adContact ?? {})[field];
    if (trimmed === (current ?? "")) return;
    updateAdContact({ [field]: trimmed || undefined } as Partial<NonNullable<BrandKit["adContact"]>>);
  }

  function addFont() {
    if (!brandKit) return;
    const current = brandKit.fonts ?? [];
    if (current.length >= MAX_FONTS) return;
    updateBrandKit({
      fonts: [...current, { id: uuidv4(), family: "", role: "display", source: "system" }],
    });
  }

  function updateFont(id: string, patch: Partial<FontChoice>) {
    if (!brandKit) return;
    updateBrandKit({
      fonts: (brandKit.fonts ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  }

  function removeFont(id: string) {
    if (!brandKit) return;
    updateBrandKit({ fonts: (brandKit.fonts ?? []).filter((f) => f.id !== id) });
  }

  function updateLogo(id: string, patch: Partial<SourceAsset>) {
    if (!brandKit) return;
    updateBrandKit({
      logos: (brandKit.logos ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function removeLogo(id: string) {
    if (!brandKit) return;
    updateBrandKit({ logos: (brandKit.logos ?? []).filter((l) => l.id !== id) });
  }

  function makePrimaryLogo(id: string) {
    if (!brandKit) return;
    updateBrandKit({
      logos: (brandKit.logos ?? []).map((l) => ({ ...l, isPrimary: l.id === id })),
    });
  }

  async function addLogo() {
    if (!activeProject?.rootPath) return;
    setLogoError(null);
    try {
      const existing = brandKit?.logos ?? [];
      const imported = await window.vibeforge.importAsset(activeProject.rootPath, "logo");
      if (!imported) return; // user cancelled the picker
      const next: SourceAsset = {
        ...imported,
        variant: imported.variant ?? "any",
        isPrimary: existing.length === 0,
      };
      updateBrandKit({ logos: [...existing, next] });
    } catch (err) {
      setLogoError((err as Error).message);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Brand Kit</h1>
          <p className={styles.subtitle}>
            Every generated asset pulls from this approved identity - nothing bypasses it.
          </p>
        </div>
        <button
          className={brandKit.approved ? "vf-btn" : "vf-btn vf-btn--primary"}
          onClick={() => updateBrandKit({ approved: !brandKit.approved })}
        >
          {brandKit.approved ? "Revert to Draft" : "Approve Brand Kit"}
        </button>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Business</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Business name</span>
            <input
              type="text"
              defaultValue={brandKit.businessName}
              maxLength={120}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (!trimmed) {
                  e.target.value = brandKit.businessName;
                  return;
                }
                if (trimmed !== brandKit.businessName) {
                  updateBrandKit({ businessName: trimmed });
                }
              }}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Website</span>
            <input
              type="text"
              defaultValue={brandKit.website ?? ""}
              placeholder="https://example.com"
              onBlur={(e) => {
                const result = normalizeWebsite(e.target.value);
                if (result.error) {
                  setWebsiteError(result.error);
                  return;
                }
                setWebsiteError(null);
                e.target.value = result.value ?? "";
                if (result.value !== (brandKit.website ?? undefined)) {
                  updateBrandKit({ website: result.value });
                }
              }}
            />
            {websiteError && <span className={styles.fieldError}>{websiteError}</span>}
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contact for ads</h2>
        <p className={styles.helper}>
          Printed on ads exactly as typed. Never copied from the intake.
        </p>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Phone</span>
            <input
              type="text"
              defaultValue={adContact.phone ?? ""}
              placeholder="(555) 010-0199"
              maxLength={40}
              onBlur={(e) => commitAdContactField("phone", e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <input
              type="text"
              defaultValue={adContact.email ?? ""}
              placeholder="hello@example.com"
              maxLength={80}
              onBlur={(e) => commitAdContactField("email", e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Address</span>
            <textarea
              rows={2}
              defaultValue={adContact.address ?? ""}
              placeholder="123 Example St, Houston, TX 77001"
              maxLength={200}
              onBlur={(e) => commitAdContactField("address", e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Taglines</h2>
        <TagEditor
          tags={taglines}
          placeholder="e.g. Built for the long haul"
          maxLength={TAGLINE_MAX_LENGTH}
          onAdd={(v) => addListEntry("taglines", v)}
          onRemove={(t) => removeListEntry("taglines", t)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Approved Headlines</h2>
        <TagEditor
          tags={approvedHeadlines}
          placeholder="e.g. Same-day service, guaranteed"
          maxLength={TAGLINE_MAX_LENGTH}
          onAdd={(v) => addListEntry("approvedHeadlines", v)}
          onRemove={(t) => removeListEntry("approvedHeadlines", t)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Fine Print</h2>
        <p className={styles.helper}>
          Standing disclaimer lines. Added to every ad unless the job overrides.
        </p>
        <TagEditor
          tags={finePrint}
          placeholder="e.g. Offer valid while supplies last. Terms apply."
          maxLength={FINE_PRINT_MAX_LENGTH}
          onAdd={(v) => addListEntry("finePrint", v)}
          onRemove={(t) => removeListEntry("finePrint", t)}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Fonts</h2>
          <button
            className="vf-btn"
            onClick={addFont}
            disabled={fonts.length >= MAX_FONTS}
          >
            + Add Font
          </button>
        </div>
        {fonts.length === 0 ? (
          <p className={styles.empty}>No fonts yet.</p>
        ) : (
          <div className={styles.fontList}>
            {fonts.map((font) => (
              <div key={font.id} className={styles.fontRow}>
                <select
                  value={font.role}
                  aria-label="Font role"
                  onChange={(e) =>
                    updateFont(font.id, { role: e.target.value as FontChoice["role"] })
                  }
                >
                  {FONT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={font.family}
                  placeholder="Family, e.g. Inter"
                  aria-label="Font family"
                  maxLength={60}
                  onChange={(e) => updateFont(font.id, { family: e.target.value })}
                />
                <select
                  value={font.source ?? "system"}
                  aria-label="Font source"
                  onChange={(e) =>
                    updateFont(font.id, { source: e.target.value as FontChoice["source"] })
                  }
                >
                  {FONT_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
                <button className="vf-btn" onClick={() => removeFont(font.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {fonts.length >= MAX_FONTS && (
          <p className={styles.helper}>Maximum of {MAX_FONTS} font rows.</p>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Logos</h2>
          <button className="vf-btn" onClick={addLogo}>
            + Add logo
          </button>
        </div>
        <p className={styles.helper}>
          Remove drops the reference only - the file stays on disk.
        </p>
        {logoError && <p className={styles.fieldError}>{logoError}</p>}
        {logos.length === 0 ? (
          <p className={styles.empty}>No logos yet.</p>
        ) : (
          <div className={styles.logoGrid}>
            {logos.map((logo) => (
              <div key={logo.id} className={styles.logoCard}>
                <div className={styles.logoThumb}>
                  <LogoThumb
                    rootPath={activeProject.rootPath ?? ""}
                    relativePath={logo.relativePath}
                  />
                </div>
                <div className={styles.logoFileName} title={logo.originalFileName}>
                  {logo.originalFileName}
                </div>
                <select
                  value={logo.variant ?? "any"}
                  aria-label={`Variant for ${logo.originalFileName}`}
                  onChange={(e) =>
                    updateLogo(logo.id, {
                      variant: e.target.value as SourceAsset["variant"],
                    })
                  }
                >
                  {LOGO_VARIANTS.map((variant) => (
                    <option key={variant.value} value={variant.value}>
                      {variant.label}
                    </option>
                  ))}
                </select>
                <label className={styles.primaryRow}>
                  <input
                    type="radio"
                    name="primary-logo"
                    checked={logo.isPrimary === true}
                    onChange={() => makePrimaryLogo(logo.id)}
                  />
                  Primary
                </label>
                <button className="vf-btn" onClick={() => removeLogo(logo.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Colors</h2>
          <button className="vf-btn" onClick={addColor}>
            + Add Color
          </button>
        </div>
        {missingColorRoles.length > 0 && (
          <p className={styles.roleWarning}>
            Missing roles: {missingColorRoles.join(", ")}
          </p>
        )}
        {colors.length === 0 ? (
          <p className={styles.empty}>No colors yet.</p>
        ) : (
          <div className={styles.colorGrid}>
            {colors.map((color) => (
              <div key={color.id} className={styles.colorItem}>
                <div className={styles.colorRow}>
                  <input
                    type="color"
                    value={color.hex}
                    onChange={(e) => {
                      setHexDrafts((prev) => {
                        const next = { ...prev };
                        delete next[color.id];
                        return next;
                      });
                      setHexErrors((prev) => {
                        const next = { ...prev };
                        delete next[color.id];
                        return next;
                      });
                      updateColor(color.id, { hex: e.target.value });
                    }}
                    className={styles.colorSwatch}
                  />
                  <input
                    type="text"
                    value={
                      hexDrafts[color.id] !== undefined ? hexDrafts[color.id] : color.hex
                    }
                    onChange={(e) =>
                      setHexDrafts((prev) => ({ ...prev, [color.id]: e.target.value }))
                    }
                    onBlur={(e) => commitHex(color.id, e.target.value)}
                    className={styles.colorHexInput}
                  />
                  <select
                    value={color.role}
                    onChange={(e) =>
                      updateColor(color.id, { role: e.target.value as BrandColor["role"] })
                    }
                  >
                    {COLOR_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button className="vf-btn" onClick={() => removeColor(color.id)}>
                    Remove
                  </button>
                </div>
                {hexErrors[color.id] && (
                  <p className={styles.fieldError}>{hexErrors[color.id]}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Vibe Tags</h2>
        <TagEditor
          tags={brandKit.vibeTags}
          placeholder="e.g. bold, playful, minimal"
          onAdd={(v) => addTag("vibeTags", v)}
          onRemove={(t) => removeTag("vibeTags", t)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tone Tags</h2>
        <TagEditor
          tags={brandKit.toneTags}
          placeholder="e.g. friendly, premium, direct"
          onAdd={(v) => addTag("toneTags", v)}
          onRemove={(t) => removeTag("toneTags", t)}
        />
      </section>
    </div>
  );
}

/**
 * Loads a project-relative image as a data URI so the thumbnail renders
 * without a custom protocol or webSecurity changes.
 */
function LogoThumb({ rootPath, relativePath }: { rootPath: string; relativePath: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    if (!rootPath) {
      setFailed(true);
      return;
    }
    window.vibeforge
      .readImage(rootPath, relativePath)
      .then((uri) => {
        if (!cancelled) setSrc(uri);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, relativePath]);

  if (failed) return <span className={styles.logoThumbNote}>Can't load image</span>;
  if (!src) return <span className={styles.logoThumbNote}>&hellip;</span>;
  return <img className={styles.logoThumbImg} src={src} alt="" />;
}

interface TagEditorProps {
  tags: string[];
  placeholder: string;
  /** Hard cap on characters per entry. */
  maxLength?: number;
  onAdd: (value: string) => void;
  onRemove: (tag: string) => void;
}

function TagEditor({ tags, placeholder, maxLength, onAdd, onRemove }: TagEditorProps) {
  return (
    <div>
      <div className={styles.tagList}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button aria-label={`Remove ${tag}`} onClick={() => onRemove(tag)}>
              x
            </button>
          </span>
        ))}
      </div>
      <input
        placeholder={placeholder}
        className={styles.tagInput}
        maxLength={maxLength}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const value = (e.target as HTMLInputElement).value;
            onAdd(value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
        onBlur={(e) => {
          // Commit on blur too - otherwise a typed-but-uncommitted tag
          // is silently lost the moment focus moves elsewhere (e.g. to
          // the Save button), which is exactly the kind of thing
          // autosave is supposed to prevent.
          const value = e.target.value;
          if (value.trim()) {
            onAdd(value);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
