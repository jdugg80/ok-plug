/**
 * Canonical ad-format catalog, transcribed from
 * digital-ad-sizes-reference-2026.md (specs current as of Sept 2026).
 *
 * This is the single source of truth for every downstream step —
 * composition, safe zones, and export caps all read from here.
 * Per-row fields come only from that row's own column in the source
 * doc; section-wide "File limits" footnotes live in
 * PLATFORM_FILE_LIMITS below instead of being duplicated onto rows
 * that didn't individually state them, to avoid fabricating numbers
 * the source didn't actually tie to that specific placement.
 */

export type Platform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "youtube"
  | "website"
  | "nextdoor"
  | "marquee";

export type MediaType =
  | "static"
  | "video"
  | "static-or-video"
  | "html5"
  | "static-or-html5";

export interface AdFormatSpec {
  id: string;
  platform: Platform;
  placement: string;
  width: number;
  height: number;
  ratio: string;
  mediaType: MediaType;
  minDurationSec?: number;
  maxDurationSec?: number;
  maxFileSizeKB?: number;
  safeZoneNotes?: string;
  fileTypeNotes?: string;
  otherNotes?: string;
}

export const PLATFORM_FILE_LIMITS: Record<Platform, string> = {
  facebook: "Images JPG/PNG, max 30MB. Video MP4/MOV H.264, max 4GB, 1 sec–241 min.",
  instagram: "Images JPG/PNG, max 30MB. Video MP4/MOV H.264, max 4GB, 1 sec–241 min. (Shared Meta limits.)",
  tiktok: "Video max 500MB, min resolution 540x960 (720x1280+ recommended). No static banner/HTML5 support — everything is native vertical video/image in the feed.",
  x: "Images under 5MB. GIFs render as static in ads (avoid). Video max 1GB (30MB+ strongly recommended for performance), MP4/MOV H.264.",
  youtube: "Video max ~128GB or 12 hrs (whichever is less), MP4/MOV/AVI/WMV/FLV/WebM accepted. Companion banner static images capped at 150KB.",
  website: "Static JPG/PNG/GIF max 150KB on Google Display Network, or animated HTML5 (initial load ~150–250KB, subload up to 500KB depending on ad size tier; animation should loop/stop within ~30 sec per most network policies).",
  nextdoor: "Images under 1MB, JPEG/PNG. Video MOV/MP4, max 50MB (Neighborhood Extension video up to 1GB, VAST or MP4).",
  marquee: "Not a platform-served format — custom-built HTML5/CSS. Pure CSS @keyframes translateX/translateY (no JS dependency) is most compatible; falls back gracefully as a static image if a network doesn't support animated/HTML5 creative. Loop speed roughly 50–80px/sec. Total file weight under the placement's static-image cap (150KB for most website display slots) if delivered as an HTML5 banner rather than embedded directly.",
};

