# Unity Core JSON Intake Schema Investigation

## Goal
Design a flexible intake schema that accepts Unity Core JSON output while mapping cleanly to Vibeforge's existing `BrandKit` and `AdJob` schema.

## Uncertainty Note
*Unity Core JSON format is "not exactly sure" — this schema handles the most likely patterns while remaining extensible.*

## Schema Philosophy
1. **Extensible** — unknown fields are preserved, not rejected
2. **Mapping-first** — every Unity Core field maps to an existing Vibeforge field
3. **Source-tracking** — original Unity Core data preserved in `aiGenerationLog` for audit
4. **Graceful degradation** — missing fields use existing defaults

## 1. Standard Intake Payload (Most Likely)

```json
{
  "source": "unity-core",
  "client": {
    "businessName": "Acme Corporation",
    "website": "https://acme.com",
    "contactEmail": "dev@acme.com"
  },
  "brand": {
    "colors": ["#FF5733", "#3498DB"],
    "theme": "modern",
    "vibe": ["bold", "professional"],
    "tone": ["confident", "trustworthy"],
    "adDirection": "Highlight summer sale, free shipping CTA"
  },
  "formats": [
    "facebook-feed-universal-1x1",
    "instagram-feed-square-1x1"
  ],
  "files": [
    {
      "type": "logo",
      "url": "https://s3.acme.com/assets/logo.png",
      "filename": "logo.png"
    },
    {
      "type": "photo",
      "url": "https://s3.acme.com/assets/hero.jpg",
      "filename": "hero.jpg"
    }
  ],
  "reviewCallback": "https://clientportal.example.com/review/abc123"
}
```

### Mapping to Existing Schema

| Unity Core Field | Vibeforge Target | Mapping Notes |
|-----------------|----------------|---------------|
| `client.businessName` | `BrandKit.businessName` | Direct pass-through |
| `client.website` | `BrandKit.website` | Optional, stored as-is |
| `client.contactEmail` | (not stored) | Logged in `aiGenerationLog` only |
| `brand.colors` | `BrandKit.colors` | Direct pass-through (hex strings) |
| `brand.theme` | (not direct field) | Used for prompt generation context |
| `brand.vibe` | `BrandKit.vibeTags` | Direct pass-through |
| `brand.tone` | `BrandKit.toneTags` | Direct pass-through |
| `brand.adDirection` | (not stored) | Used as `creativeBrief.keywords` context |
| `formats[]` | `AdJob.requestedFormatIds` | Direct pass-through (format IDs from catalog) |
| `files[].url` | saved to `source/` directory | Downloaded and stored |
| `files[].type` | `BrandKit.logos` or `BrandKit.imagery` | Based on type: "logo" → logos, "photo" → imagery |

---

## 2. Minimal Intake Payload (Bare Essentials)

```json
{
  "source": "unity-core",
  "client": {
    "businessName": "Acme Corp"
  },
  "brand": {
    "colors": ["#FF5733"],
    "vibe": ["modern"],
    "tone": ["professional"]
  },
  "formats": ["facebook-feed-universal-1x1"]
}
```

### Mapping (Minimal Mode)
- Only required fields populate the project
- All other fields use existing defaults
- Fast path for quick job creation

---

## 3. Extended Intake Payload (With Assets & Direction)

```json
{
  "source": "unity-core",
  "client": {
    "businessName": "Acme Corporation",
    "website": "https://acme.com",
    "contactEmail": "dev@acme.com"
  },
  "brand": {
    "colors": ["#FF5733", "#3498DB", "#2C3E50"],
    "theme": "luxury",
    "vibe": ["bold", "professional", "elegant"],
    "tone": ["confident", "exclusive", "premium"],
    "adDirection": "Emphasize premium materials, 24-hour shipping, highlight founder story"
  },
  "formats": [
    "facebook-feed-universal-1x1",
    "instagram-stories-9x16",
    "tiktok-infeed-video-standard"
  ],
  "files": [
    {
      "type": "logo",
      "url": "https://s3.acme.com/assets/logo.png",
      "filename": "logo.png"
    },
    {
      "type": "photo",
      "url": "https://s3.acme.com/assets/product-shot.jpg",
      "filename": "product.jpg"
    },
    {
      "type": "screenshot",
      "url": "https://s3.acme.com/assets/app-screenshot.png",
      "filename": "screenshot.png"
    }
  ],
  "creativeBrief": {
    "keywords": ["summer", "sale", "fashion"],
    "phrases": ["Free shipping on all orders", "Shop the collection"],
    "toneOverride": "luxury-exclusive"
  },
  "reviewCallback": "https://clientportal.example.com/review/abc123",
  "metadata": {
    "unityCoreJobId": "job-uni-550e8400-e29b-41d4-a716-446655440000",
    "submittedAt": "2026-09-18T14:30:00Z",
    "priority": "high"
  }
}
```

### Extended Mapping

