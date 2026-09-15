# Vibeforge — Blueprint v2: AI Ad Designer Pipeline Node

*Supersedes the original `Vibeforge_Full_Project_Blueprint.docx` for scope and architecture. The original's design-system tokens, project-folder structure, and general UI conventions still apply except where this document overrides them.*

---

## 1. What Vibeforge Actually Is Now

Vibeforge sits in the middle of a three-app pipeline:

```
Unity Core  ──▶  Vibeforge  ──▶  OKLaunch
(job source)     (AI ad designer)  (distribution)
```

- **Unity Core** (O-Kay-Est Media's internal ops hub) sends **ad job requests** — a client/business, a creative brief, and a list of requested ad formats.
- **Vibeforge** takes that request and, with AI assistance, generates ad creative across every requested format (from the size/spec catalog in `digital-ad-sizes-reference-2026.md`), lets Joe review/refine/approve it, and exports finished assets.
- **OKLaunch** (existing Electron/Vite/React app with an OBS WebSocket integration, a sponsor ad engine, and a credits manager) receives the finished assets and handles actually running them.

This is a meaningful shift from the original blueprint, where a human manually built one ad at a time inside Vibeforge with no upstream/downstream integration. Vibeforge is now a **pipeline node**, not a standalone tool. The manual creative workflow doesn't go away — it becomes the review/refinement layer sitting on top of an AI-driven first draft.

---

## 2. What's Already Built (Foundation, Do Not Redo)

Confirmed working as of the last build — verified via `npm install`, `tsc --noEmit` on both TS projects, and a full `npm run build`:

- Electron + React 19 + TypeScript + Vite shell, with proper main/preload/renderer separation and a narrow typed IPC bridge (`window.vibeforge`)
- Project data model (`VibeforgeProject`, `BrandKit`, `AssetRecord`) in `electron/shared/types.ts`, shared between main and renderer
- Project folder scaffolding on create (`source/`, `previews/`, `renders/`, `exports/`, `cache/`), atomic crash-safe saves
- App shell: sidebar nav, persistent project header, dark theme
- Dashboard: create/open project, recent projects list
- Brand Kit: manual editor (colors + roles, vibe tags, tone tags, approve/draft)
- Ads / Logos / Overlays / Exports: placeholder pages

Everything below **extends** this foundation. Step 1 in the build sequence (§6) is where new work starts.

---

## 3. Brand Token Discrepancy — Needs a Decision

The current Vibeforge UI uses placeholder tokens I picked (`#ff3d8a` pink, `#ff4433` red, `#35d68a` green) since the original blueprint didn't specify exact hex values. The actual O-Kay-Est Media brand palette on file is:

- Red `#FF1F4C`, Pink `#FF2FD1`, Cyan `#00E5FF`, Lime `#C8FF00`
- Heading font: Chakra Petch
- (Unity Core specifically uses cyan `#00d4e8` as its accent)

**Decision needed:** should Vibeforge's own chrome switch to the real O-Kay-Est Media palette, or is Vibeforge's current dark/pink/red/green treatment intentional so it feels distinct from Unity Core? Either is reasonable — flagging it so it's a choice, not a leftover guess. If you confirm, this is a small, mechanical CSS-token change and not on the critical path below.

---

## 4. Integration Contract — Proposed, Needs Confirmation

I don't have Unity Core's or OKLaunch's actual schemas, so this section is a **recommended design**, not a description of something that already exists. Build against this once you confirm it (or correct it).

### 4.1 Unity Core → Vibeforge (job intake)

Recommended: a shared **Supabase table**, since Unity Core already runs its whole data layer there (11 tables, RLS) — this avoids inventing a second transport (REST, file-drop) when one already exists and is trusted.

Proposed table: `ad_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `status` | text | `queued` \| `in_progress` \| `needs_review` \| `approved` \| `delivered` \| `failed` |
| `business_id` | uuid | FK to Unity Core's client/business record |
| `business_name` | text | denormalized for convenience |
| `brand_kit_ref` | jsonb or FK | however Unity Core stores brand identity per client, if it does |
| `requested_format_ids` | text[] | references the Format Catalog (§5) — e.g. `["facebook-feed-4x5", "instagram-stories-9x16"]` |
| `creative_brief` | jsonb | `{ keywords: string[], phrases: string[], reference_file_urls: string[], screenshot_urls: string[], tone_override?: string }` |
| `priority` | text or int | |
| `requested_by` | text | who/what created the job |
| `created_at` | timestamptz | |
| `due_at` | timestamptz | nullable |

Reference files/screenshots live in **Supabase Storage**; `creative_brief` holds URLs, not blobs.

### 4.2 Vibeforge → OKLaunch (delivery)

Since OKLaunch already has a **sponsor ad engine**, the handoff should feed whatever that engine already ingests rather than inventing a parallel path — **this needs to be confirmed against OKLaunch's actual code**, not assumed. Proposed shape either way:

Proposed table: `ad_deliverables` (or reuse whatever table backs OKLaunch's sponsor ad engine if one exists)

| Column | Type | Notes |
|---|---|---|
| `job_id` | uuid | FK to `ad_jobs` |
| `format_id` | text | FK into Format Catalog |
| `file_url` | text | Supabase Storage URL |
| `file_size_bytes` | int | must respect the format's cap from the catalog |
| `duration_sec` | numeric | for video/motion formats |
| `approved_at` | timestamptz | |
| `delivered_at` | timestamptz | nullable until OKLaunch picks it up |

**Before building §6 Step 11 (Delivery Service), stop and confirm:** does OKLaunch's sponsor ad engine already have an ingestion table/format? If yes, target that instead of creating a new one.

---

## 5. Format Catalog

Every row in `digital-ad-sizes-reference-2026.md` becomes one entry in a typed catalog — this is the canonical list Vibeforge uses to know what to generate per job, what safe zones to respect, and what file-size/duration caps to enforce on export.

```typescript
// electron/shared/format-catalog.ts

export type MediaType = "static" | "video" | "static-or-video" | "html5";

export interface AdFormatSpec {
  id: string;                    // e.g. "facebook-feed-mobile-4x5"
  platform:
    | "facebook" | "instagram" | "tiktok" | "x"
    | "youtube" | "website" | "nextdoor" | "marquee";
  placement: string;             // "Feed (mobile-optimized)"
  width: number;
  height: number;
  ratio: string;                 // "4:5"
  mediaType: MediaType;
  maxFileSizeKB?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  safeZoneNotes?: string;
  fileTypeNotes?: string;
  otherNotes?: string;
}

export const FORMAT_CATALOG: AdFormatSpec[] = [
  // populated in Build Step 1 — every row from every table in
  // digital-ad-sizes-reference-2026.md, one entry each, including
  // secondary/premium sizes and carousel card sizes.
];
```

Full table count across the reference doc: Facebook (9), Instagram (5), TikTok (5), X (6), YouTube (8), Website (5 primary + 6 secondary), Nextdoor (8), Marquee (4) — **56 entries minimum**. Don't summarize or drop the secondary/premium website sizes; the catalog needs to be complete since it's the single source of truth downstream steps depend on.

---

## 6. Revised Data Model Additions

Add to `electron/shared/types.ts` (don't replace existing types — extend):

```typescript
export interface CreativeBrief {
  keywords: string[];
  phrases: string[];
  referenceAssetPaths: string[];   // local copies, synced from Unity Core
  screenshotPaths: string[];
  toneOverride?: string;
}

export interface AdJob {
  id: string;
  unityCoreJobId?: string;         // the source record's id, for traceability
  businessId: string;
  businessName: string;
  brandKitId: string;
  requestedFormatIds: string[];    // FK into FORMAT_CATALOG
  creativeBrief: CreativeBrief;
  status: "queued" | "in-progress" | "needs-review" | "approved" | "delivered" | "failed";
  createdAt: string;
  dueAt?: string;
}

// Extend the existing AssetRecord:
export interface AssetRecord {
  // ...existing fields...
  jobId?: string;                  // present when generated from an AdJob
  formatSpecId?: string;           // FK into FORMAT_CATALOG
  aiGenerationLog?: {
    prompt: string;
    model: string;
    generatedAt: string;
  }[];
}

export interface ExportManifest {
  jobId: string;
  assets: {
    formatSpecId: string;
    filePath: string;
    fileSizeBytes: number;
    approvedAt: string;
  }[];
  deliveredAt?: string;
}
```

---

## 7. Module Architecture

1. **Job Intake Service** — subscribes/polls the `ad_jobs` Supabase table, pulls new jobs, creates a local `VibeforgeProject` + one `AssetRecord` per requested format, downloads reference files/screenshots into the project's `source/` folder.
2. **Brand Kit** *(exists)* — gains the ability to be pre-populated from a Unity Core client record instead of only manual entry.
3. **AI Creative Assistant** *(new, core to this revision)*:
   - Text generation — headline/subhead/CTA copy from keywords + phrases + brand tone, via an LLM API.
   - Visual generation/composition — uses reference files/screenshots as creative input, composes layouts against the Brand Kit and the target format's dimensions/safe zones.
   - Iterative chat-driven refinement — "make the headline punchier," "try a different image crop," re-running generation against the same brief.
4. **Template & Composition Engine** — lays out each format per its catalog spec (respecting safe zones, dimensions, aspect ratio).
5. **Render/Export Engine** — static via Canvas/SVG → PNG/JPG; video/motion via Remotion → MP4; HTML5 marquee via CSS `@keyframes`. Enforces each format's file-size/duration caps from the catalog before marking an asset exportable.
6. **Review Queue UI** — replaces the current Ads placeholder: shows every `AssetRecord` for a job, grouped by platform/format, with approve/edit/regenerate per asset.
7. **Delivery Service** — packages approved exports + an `ExportManifest`, pushes to OKLaunch's intake (§4.2).

---

## 8. Build Sequence for OC

Each step has a definition of done. Work in order — later steps depend on earlier ones existing and passing their DoD. Stop at any step marked **BLOCKING** and get confirmation before writing code for it.

| # | Step | Definition of Done |
|---|---|---|
| 0 | **BLOCKING** — Confirm the integration contract (§4) against Unity Core's and OKLaunch's actual schemas | Joe confirms or corrects the proposed tables/columns before Step 11 begins. Does not block Steps 1–10. |
| 1 | Build the Format Catalog | `electron/shared/format-catalog.ts` contains all 56+ entries from `digital-ad-sizes-reference-2026.md`, typed per the `AdFormatSpec` interface. Import it and log `FORMAT_CATALOG.length` to confirm the count matches the source doc. |
| 2 | Extend the data model | `AdJob`, `CreativeBrief`, `ExportManifest` types added; `AssetRecord` extended. Both `tsc --noEmit` projects pass. |
| 3 | Settings: AI provider key management | Settings page gains an API key field (start with Anthropic). Store via Electron's `safeStorage` API (OS-level encryption), never in the project JSON or plain text. `window.vibeforge.getAiKeyStatus()` returns whether a key is set, never the key itself, to the renderer. |
| 4 | Local "Manual Job" intake (stand-in for Unity Core, and a permanent manual-override path) | A "New Ad Job" form: business/brand kit picker, keyword/phrase fields, file/screenshot upload, multi-select of target formats from the catalog. Submitting creates an `AdJob` + one `AssetRecord` per format, status `queued`. This unblocks Steps 5–10 without waiting on Step 0. |
| 5 | AI text generation | Given a `CreativeBrief` + `BrandKit`, call the LLM API and produce N headline/CTA/subhead options per asset. Log each call into `aiGenerationLog`. DoD: a real API call round-trips and populates real copy options in the UI, not placeholder text. |
| 6 | Template/composition engine — static formats only | For a static `AdFormatSpec`, lay out headline/CTA/logo/imagery within the correct dimensions and safe zone. Start with one platform (Facebook Feed 4:5) end-to-end before generalizing to all static formats. |
| 7 | Static render/export pipeline | Canvas/SVG → PNG/JPG export respecting each format's `maxFileSizeKB`. DoD: exporting a Facebook Feed asset produces a real file under 30MB at 1080×1350. |
| 8 | Review Queue UI | Replaces the Ads placeholder page. Assets grouped by job → platform → format. Approve/edit/regenerate actions per asset, wired to real state (not mocked). |
| 9 | Reference-file/screenshot ingestion into AI generation | Uploaded images from the brief are sent as visual context to the AI call (multi-modal), not just stored inert. DoD: changing the uploaded reference image measurably changes the generated output. |
| 10 | Video/motion formats via Remotion | Only after Steps 6–9 are solid for static. Same composition/export pattern, targeting the catalog's video specs (duration limits included). |
| 11 | Delivery Service → OKLaunch | Depends on Step 0 being resolved. Packages approved `AssetRecord`s into an `ExportManifest`, writes to whatever OKLaunch's confirmed intake point is. |
| 12 | Marquee/HTML5 ticker builder | CSS `@keyframes` scroll per the marquee spec notes (50–80px/sec, loop, fallback to static image). |

---

## 9. Open Questions Before Certain Steps Can Finish

- **Step 0 / Step 11:** Unity Core's actual `ad_jobs`-equivalent schema (if one exists) and OKLaunch's sponsor-ad-engine intake format.
- **Step 3:** Which AI provider(s) — Anthropic only, or also an image-generation provider (OpenAI/Ideogram/Stability) for Step 9's visual generation? Text and vision can both run through Claude; true image *generation* (not just image *understanding*) needs a separate provider.
- **Step 10:** Is video/motion needed for v1, or is static-only an acceptable first release given OKLaunch already has its own video/OBS handling?
- **§3:** Brand token decision (real O-Kay-Est Media palette vs. Vibeforge's current distinct palette).
