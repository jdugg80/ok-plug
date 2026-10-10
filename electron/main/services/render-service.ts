/**
 * Render Service
 * Generates pixel-perfect PNG images from AdDesignResult using Puppeteer.
 * Builds an HTML document matching the AdCanvas CSS layout, renders at
 * 2x resolution for retina quality.
 */

import type { AdFormatSpec } from "../../shared/format-catalog";
import type { AdDesignResult } from "./ai-ad-design-service";
import type { FontChoice } from "../../shared/types";

// Keep browser alive across renders to avoid relaunch overhead
let browserInstance: any = null;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  // Dynamic import required — puppeteer is ESM-only but we compile to CJS
  const puppeteer = (await import("puppeteer")).default;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });
  return browserInstance;
}

/**
 * Resolve a font family string based on the brand's font choices.
 * Maps element roles (headline, subhead, cta) to the appropriate font.
 */
function resolveFontFamily(
  role: "headline" | "subhead" | "cta",
  fonts?: FontChoice[]
): string {
  if (!fonts || fonts.length === 0) return "Arial, Helvetica, sans-serif";

  const roleMap: Record<string, FontChoice["role"][]> = {
    headline: ["display", "heading"],
    subhead: ["heading", "body"],
    cta: ["body", "caption"],
  };

  const preferredRoles = roleMap[role];
  for (const preferredRole of preferredRoles) {
    const match = fonts.find((f) => f.role === preferredRole);
    if (match) {
      const fallback = match.fallback || "Arial";
      return `'${match.family}', '${fallback}', sans-serif`;
    }
  }

  // Fallback: use first font
  if (fonts.length > 0) {
    const fallback = fonts[0].fallback || "Arial";
    return `'${fonts[0].family}', '${fallback}', sans-serif`;
  }

  return "Arial, Helvetica, sans-serif";
}

/**
 * Build Google Fonts link tags for fonts with source "google".
 */
