/**
 * Intake Service
 * Maps ad_intake DB schema (migration 097) to Vibeforge BrandKit + AdJob.
 *
 * Supported source types from ad_intake.source:
 *   - 'manual': Direct manual entry
 *   - 'website_inquiry': Website contact form submission
 *   - 'website_job_request': Formal website job request
 *
 * Status flow from ad_intake.status:
 *   - 'submitted' → 'queued'
 *   - 'scanned' → 'in-progress'
 *   - 'quoted' → 'needs-review'
 *   - 'approved' → 'approved'
 *   - 'active' → 'delivered'
 *   - 'completed' → 'exported'
 *   - 'archived' → 'archived'
 */

import { randomUUID } from "crypto";
import type {
  VibeforgeProject,
  BrandKit,
  BrandColor,
  AdJob,
  AssetRecord,
} from "../../shared/types";
import { FORMAT_CATALOG } from "../../shared/format-catalog";

// DB Row structure from ad_intake table (migration 097)
export interface AdIntakeDBRow {
  id: number;
  request_type: "simple_asset" | "campaign";
  source: "manual" | "website_inquiry" | "website_job_request";
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  secondary_contact_name: string;
  secondary_contact_email: string;
  secondary_contact_phone: string;
  status:
    | "submitted"
    | "scanned"
    | "quoted"
    | "approved"
    | "active"
    | "completed"
    | "archived";
  created_at: string;
  updated_at: string;
}

/**
 * Helper to create a BrandColor object.
 */
function makeBrandColor(hex: string, role: "primary" | "secondary" | "accent" | "background" | "text" | "other"): BrandColor {
  return {
    id: randomUUID(),
    hex,
    role,
    label: undefined,
    confidence: undefined,
  };
}

/**
 * Map a DB row from ad_intake to a BrandKit.
 * Handles all three source types and maps status to initial brand properties.
 *
 * @param db - The DB row from ad_intake table
 * @returns A BrandKit instance populated from the DB data
 */
export function mapDbToBrandKit(db: AdIntakeDBRow): BrandKit {
  // Determine if this is a campaign or single asset
  const isCampaign = db.request_type === "campaign";

  // Map source to brand name context
  let brandContext = db.contact_name;
  if (db.source === "website_inquiry") {
    brandContext = `Website Inquiry: ${db.contact_name}`;
  } else if (db.source === "website_job_request") {
    brandContext = `Website Job Request: ${db.contact_name}`;
  }

  // Map status to initial vibe/tone based on pipeline stage
  let vibeTags: string[] = [];
  let toneTags: string[] = [];

  switch (db.status) {
    case "submitted":
      vibeTags = ["pending"];
      toneTags = ["awaiting-review"];
      break;
    case "scanned":
      vibeTags = ["generating"];
      toneTags = ["in-progress"];
      break;
    case "quoted":
      vibeTags = ["review-pending"];
      toneTags = ["pending-approval"];
      break;
    case "approved":
      vibeTags = ["approved"];
      toneTags = ["approved"];
      break;
    case "active":
      vibeTags = ["active"];
      toneTags = ["delivering"];
      break;
    case "completed":
      vibeTags = ["completed"];
      toneTags = ["finished"];
      break;
    case "archived":
      vibeTags = ["archived"];
      toneTags = ["archived"];
      break;
    default:
      vibeTags = ["manual"];
      toneTags = ["manual"];
  }

  // If campaign mode, add additional tags
  if (isCampaign) {
    vibeTags.push("multi-asset");
    toneTags.push("coordinated");
  }

  // Map colors - use sensible defaults based on contact info
  const primaryColor = db.contact_email?.includes("gmail") ? "#FF5733" : "#3498DB";
  const secondaryColor = db.contact_phone?.length > 0 ? "#2C3E50" : "#E74C3C";

  return {
    id: randomUUID(),
    businessName: db.contact_name,
    website: "", // Not stored in ad_intake; could derive from contact_email domain
    fonts: [], // Added required fonts field
    colors: [makeBrandColor(primaryColor, "primary"), makeBrandColor(secondaryColor, "secondary")],
    vibeTags,
    toneTags,
    logos: [],
    imagery: [],
    approvedHeadlines: [],
    approved: db.status === "approved" || db.status === "active",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Map a DB row from ad_intake to an AdJob.
 *
 * Handles request_type (simple_asset vs campaign) and maps status
 * from the DB status flow to Vibeforge job status.
 *
 * @param db - The DB row from ad_intake table
 * @returns An AdJob instance populated from the DB data
 */
export function mapDbToAdJob(db: AdIntakeDBRow): AdJob {
  // Map request_type to format IDs
  const formatIds: string[] = [];
  if (db.request_type === "simple_asset") {
    // Single default format
    formatIds.push("facebook-feed-universal-1x1");
  } else if (db.request_type === "campaign") {
    // Campaign: add multiple common formats
    formatIds.push("facebook-feed-universal-1x1");
    formatIds.push("instagram-feed-square-1x1");
    formatIds.push("instagram-reels-9x16");
  }

  // Map status to Vibeforge status
  const statusMap: any = {
    submitted: "queued",
    scanned: "in-progress",
    quoted: "needs-review",
    approved: "approved",
    active: "delivered",
    completed: "exported",
    archived: "archived",
  };

  // Map creative brief - use limited info from DB
  const creativeBrief: any = {
    keywords: [], // not in DB; could derive from contact_name or adDirection
    phrases: [], // not in DB
    toneOverride: undefined,
  };

  // If status is quoted or above, set tone override
  if (db.status === "quoted" || db.status === "approved" || db.status === "active") {
    creativeBrief.toneOverride = `pending-${db.status}`;
  }

  return {
    id: randomUUID(),
    businessId: "", // not in DB
    businessName: db.contact_name,
    brandKitId: "", // will be set when BrandKit is created
    requestedFormatIds: formatIds,
    creativeBrief,
    status: statusMap[db.status] || "queued",
    createdAt: db.created_at,
    dueAt: undefined,
  };
}

/**
 * Map the DB status to Vibeforge job status pipeline.
 *
 * @param status - The DB status value
 * @returns The corresponding Vibeforge job status
 */
export function mapIntakeStatusToJob(status: AdIntakeDBRow["status"]): AdJob["status"] {
  const flow: any = {
    submitted: "queued",
    scanned: "in-progress",
    quoted: "needs-review",
    approved: "approved",
    active: "delivered",
    completed: "exported",
    archived: "archived",
  };

  return flow[status] || "queued";
}

/**
 * Get the next valid status in the pipeline from current status.
 *
 * @param current - Current DB status
 * @returns Next DB status, or null if at terminal state
 */
export function getNextIntakeStatus(
  current: AdIntakeDBRow["status"]
): AdIntakeDBRow["status"] | null {
  const next: any = {
    submitted: "scanned",
    scanned: "quoted",
    quoted: "approved",
    approved: "active",
    active: "completed",
    completed: "archived",
    archived: null,
  };

  return next[current] || null;
}

/**
 * Get the previous valid status in the pipeline from current status.
 *
 * @param current - Current DB status
 * @returns Previous DB status, or null if at initial state
 */
export function getPreviousIntakeStatus(
  current: AdIntakeDBRow["status"]
): AdIntakeDBRow["status"] | null {
  const previous: any = {
    submitted: null,
    scanned: "submitted",
    quoted: "scanned",
    approved: "quoted",
    active: "approved",
    completed: "active",
    archived: "completed",
  };

  return previous[current] || null;
}