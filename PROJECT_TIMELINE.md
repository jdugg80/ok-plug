# Project Timeline

Vibeforge development timeline and milestones.

---

## Phase 1: Project Scaffolding

**Status:** Complete (2026-06-10)

- [x] Tauri v2 project with React 19 + TypeScript + Vite
- [x] Rust backend with basic command structure
- [x] Window configuration (800x600)
- [x] Tauri capabilities and security model
- [x] Project cleanup and documentation setup

---

## Phase 2: Blueprint Integration

**Status:** Complete (2026-09-15)

- [x] Vibeforge Blueprint v2 integrated into repo
- [x] Format Catalog (57 entries, 8 platforms) added
- [x] OpenCode integration command created
- [x] README, CHANGELOG, and timeline updated

---

## Phase 3: Build Steps 1-2 (Format Catalog + Data Model)

**Status:** Not Started

- [ ] Step 1: Place `format-catalog.ts` into `electron/shared/`
- [ ] Step 2: Extend `types.ts` with `CreativeBrief`, `AdJob`, `ExportManifest`
- [ ] Type-check both projects (`tsc --noEmit`)
- [ ] Full build verification

---

## Phase 4: Build Steps 3-5 (Settings + Intake + AI Text)

**Status:** Not Started

- [ ] Step 3: Settings — AI provider key management (Anthropic, `safeStorage`)
- [ ] Step 4: Local "Manual Job" intake form (stand-in for Unity Core)
- [ ] Step 5: AI text generation (headlines/CTAs from `CreativeBrief`)

---

## Phase 5: Build Steps 6-9 (Composition + Render + Review)

**Status:** Not Started

- [ ] Step 6: Template/composition engine (static formats, start with FB 4:5)
- [ ] Step 7: Static render/export pipeline (Canvas/SVG → PNG/JPG)
- [ ] Step 8: Review Queue UI (approve/edit/regenerate per asset)
- [ ] Step 9: Reference-file ingestion into AI generation (multi-modal)

---

## Phase 6: Build Steps 10-12 (Video + Delivery + Marquee)

**Status:** Not Started

- [ ] Step 10: Video/motion formats via Remotion (if needed for v1)
- [ ] Step 11: Delivery Service → OKLaunch (depends on schema confirmation)
- [ ] Step 12: Marquee/HTML5 ticker builder (CSS `@keyframes`)

---

## Open Decisions (Blocks)

| Decision | Blocks | Status |
|---|---|---|
| Unity Core schema confirmation | Step 11 | Pending |
| OKLaunch intake format confirmation | Step 11 | Pending |
| AI provider(s) for text + image | Step 3, Step 9 | Pending |
| Video/motion for v1? | Step 10 | Pending |
| Brand token palette | UI chrome | Pending |

---

*Last updated: 2026-09-15*
