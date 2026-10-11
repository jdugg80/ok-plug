/**
 * AI Ad Design Service
 * Generates complete ad designs with professional styling.
 */

import type { AdFormatSpec } from "../../shared/format-catalog";
import type { BrandKit, BrandColor, FontChoice, CustomAdFormatSpec } from "../../shared/types";
import { getActiveProvider } from "./ai-provider";

export interface AdDesignInput {
  formatSpec: AdFormatSpec | CustomAdFormatSpec;
  brandKit: BrandKit;
  keywords: string[];
  callToAction?: string;
  requiredDisclaimers?: string;
  adDirection?: string;
}

export interface AdDesignResult {
  // Copy
  headline: string;
  subhead: string;
  cta: string;

  // Colors (hex)
  backgroundColor: string;
  backgroundGradient: string; // CSS gradient
  textColor: string;
  accentColor: string;
  overlayColor: string; // For text readability over images

  // Typography
  headlineFont: string;
  headlineSize: number;
  headlineWeight: number;
  subheadFont: string;
  subheadSize: number;
  ctaFont: string;
  ctaSize: number;

  // Layout (percentages 0-1)
  headlinePosition: { x: number; y: number };
  subheadPosition: { x: number; y: number };
  ctaPosition: { x: number; y: number };
  logoPosition: { x: number; y: number };
  imagePosition: { x: number; y: number; width: number; height: number };

  // Image search
  imageSearchQuery: string;
}

/**
 * Generate a complete ad design using AI.
 * Returns copy, layout, colors, typography, and image search query.
 */
