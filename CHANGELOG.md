# Changelog

All notable changes to Vibeforge will be documented in this file.

Format based on [Keep a Changelog](https://keepachchangeli.com/).

## [Unreleased]

### Added
- Vibeforge Blueprint v2 (`docs/vibeforge-blueprint-v2.md`)
- Ad Format Catalog with 47 entries across 8 platforms (`docs/format-catalog.ts`)
- OpenCode integration command (`.opencode/command/integrate-format-catalog.md`)
- Project timeline with 6-phase roadmap
- Full project timeline (`docs/full-project-timeline.html`)
- Session timeline (`docs/session-timeline.html`)

### Changed
- Renamed project from "ok-plug" to "Vibeforge" in documentation
- Updated README to reflect pipeline architecture and actual scope
- Cleaned up project scaffolding (Vite React plugin, tsconfig, index.html, styles, App.tsx)

### Removed
- Orphaned `src/main.ts` (legacy template file)
- Orphaned `ok-plug/` sub-project directory (duplicate template)

## [0.3.0] - 2026-09-18

### Added
- **ad_intake DB Schema Migration 097:** Mapped ad_intake DB rows to Vibeforge BrandKit + AdJob. Three source types (manual, website_inquiry, website_job_request) mapped to brand context. Request type (simple_asset vs campaign) mapped to format IDs. Status flow (submitted→scanned→quoted→approved/active→completed→archived) mapped to job pipeline stages.
- **BrandColor Type Resolution:** Created makeBrandColor() helper returning proper BrandColor objects (id, hex, role). Added missing fonts property to BrandKit schema.
- **IPC Handler Corrections:** Fixed imports to only reference functions existing in intake-service.ts. Added "intake:migrate" handler for mapping DB rows to BrandKit + AdJob + Project. Removed references to non-existent createAdJob/listAdJobs/getAdJob/migrateAdIntake.
- **Intake Status Helpers:** Implemented mapIntakeStatusToJob, getNextIntakeStatus, getPreviousIntakeStatus for pipeline tracking.

### Fixed
- BrandColor type error in intake-service.ts (line 123) — string array replaced with makeBrandColor() calls.
- IPC handler import mismatches — only import functions that exist in intake-service.ts.
- Missing fonts property in BrandKit mapping return object.

### Decisions
- ad_intake DB rows map to standalone BrandKit + AdJob objects integrating with existing Vibeforge job generation pipeline.
- Status flow preserved as seven-stage pipeline: submitted→scanned→quoted→approved/active→completed→archived.
- Integer arithmetic used for perfect-square checks in tree visualization block division logic.

## [0.2.0] - 2026-09-18

### Added
- **AI Provider Abstraction:** Dual-provider support for Anthropic Claude and OpenAI GPT-4o. Provider toggle in Settings page. Both keys stored simultaneously, active provider selected by user.
- **Secure Key Storage:** OS-level encrypted API key storage via Electron safeStorage (DPAPI on Windows). Keys never exposed to renderer process.
- **Rendering Pipeline:** Puppeteer-based rendering engine that builds HTML from AdDesignResult and renders at 2x retina resolution. Supports Google Fonts, uploaded fonts (base64 @font-face), and system fonts with fallback chains.
- **Watermark Service:** Sharp-based semi-transparent text watermark overlay on rendered assets. Proportional scaling, bottom-right positioning, non-obstructive for client review.
- **Export UI:** Individual "Export PNG" button per generated ad, bulk "Export All" button. Loading states, success/error feedback. Assets saved to `project/renders/` directory.
- **Job Orchestrator:** Full generation pipeline driven by AdJob. Status transitions: queued → in-progress → AI generate per format → persist design JSON → needs-review.
- **Job List Page:** Displays all jobs with status badges, format count, keywords, and delete capability. Replaced placeholder AdsPage.
- **Job Detail Page:** Shows creative brief, per-asset AdCanvas previews loaded from persisted design JSON, generate/export/approve actions.
- **Job Status Management:** IPC channels and handlers for job status updates, job deletion, and asset status transitions. Store updated with job state management.
- **Design Persistence:** AI-generated AdDesignResult persisted as JSON per asset (`renders/{assetId}-design.json`). Enables re-rendering without re-generation, manual editing, and audit trail.

### Fixed
- ESM/CJS conflict with Puppeteer and Sharp (ESM-only packages in Electron's CJS main process). Converted to dynamic `import()` pattern.

### Decisions
- AdDesignResult stored as JSON per asset rather than regenerating on demand. Trade-off: more disk space, but enables editing, re-rendering, and audit trail.
- Watermark uses text overlay ("O-Kay-Est Media") rather than logo image. Simpler, scales to any resolution, no asset management needed.
- Job orchestrator runs synchronously per format (not parallelized). Allows status tracking per asset and error handling without losing partial progress.

## [0.1.0] - 2026-06-10

### Added
- Initial Tauri v2 project scaffold (React 19 + TypeScript + Vite)
- Rust backend with `greet` command
- Basic window configuration (800x600)
- Tauri plugin-opener for file/URL handling
- Capabilities-based security model (Tauri v2)
