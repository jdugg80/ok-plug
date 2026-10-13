import type { AdFormatSpec } from "../../shared/format-catalog";
import type { BrandKit } from "../../shared/types";
import { getActiveProvider } from "./ai-provider";

export interface GenerateTextInput {
  formatSpec: AdFormatSpec;
  brandKit: BrandKit;
  keywords: string[];
  phrases: string[];
  toneOverride?: string;
}

export interface GeneratedCopy {
  headlines: string[];
  subheads: string[];
  ctas: string[];
}

/**
 * Generate ad copy (headlines, subheads, CTAs) for a single format
 * using the Anthropic API. Returns structured copy options.
 */
export async function generateAdCopy(
  input: GenerateTextInput
): Promise<GeneratedCopy> {
  const provider = await getActiveProvider();

  const { formatSpec, brandKit, keywords, phrases, toneOverride } = input;

  const tone =
    toneOverride ||
    brandKit.toneTags.join(", ") ||
    "professional, engaging";

  const vibeContext =
    brandKit.vibeTags.length > 0
      ? `Brand vibe: ${brandKit.vibeTags.join(", ")}`
      : "";

  const colorContext =
    brandKit.colors.length > 0
      ? `Brand colors: ${brandKit.colors.map((c: { hex: string }) => c.hex).join(", ")}`
      : "";

  // Brand Kit v2: allowed/preferred copy only. Contact details and fine print
  // deliberately never appear here - they belong in the design prompt.
  const taglinesContext =
    (brandKit.taglines ?? []).length > 0
      ? `Taglines (may be used verbatim):\n${(brandKit.taglines ?? []).map((t) => `- ${t}`).join("\n")}`
      : "";

  const headlinesContext =
    (brandKit.approvedHeadlines ?? []).length > 0
      ? `Approved headlines (prefer these verbatim):\n${(brandKit.approvedHeadlines ?? []).map((h) => `- ${h}`).join("\n")}`
      : "";

  const prompt = `You are an expert ad copywriter for ${brandKit.businessName}.

Generate ad copy for a ${formatSpec.width}×${formatSpec.height} (${formatSpec.ratio}) ${formatSpec.platform} ${formatSpec.placement} ad.

Tone: ${tone}
${vibeContext}
${colorContext}
${taglinesContext}
${headlinesContext}

Keywords: ${keywords.join(", ") || "none provided"}
Phrases to consider: ${phrases.length > 0 ? phrases.join("; ") : "none provided"}

Generate exactly 3 options for each category. Return ONLY valid JSON, no markdown:

{
  "headlines": ["headline 1", "headline 2", "headline 3"],
  "subheads": ["subhead 1", "subhead 2", "subhead 3"],
  "ctas": ["CTA 1", "CTA 2", "CTA 3"]
}

Rules:
- Headlines: short, punchy, 3-8 words
- Subheads: 1-2 sentences, expand on the headline
- CTAs: action-oriented, 2-5 words (e.g. "Shop Now", "Learn More", "Get Started")
- All text must fit within ${formatSpec.width}×${formatSpec.height} pixels
- Match the ${tone} tone throughout
- Reference the business name naturally where it fits`;

  const text = await provider.generateText(prompt, 512);

  // Extract JSON from response (handle markdown code blocks if present)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI returned invalid response format");
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedCopy;

  // Validate structure
  if (!Array.isArray(parsed.headlines) || !Array.isArray(parsed.ctas)) {
    throw new Error("AI response missing required fields");
  }

  return {
    headlines: parsed.headlines.slice(0, 3),
    subheads: (parsed.subheads || []).slice(0, 3),
    ctas: parsed.ctas.slice(0, 3),
  };
}