function buildGoogleFontLinks(fonts?: FontChoice[]): string {
  if (!fonts || fonts.length === 0) return "";

  const googleFonts = fonts.filter((f) => f.source === "google");
  if (googleFonts.length === 0) return "";

  const families = googleFonts
    .map((f) => {
      const weightParam = f.role === "display" || f.role === "heading"
        ? ":wght@400;600;700;800"
        : ":wght@400;600";
      return `family=${f.family.replace(/\s+/g, "+")}${weightParam}`;
    })
    .join("&");

  return `<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

/**
 * Build @font-face CSS for uploaded fonts.
 * Reads the font file from disk and base64-encodes it for reliable loading.
 */
async function buildUploadedFontFaces(fonts?: FontChoice[]): Promise<string> {
  if (!fonts || fonts.length === 0) return "";

  const uploadedFonts = fonts.filter((f) => f.source === "uploaded" && f.id);
  if (uploadedFonts.length === 0) return "";

  const { promises: fs } = await import("fs");
  const path = await import("path");

  let css = "";
  for (const font of uploadedFonts) {
    try {
      // Look for font file in the project's source/fonts directory
      // The font ID is used as the filename stem; try common extensions
      const fontDir = path.join(process.cwd(), "source", "fonts");
      const extensions = [".ttf", ".otf", ".woff2", ".woff"];
      let fontBuffer: Buffer | null = null;
      let mimeType = "font/ttf";

      for (const ext of extensions) {
        try {
          const filePath = path.join(fontDir, `${font.id}${ext}`);
          fontBuffer = await fs.readFile(filePath);
          if (ext === ".otf") mimeType = "font/otf";
          else if (ext === ".woff2") mimeType = "font/woff2";
          else if (ext === ".woff") mimeType = "font/woff";
          break;
        } catch {
          // Try next extension
        }
      }

      if (fontBuffer) {
        const base64 = fontBuffer.toString("base64");
        const weight = font.role === "display" || font.role === "heading" ? "700" : "400";
        css += `
        @font-face {
          font-family: '${font.family}';
          src: url(data:${mimeType};base64,${base64}) format('${mimeType.replace("font/", "")}');
          font-weight: ${weight};
          font-style: normal;
          font-display: swap;
        }`;
      }
    } catch {
      // Font file not found — skip, will fall back to system font
    }
  }

  return css;
}

/**
 * Build the full HTML document for rendering.
 */
async function buildRenderHtml(
  design: AdDesignResult,
  formatSpec: AdFormatSpec,
  fonts?: FontChoice[]
): Promise<string> {
  const googleLinks = buildGoogleFontLinks(fonts);
  const uploadedFaces = await buildUploadedFontFaces(fonts);

  const headlineFont = resolveFontFamily("headline", fonts);
  const subheadFont = resolveFontFamily("subhead", fonts);
  const ctaFont = resolveFontFamily("cta", fonts);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${googleLinks}
  <style>
    ${uploadedFaces}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: ${formatSpec.width}px;
      height: ${formatSpec.height}px;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .canvas {
      width: 100%;
      height: 100%;
      position: relative;
      background: ${design.backgroundGradient || design.backgroundColor};
      color: ${design.textColor};
      overflow: hidden;
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: ${design.overlayColor};
      pointer-events: none;
    }

    .headline {
      position: absolute;
      transform: translate(-50%, -50%);
      left: ${design.headlinePosition.x * 100}%;
      top: ${design.headlinePosition.y * 100}%;
      font-family: ${headlineFont};
      font-size: ${design.headlineSize}px;
      font-weight: ${design.headlineWeight};
      color: ${design.textColor};
      text-align: center;
      line-height: 1.1;
      max-width: 90%;
      z-index: 10;
      letter-spacing: -0.02em;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .subhead {
      position: absolute;
      transform: translate(-50%, -50%);
      left: ${design.subheadPosition.x * 100}%;
      top: ${design.subheadPosition.y * 100}%;
      font-family: ${subheadFont};
      font-size: ${design.subheadSize}px;
      font-weight: 400;
      color: ${design.textColor};
      text-align: center;
      line-height: 1.4;
      max-width: 80%;
      z-index: 10;
      opacity: 0.9;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }

    .cta {
      position: absolute;
      transform: translate(-50%, -50%);
      left: ${design.ctaPosition.x * 100}%;
      top: ${design.ctaPosition.y * 100}%;
      font-family: ${ctaFont};
      font-size: ${design.ctaSize}px;
      font-weight: 600;
      color: #ffffff;
      background-color: ${design.accentColor};
      padding: 10px 24px;
      border-radius: 6px;
      text-align: center;
      z-index: 10;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }

    .logo {
      position: absolute;
      transform: translate(-50%, -50%);
      left: ${design.logoPosition.x * 100}%;
      top: ${design.logoPosition.y * 100}%;
      z-index: 10;
    }

    .logo-placeholder {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border: 1px solid ${design.textColor}40;
      border-radius: 4px;
      color: ${design.textColor};
      opacity: 0.6;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="overlay"></div>
    <div class="headline">${escapeHtml(design.headline)}</div>
    ${design.subhead ? `<div class="subhead">${escapeHtml(design.subhead)}</div>` : ""}
    <div class="cta">${escapeHtml(design.cta)}</div>
    <div class="logo">
      <div class="logo-placeholder">LOGO</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent injection.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render an ad design to a PNG buffer using Puppeteer.
 *
 * @param design - The AI-generated ad design
 * @param formatSpec - The target format dimensions
 * @param fonts - Optional brand font choices for font resolution
 * @param scale - Device scale factor. Defaults to 2 (retina preview).
 *               Pass 1 for export so the PNG is exactly width x height pixels.
 * @returns PNG image buffer at the requested scale
 */
export async function renderAdToPng(
  design: AdDesignResult,
  formatSpec: AdFormatSpec,
  fonts?: FontChoice[],
  scale: number = 2
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set viewport to exact format dimensions at the requested scale
    await page.setViewport({
      width: formatSpec.width,
      height: formatSpec.height,
      deviceScaleFactor: scale,
    });

    // Build and set HTML content
    const html = await buildRenderHtml(design, formatSpec, fonts);
    await page.setContent(html, { waitUntil: "load" });

    // Wait a moment for fonts to load
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Screenshot at the exact dimensions
    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: formatSpec.width,
        height: formatSpec.height,
      },
    });

    return screenshotBuffer as Buffer;
  } finally {
    await page.close();
  }
}

/**
 * Clean up the browser instance on app quit.
 */
export async function shutdownRenderService(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