export async function generateAdDesign(
  input: AdDesignInput
): Promise<AdDesignResult> {
  const provider = await getActiveProvider();
  const { formatSpec, brandKit, keywords, callToAction, requiredDisclaimers, adDirection } = input;

  // Build brand context
  const colorsList = brandKit.colors
    .map((c: BrandColor) => `${c.hex} (${c.role}${c.label ? ": " + c.label : ""})`)
    .join(", ");

  const fontsList = brandKit.fonts
    .map((f: FontChoice) => `${f.family} (${f.role})`)
    .join(", ");

  const tone = brandKit.toneTags.join(", ") || "professional, trustworthy";
  const vibe = brandKit.vibeTags.join(", ") || "clean, modern";

  const briefLines = [
    callToAction ? `CALL TO ACTION: ${callToAction}` : null,
    requiredDisclaimers ? `REQUIRED DISCLAIMERS (include in the design): ${requiredDisclaimers}` : null,
    adDirection ? `AD DIRECTION: ${adDirection}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const prompt = `You are a professional ad designer creating Facebook/Instagram ads.

Generate a COMPLETE ad design for a ${formatSpec.width}×${formatSpec.height} ${formatSpec.platform} ${formatSpec.placement} ad.

BRAND: ${brandKit.businessName}
TONE: ${tone}
VIBE: ${vibe}
KEYWORDS: ${keywords.join(", ") || "none"}
AVAILABLE COLORS: ${colorsList || "Use professional defaults"}
AVAILABLE FONTS: ${fontsList || "Use Arial, Helvetica"}
${briefLines ? briefLines + "\n" : ""}
DESIGN RULES (CRITICAL - FOLLOW EXACTLY):

1. COLORS - Use these EXACT patterns:
   - backgroundGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" (dark blue professional)
   - OR if brand has colors: "linear-gradient(135deg, {primary} 0%, {darker} 100%)"
   - textColor: "#ffffff" (white on dark) OR "#1a1a1a" (dark on light)
   - accentColor: Use the brand's PRIMARY color (must be vibrant, not dark)
   - overlayColor: "rgba(0,0,0,0.4)" for dark overlay, "rgba(255,255,255,0.1)" for light

2. TYPOGRAPHY - Use these EXACT values:
   - headlineSize: 42-56 (large, bold)
   - headlineWeight: 800 (very bold)
   - subheadSize: 18-24 (readable)
   - ctaSize: 16-20 (button text)

3. LAYOUT - Position elements like this:
   - headlinePosition: { "x": 0.5, "y": 0.25 } (top-center)
   - subheadPosition: { "x": 0.5, "y": 0.4 } (below headline)
   - ctaPosition: { "x": 0.5, "y": 0.82 } (bottom-center, easy to tap)
   - logoPosition: { "x": 0.12, "y": 0.92 } (bottom-left corner)
   - imagePosition: { "x": 0.5, "y": 0.45, "width": 1.0, "height": 1.0 } (full bleed)

4. IMAGERY - Search query should be:
   - Professional, relevant to the business
   - Example: "modern office", "happy customers", "professional service"
   - NOT abstract, NOT random

OUTPUT THIS EXACT JSON (no markdown, no code blocks):

{
  "headline": "Strong headline, 3-6 words, action-oriented",
  "subhead": "1 sentence expanding on headline, 10-15 words",
  "cta": "Shop Now" or "Learn More" or "Get Started",
  
  "backgroundColor": "#1a1a2e",
  "backgroundGradient": "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  "textColor": "#ffffff",
  "accentColor": "#e94560",
  "overlayColor": "rgba(0,0,0,0.4)",
  
  "headlineFont": "Arial",
  "headlineSize": 48,
  "headlineWeight": 800,
  "subheadFont": "Arial",
  "subheadSize": 20,
  "ctaFont": "Arial",
  "ctaSize": 18,
  
  "headlinePosition": { "x": 0.5, "y": 0.25 },
  "subheadPosition": { "x": 0.5, "y": 0.4 },
  "ctaPosition": { "x": 0.5, "y": 0.82 },
  "logoPosition": { "x": 0.12, "y": 0.92 },
  "imagePosition": { "x": 0.5, "y": 0.45, "width": 1.0, "height": 1.0 },
  
  "imageSearchQuery": "professional business service"
}

IMPORTANT:
- accentColor MUST be vibrant (red, orange, blue, purple) - NOT dark, NOT neon
- backgroundGradient MUST be a valid CSS linear-gradient
- All positions are 0.0 to 1.0 (percentages of canvas)
- Headline MUST be big and bold (48px, weight 800)
- CTA MUST have background color (accentColor) with white text`;

  const text = await provider.generateText(prompt, 1024);

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned invalid response format");
  }

  const parsed = JSON.parse(jsonMatch[0]) as AdDesignResult;

  // Validate required fields
  if (!parsed.headline || !parsed.cta) {
    throw new Error("AI response missing required fields");
  }

  // Ensure positions are valid
  const clamp = (v: number) => Math.max(0, Math.min(1, v || 0.5));
  parsed.headlinePosition = { x: clamp(parsed.headlinePosition?.x), y: clamp(parsed.headlinePosition?.y) };
  parsed.subheadPosition = { x: clamp(parsed.subheadPosition?.x), y: clamp(parsed.subheadPosition?.y) };
  parsed.ctaPosition = { x: clamp(parsed.ctaPosition?.x), y: clamp(parsed.ctaPosition?.y) };
  parsed.logoPosition = { x: clamp(parsed.logoPosition?.x), y: clamp(parsed.logoPosition?.y) };
  parsed.imagePosition = {
    x: clamp(parsed.imagePosition?.x),
    y: clamp(parsed.imagePosition?.y),
    width: Math.max(0.1, Math.min(1, parsed.imagePosition?.width || 1.0)),
    height: Math.max(0.1, Math.min(1, parsed.imagePosition?.height || 1.0)),
  };

  // Validate and fix colors
  parsed.backgroundColor = parsed.backgroundColor || "#1a1a2e";
  parsed.backgroundGradient = parsed.backgroundGradient || `linear-gradient(135deg, ${parsed.backgroundColor} 0%, ${darkenColor(parsed.backgroundColor, 20)} 100%)`;
  parsed.textColor = parsed.textColor || "#ffffff";
  parsed.accentColor = ensureVibrant(parsed.accentColor || "#e94560");
  parsed.overlayColor = parsed.overlayColor || "rgba(0,0,0,0.4)";

  // Validate typography
  parsed.headlineSize = Math.max(32, Math.min(72, parsed.headlineSize || 48));
  parsed.headlineWeight = parsed.headlineWeight || 800;
  parsed.subheadSize = Math.max(14, Math.min(28, parsed.subheadSize || 20));
  parsed.ctaSize = Math.max(12, Math.min(24, parsed.ctaSize || 18));

  return parsed;
}

/**
 * Darken a hex color by a percentage.
 */
function darkenColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - Math.round(255 * percent / 100));
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - Math.round(255 * percent / 100));
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - Math.round(255 * percent / 100));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Ensure a color is vibrant (not too dark or too light).
 */
function ensureVibrant(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  
  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // If too dark, make it lighter
  if (brightness < 80) {
    return "#e94560"; // Fallback vibrant red
  }
  
  // If too desaturated (gray), add color
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
  
  if (saturation < 30) {
    return "#3b82f6"; // Fallback vibrant blue
  }
  
  return hex;
}
