---
description: Build Step 3 of Vibeforge Blueprint v2 - AI provider key management via safeStorage
agent: build
---

You're continuing Vibeforge at `C:\Projects\01-OkayestMedia\ok-plug`. Steps
1–2 (Format Catalog, extended data model) are done and committed
(`1255a91`). This is **Step 3**: Settings-page AI provider key management,
storing the key via Electron's `safeStorage` (OS-level encryption), never
exposing the raw key to the renderer.

Do these in order. Type-check after each code change, not just at the end
— if something breaks, I want to know which step caused it.

## 1. Add the secure storage service

Create `electron/main/services/secure-storage-service.ts` using the
provided file of that name — copy it in as-is, it's complete. It exposes:
`getAnthropicKeyStatus()`, `setAnthropicKey(key)`, `clearAnthropicKey()`,
and `getAnthropicKeyForInternalUse()` (main-process-only, not for IPC —
Step 5 will use this later when making real API calls).

## 2. Add IPC channels

In `electron/shared/ipc-channels.ts`, add to the `IpcChannels` const object
(same pattern as the existing `Project*` and `Dialog*` entries):

```typescript
SettingsGetAiKeyStatus: "settings:get-ai-key-status",
SettingsSetAiKey: "settings:set-ai-key",
SettingsClearAiKey: "settings:clear-ai-key",
```

## 3. Register the IPC handlers

In `electron/main/ipc/register-ipc-handlers.ts`, import from the new
service and add three handlers, following the exact pattern the existing
`Project*` handlers use (`ipcMain.handle(...)`, async, typed return):

- `SettingsGetAiKeyStatus` → calls `getAnthropicKeyStatus()`, returns
  `AiKeyStatus`
- `SettingsSetAiKey` → takes `(_event, rawKey: string)`, calls
  `setAnthropicKey(rawKey)`, returns `void`. Let thrown errors propagate —
  don't swallow them, the renderer needs to show the real error message.
- `SettingsClearAiKey` → calls `clearAnthropicKey()`, returns `void`

## 4. Extend the preload bridge

In `electron/preload/preload.ts`, add to the `vibeforgeApi` object (same
pattern as existing methods):

```typescript
getAiKeyStatus: (): Promise<AiKeyStatus> =>
  ipcRenderer.invoke(IpcChannels.SettingsGetAiKeyStatus),

setAiApiKey: (key: string): Promise<void> =>
  ipcRenderer.invoke(IpcChannels.SettingsSetAiKey, key),

clearAiApiKey: (): Promise<void> =>
  ipcRenderer.invoke(IpcChannels.SettingsClearAiKey),
```

Import `AiKeyStatus` from the secure storage service's type export.

## 5. Replace the Settings page

Replace `src/features/settings/SettingsPage.tsx` entirely with the
provided version — it adds the AI Provider section (key status, save/clear
form, encryption-unavailable warning) while keeping the existing About and
Rendering sections.

Append the contents of the provided `SettingsPage.module.additions.css`
onto the end of the existing `src/features/settings/SettingsPage.module.css`
— don't replace that file, just add these new classes to it.

## 6. Verify

- `npx tsc -p tsconfig.json --noEmit`
- `npx tsc -p electron/tsconfig.json --noEmit`
- `npm run build`

All three must pass clean.

## 7. Manual check (can't be automated — tell me to do this)

Since this needs OS-level `safeStorage` and a running window, tell me to
run `npm run electron:dev` and manually verify: entering a key and saving
shows "Set (encrypted)", restarting the app keeps that status (proving the
file persisted), and Clear Key returns it to "Not set." I'll do this
myself and report back — don't mark this step done until I confirm it.

## 8. Commit

```
Add AI provider key management via safeStorage (Blueprint v2 Step 3)

- electron/main/services/secure-storage-service.ts: encrypted key
  storage using Electron safeStorage, written to userData/secrets/
- New IPC channels: settings:get-ai-key-status, settings:set-ai-key,
  settings:clear-ai-key
- Settings page: AI Provider section with save/clear key UI and
  encryption-unavailable warning state
- Raw key is never exposed to the renderer at any point — only
  { isSet, encryptionAvailable } status
```

Do not push. Show me `git show --stat HEAD` and wait for my manual
verification (step 7) before considering this step closed.
