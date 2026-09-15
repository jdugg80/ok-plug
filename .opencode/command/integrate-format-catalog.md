---
description: Integrate the Format Catalog (Step 1) and extended data model (Step 2) from Vibeforge Blueprint v2 into the repo
agent: build
---

You're continuing work on Vibeforge at `C:\Projects\01-OkayestMedia\ok-plug`,
following `vibeforge-blueprint-v2.md` (should be in the repo root or `docs/`
— read it first if you haven't already, especially §6 "Build Sequence").

This command does **Step 1** (Format Catalog) and **Step 2** (extended data
model) together, since Step 2's types reference Step 1's catalog.

1. **Read the blueprint** (`vibeforge-blueprint-v2.md`) sections §5 and §6,
   plus the existing `electron/shared/types.ts`, so you understand what's
   already there before changing anything.

2. **Add the Format Catalog.** Copy the provided `format-catalog.ts` file
   into `electron/shared/format-catalog.ts`. It's already complete — 57
   entries transcribed from `digital-ad-sizes-reference-2026.md`, already
   type-checked in isolation. Don't regenerate or summarize it; just place
   it as given.

3. **Extend `electron/shared/types.ts`.** Add these new types — do not
   remove or rewrite any existing type in that file, only add to it:

   - `CreativeBrief` (keywords, phrases, referenceAssetPaths, screenshotPaths, toneOverride?)
   - `AdJob` (id, unityCoreJobId?, businessId, businessName, brandKitId, requestedFormatIds, creativeBrief, status, createdAt, dueAt?)
   - `ExportManifest` (jobId, assets[], deliveredAt?)

   And extend the existing `AssetRecord` interface (don't replace it) to
   add: `jobId?`, `formatSpecId?`, `aiGenerationLog?`.

   Exact shapes are in blueprint §6 — use those verbatim rather than
   inventing field names, since later steps (and Unity Core integration)
   will depend on these exact names.

4. **Type-check both projects:**
   - `npx tsc -p tsconfig.json --noEmit`
   - `npx tsc -p electron/tsconfig.json --noEmit`

   Both must pass clean. If something doesn't compile, show me the full
   error rather than silently changing a type to make it pass — I want to
   know if the blueprint's shapes conflict with something already built.

5. **Run the full build.** `npm run build`. Confirm it still produces
   `dist/` and `dist-electron/` output.

6. **Commit** with:

   ```
   Add Format Catalog and extended data model (Blueprint v2 Steps 1-2)

   - electron/shared/format-catalog.ts: 57 AdFormatSpec entries across
     Facebook, Instagram, TikTok, X, YouTube, Website, Nextdoor, and Marquee
   - electron/shared/types.ts: add CreativeBrief, AdJob, ExportManifest;
     extend AssetRecord with jobId, formatSpecId, aiGenerationLog
   ```

7. **Do not push.** Show me `git show --stat HEAD` when done, and confirm
   Steps 1–2 are complete so I know to move to Step 3 (Settings: AI
   provider key management) next.