| Unity Core Field | Vibeforge Target | Notes |
|-----------------|----------------|-------|
| `creativeBrief.keywords` | `AdJob.creativeBrief.keywords` | Direct pass-through |
| `creativeBrief.phrases` | `AdJob.creativeBrief.phrases` | Direct pass-through |
| `creativeBrief.toneOverride` | Used in AI prompt `toneOverride` | Overrides `BrandKit.toneTags` |
| `metadata.unityCoreJobId` | Stored in `AdJob.unityCoreJobId` | For tracking back to Unity Core |
| `metadata.submittedAt` | Logged in `aiGenerationLog` | Timestamp of intake |
| `metadata.priority` | Used for job scheduling | Not currently used, but reserved |

---

## 4. Mapping Strategy Details

### 3.1 Colors
- Unity Core: `["#FF5733", "#3498DB"]`
- Vibeforge: `BrandKit.colors` → `BrandColor[]` with `role` assignments
- **Auto-assignment**: First color → `primary`, second → `secondary`, rest → `accent`/`background`/`text` based on brightness

### 3.2 Vibe & Tone
- Unity Core: `vibe: ["bold", "professional"]`, `tone: ["confident", "trustworthy"]`
- Vibeforge: `BrandKit.vibeTags` and `BrandKit.toneTags`
- **Direct string pass-through** — no parsing needed

### 3.3 Formats
- Unity Core: `["facebook-feed-universal-1x1", "instagram-feed-square-1x1"]`
- Vibeforge: `AdJob.requestedFormatIds`
- **Validation**: Each ID looked up in `FORMAT_CATALOG`; unknown IDs are logged but don't block creation

### 3.4 Files / Assets
- Unity Core: URLs to external assets
- Vibeforge: Downloaded to `project/source/logos/` or `project/source/photos/`
- **Download logic**: `fetch(url).then(r => r.blob()).then(blob => saveAsBlob(blob, filename))`
- **Fallback**: If URL fails, asset is created without file (asset still has `status: "draft"`)

### 3.5 Creative Brief
- Unity Core: Structured `keywords`, `phrases`, `toneOverride`
- Vibeforge: `AdJob.creativeBrief` has the same structure
- **Direct mapping** — no transformation needed

### 3.6 Review Callback
- Unity Core: URL for client portal review
- Vibeforge: Stored but not actively used unless portal integration built
- **Preserved for future use**

---

## 4. Graceful Handling of Unknown Fields

```json
{
  "source": "unity-core",
  "client": {
    "businessName": "Acme Corp"
  },
  "brand": {
    "colors": ["#FF5733"],
    "vibe": ["modern"],
    "tone": ["professional"],
    "unknownUnityField": "this will be ignored but not cause an error"
  },
  "formats": ["facebook-feed-universal-1x1"],
  "files": []
}
```

- **Unknown fields** (like `unknownUnityField`) are simply not mapped
- **Schema validation** uses `zod` or similar — only required fields are checked
- **Console warning** logged for unknown top-level keys (helps debug format changes)

---

## 5. Implementation: Intake Service Flow

### Step 1: Receive Payload
```typescript
// From IPC (renderer): window.vibeforge.submitIntake(payload)
// From file watcher: auto-process JSON from intake-drop folder
```

### Step 2: Schema Validation (Simplified)
```typescript
// Only check required fields; ignore unknown ones
if (!payload.client?.businessName || !payload.brand?.colors?.length || !payload.formats?.length) {
  throw new Error("Missing required intake fields");
}
```

### Step 2: Map to BrandKit
```typescript
const brandKit: BrandKit = {
  id: randomUUID(),
  businessName: payload.client.businessName,
  website: payload.client.website,
  colors: mapUnityColorsToBrandKitColors(payload.brand.colors),
  fonts: [], // empty, user will set later
  logos: [],
  imagery: [],
  vibeTags: payload.brand.vibe,
  toneTags: payload.brand.tone,
  approvedHeadlines: [],
  approved: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### Step 3: Map to AdJob
```typescript
const adJob: AdJob = {
  id: randomUUID(),
  businessId: brandKit.id,
  businessName: payload.client.businessName,
  brandKitId: brandKit.id,
  requestedFormatIds: payload.formats,
  creativeBrief: {
    keywords: payload.creativeBrief?.keywords ?? [],
    phrases: payload.creativeBrief?.phrases ?? [],
    referenceAssetPaths: [], // filled after file download
    screenshotPaths: [],
    toneOverride: payload.creativeBrief?.toneOverride,
  },
  status: "queued",
  createdAt: new Date().toISOString(),
};
```

### Step 4: Persist
```typescript
// Create project + brand kit + job in sequence
const { project, brandKit } = await window.vibeforge.createProject({
  name: `Job for ${payload.client.businessName}`,
  businessName: payload.client.businessName,
  website: payload.client.website,
  industry: "unknown", // Unity Core doesn't provide; defaults to unknown
});

