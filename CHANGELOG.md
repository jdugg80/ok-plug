# Changelog

All notable changes to Vibeforge will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Vibeforge Blueprint v2 (`docs/vibeforge-blueprint-v2.md`)
- Ad Format Catalog with 57 entries across 8 platforms (`docs/format-catalog.ts`)
- OpenCode integration command (`.opencode/command/integrate-format-catalog.md`)
- Project timeline with 6-phase roadmap

### Changed
- Renamed project from "ok-plug" to "Vibeforge" in documentation
- Updated README to reflect pipeline architecture and actual scope
- Cleaned up project scaffolding (Vite React plugin, tsconfig, index.html, styles, App.tsx)

### Removed
- Orphaned `src/main.ts` (legacy template file)
- Orphaned `ok-plug/` sub-project directory (duplicate template)

## [0.1.0] - 2026-06-10

### Added
- Initial Tauri v2 project scaffold (React 19 + TypeScript + Vite)
- Rust backend with `greet` command
- Basic window configuration (800x600)
- Tauri plugin-opener for file/URL handling
- Capabilities-based security model (Tauri v2)
