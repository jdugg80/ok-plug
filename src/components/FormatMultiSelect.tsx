import { useState, useRef, useEffect } from "react";
import { FORMAT_CATALOG, type Platform, type AdFormatSpec } from "@/types/domain";
import styles from "./FormatMultiSelect.module.css";

interface FormatMultiSelectProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

const PLATFORMS: Platform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "website",
  "nextdoor",
  "marquee",
];

const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X (Twitter)",
  youtube: "YouTube",
  website: "Website",
  nextdoor: "Nextdoor",
  marquee: "Marquee",
};

export function FormatMultiSelect({ selected, onChange }: FormatMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFormats: AdFormatSpec[] = FORMAT_CATALOG.filter((f: AdFormatSpec) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.id.toLowerCase().includes(q) ||
      f.placement.toLowerCase().includes(q) ||
      f.platform.toLowerCase().includes(q)
    );
  });

  const grouped = PLATFORMS.map((p) => ({
    platform: p,
    formats: filteredFormats.filter((f) => f.platform === p),
  })).filter((g) => g.formats.length > 0);

  function toggleFormat(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function selectAllOnPlatform(platform: Platform) {
    const platformIds: string[] = FORMAT_CATALOG.filter(
      (f: AdFormatSpec) => f.platform === platform
    ).map((f: AdFormatSpec) => f.id);
    const allSelected = platformIds.every((id) => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter((s) => !platformIds.includes(s)));
    } else {
      onChange([...new Set([...selected, ...platformIds])]);
    }
  }

  return (
    <div className={styles.container} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0
          ? "Select formats..."
          : `${selected.length} format${selected.length !== 1 ? "s" : ""} selected`}
        <span className={styles.arrow}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            type="text"
            className={styles.search}
            placeholder="Search formats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className={styles.platformList}>
            {grouped.map(({ platform, formats }) => {
              const allSelected = formats.every((f) => selected.includes(f.id));
              const someSelected = formats.some((f) => selected.includes(f.id));
              const isExpanded = expandedPlatform === platform || search.length > 0;

              return (
                <div key={platform} className={styles.platformGroup}>
                  <button
                    type="button"
                    className={styles.platformHeader}
                    onClick={() => setExpandedPlatform(isExpanded && !search ? null : platform)}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => selectAllOnPlatform(platform)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={styles.platformName}>
                      {PLATFORM_LABELS[platform]}
                    </span>
                    <span className={styles.platformCount}>{formats.length}</span>
                    <span className={styles.arrow}>{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {isExpanded && (
                    <div className={styles.formatList}>
                      {formats.map((format: AdFormatSpec) => (
                        <label key={format.id} className={styles.formatItem}>
                          <input
                            type="checkbox"
                            checked={selected.includes(format.id)}
                            onChange={() => toggleFormat(format.id)}
                          />
                          <div className={styles.formatInfo}>
                            <span className={styles.formatPlacement}>
                              {format.placement}
                            </span>
                            <span className={styles.formatDims}>
                              {format.width}×{format.height} ({format.ratio})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
