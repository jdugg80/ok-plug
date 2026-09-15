# Autosave Patch

## What changed and why

**Bug found:** color fields save on every keystroke (native `onChange`),
but the vibe/tone tag inputs only committed a tag to state when you
pressed Enter. If you typed a tag and clicked "Save Project" without
pressing Enter first, that tag never entered state at all — nothing to
save. Not a save bug, an input-commit bug.

**Fixes:**
1. Tag inputs now also commit on blur (clicking away, e.g. to the Save
   button), not just Enter.
2. Real debounced autosave: any edit to the Brand Kit schedules a save
   ~1.2 seconds after the last change. Editing again resets the timer,
   so it fires when you pause, not once per keystroke. The manual "Save
   Project" button still exists and still works for an immediate save.
3. The header's status text now has a `"pending"` state ("Saving
   soon…") between an edit and the autosave actually firing, so it's
   clear a save is scheduled rather than lost.

## Files (drop-in replacements)

- `src/store/project-store.ts`
- `src/components/ProjectHeader.tsx`
- `src/components/ProjectHeader.module.css`
- `src/features/brand-kit/BrandKitPage.tsx`

Just overwrite the existing files at those paths — no other files
changed. `npx tsc -p tsconfig.json --noEmit` and `npm run build` both
verified clean with these in place.

## Worth testing

1. Open the "Test" project from before.
2. Add a color — confirm status goes to "Saving soon…" then "Saved"
   within ~1-2 seconds, with no button click.
3. Type a vibe tag and press Enter — same autosave behavior.
4. Type a tone tag but click "Save Project" directly instead of
   pressing Enter first — confirm the tag now still gets committed
   (this is the blur fix).
5. Close and reopen the project, confirm colors AND tags both persisted.
