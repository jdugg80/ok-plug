#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Repairs ok-plug: the Electron foundation was never actually
# extracted into this repo (src-tauri/ was still present,
# package.json still had Tauri scripts), so Steps 1-3 got built
# on top of an empty Tauri scaffold instead of a real app shell.
#
# This wipes everything except .git and extracts a verified
# snapshot: install, type-check (both configs), and a full
# `npm run build` all passed clean before this zip was made.
#
# Edit the two paths below, then run:
#   bash repair-ok-plug.sh
# ─────────────────────────────────────────────────────────────

REPO_DIR="/c/Projects/01-OkayestMedia/ok-plug"
ZIP_PATH="/c/path/to/vibeforge-corrected.zip"

# ─────────────────────────────────────────────────────────────

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Error: $REPO_DIR has no .git folder — not a git repo, stopping."
  exit 1
fi

if [ ! -f "$ZIP_PATH" ]; then
  echo "Error: zip not found at $ZIP_PATH"
  exit 1
fi

ZIP_PATH="$(cd "$(dirname "$ZIP_PATH")" && pwd)/$(basename "$ZIP_PATH")"
cd "$REPO_DIR"

echo "==> Repo: $REPO_DIR"
echo "==> Zip:  $ZIP_PATH"

echo "==> git status before wiping (for the record):"
git status --short || true

echo "==> Removing everything except .git ..."
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

echo "==> Extracting corrected snapshot ..."
unzip -q "$ZIP_PATH" -d .

echo "==> Installing dependencies ..."
npm install

echo "==> Type-checking renderer ..."
npx tsc -p tsconfig.json --noEmit

echo "==> Type-checking electron (type-check config) ..."
npx tsc -p electron/tsconfig.json --noEmit

echo "==> Compiling electron (build config, real emit) ..."
npx tsc -p electron/tsconfig.build.json

echo "==> Running full production build ..."
npm run build

echo "==> Verifying compiled output landed where package.json expects ..."
if [ ! -f "dist-electron/main/main.js" ]; then
  echo "Error: dist-electron/main/main.js missing after build — something is wrong, not committing."
  exit 1
fi
if [ ! -f "dist/index.html" ]; then
  echo "Error: dist/index.html missing after build — not committing."
  exit 1
fi

echo "==> Staging and committing ..."
git add -A
git commit -m "Repair: extract real Electron foundation (src-tauri never removed, package.json never replaced)

- Removed src-tauri/ (Tauri scaffold was still present, unused)
- package.json replaced with real Electron scripts/deps (electron:dev, package)
- Added missing electron/main/main.ts, windows.ts, project-service.ts
- Completed electron/shared/types.ts (Step 1-2 version had no rootPath,
  no assets array, BrandKit missing website/fonts/logos/imagery — nothing
  real depended on those gaps yet, so completed rather than worked around)
- Extended register-ipc-handlers.ts and preload.ts to add Project/Dialog
  handling alongside the existing Settings/AI-key work (kept as-is)
- Added full renderer: app shell, nav, Dashboard, Brand Kit editor,
  placeholder pages, Zustand store wired to the real preload API
- Verified end-to-end: npm install, both tsc configs, and npm run build
  all pass; dist-electron/main/main.js and dist/index.html confirmed
  present at the paths package.json and windows.ts expect"

echo ""
echo "==> Done. git log:"
git log --oneline -5
echo ""
echo "==> Nothing was pushed. Review with: git show --stat HEAD"
echo "==> Then verify it actually runs with: npm run electron:dev"