export const FORMAT_CATALOG: AdFormatSpec[] = [
  // ── Facebook (Meta) ─────────────────────────────────────────
  {
    id: "facebook-feed-mobile-4x5",
    platform: "facebook",
    placement: "Feed (mobile-optimized)",
    width: 1080,
    height: 1350,
    ratio: "4:5",
    mediaType: "static-or-video",
    otherNotes: "Best mobile real estate; recommended default.",
  },
  {
    id: "facebook-feed-universal-1x1",
    platform: "facebook",
    placement: "Feed (universal/all placements)",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
    otherNotes: "Safest single-asset choice if running everywhere.",
  },
  {
    id: "facebook-stories-reels-9x16",
    platform: "facebook",
    placement: "Stories / Reels",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "static-or-video",
    safeZoneNotes: "Full-screen vertical; keep text out of top/bottom ~20% safe zones.",
  },
  {
    id: "facebook-instream-video-midroll",
    platform: "facebook",
    placement: "In-stream video (mid-roll)",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    otherNotes: "Alt size 1080x1080 (1:1) also accepted. Only placement where landscape still wins.",
  },
  {
    id: "facebook-right-column-desktop",
    platform: "facebook",
    placement: "Right column (desktop)",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    mediaType: "static",
    otherNotes: "Legacy desktop-only unit.",
  },
  {
    id: "facebook-carousel-card",
    platform: "facebook",
    placement: "Carousel (per card)",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
    otherNotes: "2–10 cards per carousel.",
  },
  {
    id: "facebook-marketplace",
    platform: "facebook",
    placement: "Marketplace",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static",
  },
  {
    id: "facebook-messenger-inbox",
    platform: "facebook",
    placement: "Messenger Inbox",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
    otherNotes: "No carousel support here.",
  },
  {
    id: "facebook-messenger-stories",
    platform: "facebook",
    placement: "Messenger Stories",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "static-or-video",
  },

  // ── Instagram (Meta) ────────────────────────────────────────
  {
    id: "instagram-feed",
    platform: "instagram",
    placement: "Feed",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
    otherNotes: "Alt size 1080x1350 (4:5) for extra height.",
  },
  {
    id: "instagram-stories",
    platform: "instagram",
    placement: "Stories",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "static-or-video",
    safeZoneNotes: "Keep key content out of bottom 20–35% (UI overlays).",
  },
  {
    id: "instagram-reels",
    platform: "instagram",
    placement: "Reels",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "video",
    minDurationSec: 1,
    maxDurationSec: 90,
    safeZoneNotes: "Keep key content out of bottom 20–35% (UI overlays).",
    otherNotes: "Video only, up to 90 sec (15–30 sec sweet spot).",
  },
  {
    id: "instagram-explore",
    platform: "instagram",
    placement: "Explore",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
    otherNotes: "Same as Feed specs (1:1 or 4:5) — 4:5 tends to outperform.",
  },
  {
    id: "instagram-carousel-card",
    platform: "instagram",
    placement: "Carousel (per card)",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    mediaType: "static-or-video",
  },

  // ── TikTok ──────────────────────────────────────────────────
  {
    id: "tiktok-infeed-video-standard",
    platform: "tiktok",
    placement: "In-Feed video (standard)",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "video",
    minDurationSec: 5,
    maxDurationSec: 600,
    safeZoneNotes: "80px side margins, 160px clear from top, 440px clear from bottom (UI/caption overlay area).",
    otherNotes: "9:16 recommended. 5 sec–10 min (15–30 sec sweet spot).",
  },
  {
    id: "tiktok-infeed-video-alt",
    platform: "tiktok",
    placement: "In-Feed (also accepted)",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    minDurationSec: 5,
    maxDurationSec: 600,
    otherNotes: "1:1 (1080x1080) also accepted, same duration range.",
  },
  {
    id: "tiktok-infeed-image-ad",
    platform: "tiktok",
    placement: "In-Feed image ad",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "static",
    otherNotes: "Vertical strongly preferred.",
  },
  {
    id: "tiktok-topview",
    platform: "tiktok",
    placement: "TopView (full-screen open unit)",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "video",
    minDurationSec: 5,
    maxDurationSec: 60,
    otherNotes: "Premium reserved placement.",
  },
  {
    id: "tiktok-spark-ads",
    platform: "tiktok",
    placement: "Spark Ads (boosted organic post)",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "video",
    otherNotes: "Inherits original post's dimensions (9:16 typical). No fixed duration limit.",
  },

  // ── X (Twitter) ─────────────────────────────────────────────
  {
    id: "x-promoted-image-standalone",
    platform: "x",
    placement: "Promoted image (standalone)",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    mediaType: "static",
  },
  {
    id: "x-promoted-image-cta",
    platform: "x",
    placement: "Promoted image (with CTA button)",
    width: 800,
    height: 418,
    ratio: "1.91:1",
    mediaType: "static",
    otherNotes: "Alt size 800x800 (1:1) also accepted.",
  },
  {
    id: "x-promoted-video",
    platform: "x",
    placement: "Promoted video",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    maxDurationSec: 140,
    otherNotes: "Alt orientations 1:1 or 9:16 (1080x1920) accepted. Up to 2:20, 15–30 sec recommended.",
  },
  {
    id: "x-carousel-card",
    platform: "x",
    placement: "Carousel (per card)",
    width: 800,
    height: 418,
    ratio: "1.91:1",
    mediaType: "static-or-video",
    otherNotes: "Alt size 800x800 (1:1). 2–6 cards.",
  },
  {
    id: "x-amplify-preroll",
    platform: "x",
    placement: "Amplify pre-roll",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    maxDurationSec: 15,
    otherNotes: "15 sec or less recommended.",
  },
  {
    id: "x-header-banner",
    platform: "x",
    placement: "Header banner (profile)",
    width: 1500,
    height: 500,
    ratio: "3:1",
    mediaType: "static",
  },

  // ── YouTube (Google Ads) ────────────────────────────────────
  {
    id: "youtube-skippable-instream",
    platform: "youtube",
    placement: "Skippable in-stream",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    minDurationSec: 12,
    maxDurationSec: 180,
    otherNotes: "Also 1280x720, 854x480 accepted. Skippable after 5 sec.",
  },
  {
    id: "youtube-nonskippable-instream",
    platform: "youtube",
    placement: "Non-skippable in-stream",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    minDurationSec: 15,
    maxDurationSec: 20,
  },
  {
    id: "youtube-bumper",
    platform: "youtube",
    placement: "Bumper (non-skippable)",
    width: 1920,
    height: 1080,
    ratio: "16:9",
    mediaType: "video",
    maxDurationSec: 6,
  },
  {
    id: "youtube-infeed-discovery",
    platform: "youtube",
    placement: "In-Feed (Discovery)",
    width: 1280,
    height: 720,
    ratio: "16:9",
    mediaType: "video",
    otherNotes: "Thumbnail + linked video, click-to-play. Any length.",
  },
  {
    id: "youtube-shorts-ad",
    platform: "youtube",
    placement: "YouTube Shorts ad",
    width: 1080,
    height: 1920,
    ratio: "9:16",
    mediaType: "video",
    maxDurationSec: 60,
  },
  {
    id: "youtube-companion-banner",
    platform: "youtube",
    placement: "Companion banner (desktop, runs alongside in-stream)",
    width: 300,
    height: 60,
    ratio: "5:1",
    mediaType: "static",
    maxFileSizeKB: 150,
  },
  {
    id: "youtube-display-asset-1200x628",
    platform: "youtube",
    placement: "Display / Masthead / Discovery image assets",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    mediaType: "static",
    otherNotes: "For Demand Gen / PMax asset groups.",
  },
  {
    id: "youtube-display-asset-1200x1200",
    platform: "youtube",
    placement: "Display / Masthead / Discovery image assets",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    mediaType: "static",
    otherNotes: "For Demand Gen / PMax asset groups.",
  },
  {
    id: "youtube-display-asset-1200x300",
    platform: "youtube",
    placement: "Display / Masthead / Discovery image assets",
    width: 1200,
    height: 300,
    ratio: "4:1",
    mediaType: "static",
    otherNotes: "For Demand Gen / PMax asset groups.",
  },

  // ── Website (Standard IAB Display / Banner) ────────────────
  // Primary five — build these first, they cover the majority of
  // programmatic and direct-buy display inventory.
  {
    id: "website-medium-rectangle",
    platform: "website",
    placement: "Medium Rectangle",
    width: 300,
    height: 250,
    ratio: "1.2:1",
    mediaType: "static-or-html5",
    otherNotes: "In-content, sidebar — highest overall CTR.",
  },
  {
    id: "website-leaderboard",
    platform: "website",
    placement: "Leaderboard",
    width: 728,
    height: 90,
    ratio: "8.09:1",
    mediaType: "static-or-html5",
    otherNotes: "Top of page, desktop.",
  },
  {
    id: "website-wide-skyscraper",
    platform: "website",
    placement: "Wide Skyscraper",
    width: 160,
    height: 600,
    ratio: "1:3.75",
    mediaType: "static-or-html5",
    otherNotes: "Sidebar, stays visible on scroll.",
  },
  {
    id: "website-half-page",
    platform: "website",
    placement: "Half Page",
    width: 300,
    height: 600,
    ratio: "1:2",
    mediaType: "static-or-html5",
    otherNotes: "Sidebar, high-impact brand unit.",
  },
  {
    id: "website-mobile-banner",
    platform: "website",
    placement: "Mobile Banner",
    width: 320,
    height: 50,
    ratio: "6.4:1",
    mediaType: "static-or-html5",
    otherNotes: "Mobile top/bottom sticky.",
  },
  // Secondary/premium sizes.
  {
    id: "website-billboard",
    platform: "website",
    placement: "Billboard",
    width: 970,
    height: 250,
    ratio: "3.88:1",
    mediaType: "static-or-html5",
  },
  {
    id: "website-super-leaderboard",
    platform: "website",
    placement: "Super Leaderboard",
    width: 970,
    height: 90,
    ratio: "10.78:1",
    mediaType: "static-or-html5",
  },
  {
    id: "website-large-rectangle",
    platform: "website",
    placement: "Large Rectangle",
    width: 336,
    height: 280,
    ratio: "1.2:1",
    mediaType: "static-or-html5",
  },
  {
    id: "website-large-mobile-banner",
    platform: "website",
    placement: "Large Mobile Banner",
    width: 320,
    height: 100,
    ratio: "3.2:1",
    mediaType: "static-or-html5",
  },
  {
    id: "website-mobile-interstitial",
    platform: "website",
    placement: "Mobile Interstitial",
    width: 320,
    height: 480,
    ratio: "2:3",
    mediaType: "static-or-html5",
  },
  {
    id: "website-portrait",
    platform: "website",
    placement: "Portrait",
    width: 300,
    height: 1050,
    ratio: "2:7",
    mediaType: "static-or-html5",
  },

  // ── Nextdoor ────────────────────────────────────────────────
  {
    id: "nextdoor-sponsored-post-large",
    platform: "nextdoor",
    placement: "Sponsored Post — large image",
    width: 1200,
    height: 628,
    ratio: "1.91:1",
    mediaType: "static",
  },
  {
    id: "nextdoor-sponsored-post-small",
    platform: "nextdoor",
    placement: "Sponsored Post — small image",
    width: 250,
    height: 250,
    ratio: "1:1",
    mediaType: "static",
  },
  {
    id: "nextdoor-spotlight-ad",
    platform: "nextdoor",
    placement: "Spotlight Ad",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    mediaType: "static",
  },
  {
    id: "nextdoor-video-ad",
    platform: "nextdoor",
    placement: "Video ad",
    width: 1200,
    height: 628,
    ratio: "16:9",
    mediaType: "video",
    minDurationSec: 3,
    maxDurationSec: 120,
    otherNotes: "Thumbnail is 1200x628; video itself is 16:9. Max 50MB.",
  },
  {
    id: "nextdoor-carousel-card",
    platform: "nextdoor",
    placement: "Carousel (per card)",
    width: 464,
    height: 464,
    ratio: "1:1",
    mediaType: "static",
    otherNotes: "Minimum 232x232. 1–5 images.",
  },
  {
    id: "nextdoor-neighborhood-ext-large",
    platform: "nextdoor",
    placement: "Neighborhood Extension — large image",
    width: 1200,
    height: 627,
    ratio: "1.91:1",
    mediaType: "static",
  },
  {
    id: "nextdoor-neighborhood-ext-small",
    platform: "nextdoor",
    placement: "Neighborhood Extension — small image",
    width: 627,
    height: 627,
    ratio: "1:1",
    mediaType: "static",
  },
  {
    id: "nextdoor-logo",
    platform: "nextdoor",
    placement: "Logo (all formats)",
    width: 100,
    height: 100,
    ratio: "1:1",
    mediaType: "static",
  },

  // ── Scrolling Marquee (Ticker-Style Ad) ────────────────────
  {
    id: "marquee-website-header-footer",
    platform: "marquee",
    placement: "Website header/footer ticker",
    width: 728,
    height: 90,
    ratio: "8.09:1",
    mediaType: "html5",
    otherNotes: "Or full-width x 60–90. Matches leaderboard slot; scrolling text/logo strip loops continuously.",
  },
  {
    id: "marquee-sidebar",
    platform: "marquee",
    placement: "Sidebar ticker",
    width: 300,
    height: 250,
    ratio: "1.2:1",
    mediaType: "html5",
    otherNotes: "Or 160x600. Vertical marquee (scroll bottom-to-top) fits skyscraper slot.",
  },
  {
    id: "marquee-stream-obs-overlay",
    platform: "marquee",
    placement: "Stream/OBS overlay bar",
    width: 1920,
    height: 100,
    ratio: "19.2:1",
    mediaType: "html5",
    otherNotes: "Height ranges 80–120px, full stream width. Sits along bottom third of a 1920x1080 canvas.",
  },
  {
    id: "marquee-mobile-sticky",
    platform: "marquee",
    placement: "Mobile sticky ticker",
    width: 320,
    height: 50,
    ratio: "6.4:1",
    mediaType: "html5",
    otherNotes: "Matches mobile banner slot.",
  },
];

export function getFormatsByPlatform(platform: Platform): AdFormatSpec[] {
  return FORMAT_CATALOG.filter((f) => f.platform === platform);
}

export function getFormatById(id: string): AdFormatSpec | undefined {
  return FORMAT_CATALOG.find((f) => f.id === id);
}
