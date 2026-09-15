import { useProjectStore } from "@/store/project-store";
import type { BrandColor } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";
import styles from "./BrandKitPage.module.css";

const COLOR_ROLES: BrandColor["role"][] = ["primary", "secondary", "accent", "background", "text"];

export function BrandKitPage() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const brandKit = useProjectStore((s) => s.activeBrandKit);
  const updateBrandKit = useProjectStore((s) => s.updateBrandKit);

  if (!activeProject || !brandKit) {
    return (
      <p className={styles.noProject}>
        Open or create a project from the Dashboard to edit its Brand Kit.
      </p>
    );
  }

  function addColor() {
    if (!brandKit) return;
    const next: BrandColor = { id: uuidv4(), hex: "#ff3d8a", role: "accent" };
    updateBrandKit({ colors: [...brandKit.colors, next] });
  }

  function updateColor(id: string, patch: Partial<BrandColor>) {
    if (!brandKit) return;
    updateBrandKit({
      colors: brandKit.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeColor(id: string) {
    if (!brandKit) return;
    updateBrandKit({ colors: brandKit.colors.filter((c) => c.id !== id) });
  }

  function addTag(field: "vibeTags" | "toneTags", value: string) {
    if (!brandKit || !value.trim()) return;
    updateBrandKit({ [field]: [...brandKit[field], value.trim()] });
  }

  function removeTag(field: "vibeTags" | "toneTags", tag: string) {
    if (!brandKit) return;
    updateBrandKit({ [field]: brandKit[field].filter((t) => t !== tag) });
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Brand Kit</h1>
          <p className={styles.subtitle}>
            Every generated asset pulls from this approved identity — nothing bypasses it.
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
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Colors</h2>
          <button className="vf-btn" onClick={addColor}>
            + Add Color
          </button>
        </div>
        {brandKit.colors.length === 0 ? (
          <p className={styles.empty}>No colors yet.</p>
        ) : (
          <div className={styles.colorGrid}>
            {brandKit.colors.map((color) => (
              <div key={color.id} className={styles.colorRow}>
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(color.id, { hex: e.target.value })}
                  className={styles.colorSwatch}
                />
                <input
                  type="text"
                  value={color.hex}
                  onChange={(e) => updateColor(color.id, { hex: e.target.value })}
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

interface TagEditorProps {
  tags: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (tag: string) => void;
}

function TagEditor({ tags, placeholder, onAdd, onRemove }: TagEditorProps) {
  return (
    <div>
      <div className={styles.tagList}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
            <button aria-label={`Remove ${tag}`} onClick={() => onRemove(tag)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        placeholder={placeholder}
        className={styles.tagInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const value = (e.target as HTMLInputElement).value;
            onAdd(value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
        onBlur={(e) => {
          // Commit on blur too — otherwise a typed-but-uncommitted tag
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