// Create the job
const { job, assets } = await window.vibeforge.createAdJob(
  project,
  brandKit,
  {
    businessName: payload.client.businessName,
    brandKitId: brandKit.id,
    requestedFormatIds: payload.formats,
    creativeBrief: adJob.creativeBrief,
    dueAt: undefined,
  }
);
```

### Step 5: Download Files
```typescript
// For each file in payload.files
await downloadAndSaveFile(file.url, file.filename, project.rootPath);
```

---

## 6. Sample: Complete End-to-End Flow

### Unity Core Sends:
```json
{
  "source": "unity-core",
  "client": {
    "businessName": "Acme Corporation",
    "website": "https://acme.com",
    "contactEmail": "dev@acme.com"
  },
  "brand": {
    "colors": ["#FF5733", "#3498DB"],
    "theme": "modern",
    "vibe": ["bold", "professional"],
    "tone": ["confident", "trustworthy"],
    "adDirection": "Highlight summer sale, free shipping CTA"
  },
  "formats": ["facebook-feed-universal-1x1", "instagram-feed-square-1x1"],
  "files": [
    {
      "type": "logo",
      "url": "https://s3.acme.com/assets/logo.png",
      "filename": "logo.png"
    }
  ],
  "creativeBrief": {
    "keywords": ["summer", "sale"],
    "phrases": ["Free shipping on all orders"],
    "toneOverride": "confident-trustworthy"
  },
  "metadata": {
    "unityCoreJobId": "job-uni-001",
    "submittedAt": "2026-09-18T14:30:00Z"
  }
}
```

### Vibeforge Creates:
1. **Project**: `Acme Corporation`, modern theme, colors `#FF5733`/`#3498DB`, vibe `bold, professional`, tone `confident, trustworthy`
2. **AdJob**: `status: "queued"`, `requestedFormatIds: ["facebook-feed-universal-1x1", "instagram-feed-square-1x1"]`, `creativeBrief: {keywords: ["summer", "sale"], phrases: ["Free shipping on all orders"], toneOverride: "confident-trustworthy"}`
3. **Files**: `logo.png` downloaded to `project/source/logos/logo.png`
4. **User sees**: Job in Job List → clicks → Job Detail → "Generate All Ads" → assets generated → status → `needs-review`

---

## 7. Extensibility Additions

### Adding New Unity Core Fields (Future)
When Unity Core adds new fields, they can be added to the schema with minimal changes:

1. Add field to `IntakePayload` interface in `intake-service.ts` (or leave it out — unknown fields are tolerated)
2. Add mapping logic in the intake service
3. Optionally store in `aiGenerationLog` for audit

### Example: Adding a New Field
```typescript
// In the intake payload interface:
export interface IntakePayload {
  // ... existing fields
  "redirectUrl?: string", // new field from Unity Core
}

// In the mapping logic:
const brandKit = {
  // ... existing mappings
  // new field can be stored in a generic metadata field if needed:
  metadata: {
    redirectUrl: payload.redirectUrl,
  },
};
```

---

## 8. Summary: Mapping Table

| Unity Core Field | Vibeforge Field | Action |
|-----------------|----------------|--------|
| `client.businessName` | `BrandKit.businessName` | Direct pass-through |
| `client.website` | `BrandKit.website` | Direct pass-through |
| `brand.colors` | `BrandKit.colors` | Direct pass-through; auto-assign roles |
| `brand.vibe` | `BrandKit.vibeTags` | Direct pass-through (string array) |
| `brand.tone` | `BrandKit.toneTags` | Direct pass-through (string array) |
| `brand.adDirection` | Used in AI prompt context | Not stored as field, used for generation |
| `formats[]` | `AdJob.requestedFormatIds` | Direct pass-through; validated against catalog |
| `files[].url` | Saved to `source/` dir | Downloaded; asset created without file if fail |
| `creativeBrief.keywords` | `AdJob.creativeBrief.keywords` | Direct pass-through |
| `creativeBrief.phrases` | `AdJob.creativeBrief.phrases` | Direct pass-through |
| `creativeBrief.toneOverride` | AI prompt `toneOverride` | Overrides BrandKit toneTags |
| `metadata.unityCoreJobId` | `AdJob.unityCoreJobId` | For tracking/tracing |
| `metadata.submittedAt` | Logged in `aiGenerationLog` | Audit trail |
| `unknownField` | Ignored | Tolerated, not rejected |

---

## 8. Next Steps

1. **Implement the intake service** using this schema
2. **Test with sample payloads** (the three examples above)
3. **Add file downloading** logic for `files[].url`
4. **Add IPC handler** `window.vibeforge.submitIntake(payload)` in the renderer
5. **Add file watcher** for `%USERDATA%\intake-drop\*.json` fallback
6. **Test end-to-end** with mocked Unity Core data

When you have a sample Unity Core JSON output, I can generate specific mapping code for that exact format.