/**
 * Render Service
 * Generates pixel-perfect PNG images from AdDesignResult using Puppeteer.
 * Builds an HTML document matching the AdCanvas CSS layout, renders at
 * 2x resolution for retina quality.
 *
 * Electron-free on purpose: this module only needs puppeteer, fs and path, so
 * a plain Node script can require the compiled output and render a PNG.
 */

import type { AdFormatSpec } from "../../shared/format-catalog";
import type { AdDesignResult } from "./ai-ad-design-service";
import type { FontChoice } from "../../shared/types";
import {
  assembleContactParts,
  assembleFinePrint,
  getSafeInsets,
  isCompactCanvas,
  resolveFontStack,
  type RenderBrand,
} from "../../shared/brand-render";

export type { RenderBrand };

// Keep browser alive across renders to avoid relaunch overhead
let browserInstance: any = null;

/** How long to wait for the in-page layout pass to publish __vfLayout. */
const LAYOUT_TIMEOUT_MS = 5000;

async function getBrowser(): Promise<any> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<{ default: any }>;
  const puppeteer = (await dynamicImport("puppeteer")).default;
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
 * Delegates to the shared resolver so the PNG and the React preview agree.
 */
function resolveFontFamily(
  role: "headline" | "subhead" | "cta" | "body",
  fonts?: FontChoice[]
): string {
  return resolveFontStack(role, fonts);
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

/** Clamp the footer base font: 11px floor, 28px ceiling, 1.6% of min(w,h). */
function footerBaseFont(width: number, height: number): number {
  // Requirement 2: one shared base font for fine print + contact (~1.6% of the
  // short edge, ~17px on a 1080 edge). Only canvases BELOW 600 reduce it (the
  // in-page script steps down to a floor of ~1.1%).
  return Math.max(11, Math.min(28, 0.016 * Math.min(width, height)));
}

/**
 * Build the full HTML document for rendering, including the brand footer strip
 * and the in-page auto-fit / CTA-collision script.
 * Exported so callers (and throwaway proofs) can assert on the emitted markup
 * without launching a browser.
 */
export async function buildRenderHtml(
  design: AdDesignResult,
  formatSpec: AdFormatSpec,
  fonts: FontChoice[] | undefined,
  brand: RenderBrand | undefined
): Promise<string> {
  const googleLinks = buildGoogleFontLinks(fonts);
  const uploadedFaces = await buildUploadedFontFaces(fonts);

  const headlineFont = resolveFontFamily("headline", fonts);
  const subheadFont = resolveFontFamily("subhead", fonts);
  const ctaFont = resolveFontFamily("cta", fonts);
  // A5: the brand footer uses the brand's body stack, not the browser default.
  const bodyFont = resolveFontFamily("body", fonts);

  const width = formatSpec.width;
  const height = formatSpec.height;
  const insets = getSafeInsets(formatSpec);
  const compact = isCompactCanvas(width, height);

  const fineLines = assembleFinePrint(brand);
  const contactParts = assembleContactParts(brand);
  const hasFooter = fineLines.length > 0 || contactParts.length > 0;
  const hasLogo = Boolean(brand?.logoDataUri);

  // Logo box: never wider than 12% of the canvas, never taller than 18%.
  const logoMaxWidth = Math.round(width * 0.12);
  const logoMaxHeight = Math.round(height * 0.18);
  const compactLogoMaxHeight = Math.round(height * 0.7);

  // A1: contact parts are handed to the in-page script as data keyed by field
  // name. The script renders the line itself so a dropped part can never leave
  // a dangling " · " at either end.
  const contactData = contactParts.map((p) => ({ name: p.name, text: p.text }));

  const fineHtml = fineLines.map((l) => escapeHtml(l)).join("<br>");

  // In compact mode the logo rides in the footer row instead of at logoPosition.
  const logoInFooter = compact && hasLogo;
  const logoImgHtml = hasLogo
    ? `<img id="logoImg" src="${escapeHtml(brand!.logoDataUri!)}" alt="">`
    : "";

  const absoluteLogoHtml =
    hasLogo && !compact
      ? `<div class="logo" id="logo" style="left:${design.logoPosition.x * 100}%;top:${
          design.logoPosition.y * 100
        }%">${logoImgHtml}</div>`
      : "";

  const footerHtml = hasFooter || logoInFooter
    ? `<div class="footer${compact ? " compact" : ""}" id="footer">
      <div class="f-left" id="fine">${
        logoInFooter ? logoImgHtml : ""
      }<span id="fineText">${fineHtml}</span></div>
      <div class="f-right" id="contact"></div>
    </div>`
    : "";

  const layoutConfig = JSON.stringify({
    width,
    height,
    compact,
    hasFooter,
    hasLogo,
    logoInFooter,
    baseFont: Math.round(footerBaseFont(width, height)),
    // Requirement 3: floors scale with the canvas (~12px on a 1080 edge).
    floorFine: Math.max(9, Math.round(0.011 * Math.min(width, height))),
    floorContact: Math.max(9, Math.round(0.011 * Math.min(width, height))),
    // Requirement 3: fine print may use up to 4 lines on big canvases.
    maxFineLines: Math.min(width, height) >= 600 ? 4 : 2,
    // Requirement 1: never omit the whole footer on big canvases.
    bigCanvas: Math.min(width, height) >= 600,
    // Requirement 3: the lines themselves, so truncation can preserve <br>.
    fineLines: fineLines,
    hasContact: contactParts.length > 0,
    ctaGap: Math.max(4, Math.round(height * 0.02)),
    logoGap: Math.max(3, Math.round(height * 0.012)),
    compactLogoMaxHeight,
    logoMaxWidth,
    logoMaxHeight,
    // A3/A4: every geometric clamp works against these safe-zone fractions.
    insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
    // A1: drop order for contact parts, by field name.
    contact: contactData,
    dropOrder: ["email", "address", "phone", "website"],
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${googleLinks}
  <style>
    ${uploadedFaces}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: ${width}px;
      height: ${height}px;
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
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo img {
      max-width: ${logoMaxWidth}px;
      max-height: ${logoMaxHeight}px;
      width: auto;
      height: auto;
      object-fit: contain;
    }

    .footer {
      position: absolute;
      left: ${insets.left * 100}%;
      right: ${insets.right * 100}%;
      bottom: ${insets.bottom * 100}%;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      z-index: 10;
      color: ${design.textColor};
      opacity: 0.88;
      font-family: ${bodyFont};
    }

    .footer.compact {
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .f-left {
      flex: 1 1 auto;
      min-width: 0;
      text-align: left;
      line-height: 1.25;
      /* Requirement 4: leave room for the contact line. Cap the fine-print
         column at 60% of the footer whenever contact parts exist; without
         contact it may use the full width. */
      max-width: ${contactParts.length > 0 ? "60%" : "100%"};
      /* Requirement 3: room for maxFineLines lines (2 or 4). */
      max-height: ${(Math.min(width, height) >= 600 ? 4 : 2) * 1.25 + 0.1}em;
      overflow: hidden;
    }

    .footer.compact .f-left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px 6px;
      max-height: none;
      overflow: visible;
    }

    .footer.compact .f-left img {
      max-height: ${compactLogoMaxHeight}px;
      max-width: 70%;
      width: auto;
      height: auto;
      object-fit: contain;
      flex: 0 0 auto;
    }

    .f-right {
      flex: 0 1 auto;
      min-width: 0;
      text-align: right;
      line-height: 1.25;
    }

    .f-right .part {
      /* Big canvases: parts may WRAP so the 2-line cap governs (drop by
         order). Everywhere else the part stays atomic so the classic
         shrink-then-drop-by-width pass keeps working on one line. */
      white-space: ${Math.min(width, height) >= 600 ? "normal" : "nowrap"};
    }

    .f-right .unit { white-space: nowrap; }

    .f-right .sep { opacity: 0.55; }
  </style>
</head>
<body>
  <div class="canvas" id="canvas">
    <div class="overlay"></div>
    <div class="headline" id="headline">${escapeHtml(design.headline)}</div>
    ${
      design.subhead
        ? `<div class="subhead" id="subhead">${escapeHtml(design.subhead)}</div>`
        : ""
    }
    <div class="cta" id="cta">${escapeHtml(design.cta)}</div>
    ${absoluteLogoHtml}
    ${footerHtml}
  </div>
  <script>
    window.__vfLayout = null;
    (function () {
    function runLayout() {
      var cfg = ${layoutConfig};
      var out = { warnings: [], ctaMoved: false, logoMoved: false, fontSizeUsed: cfg.baseFont };

      var footer  = document.getElementById("footer");
      var fine    = document.getElementById("fine");
      var fineText= document.getElementById("fineText");
      var contact = document.getElementById("contact");
      var cta     = document.getElementById("cta");
      var logo    = document.getElementById("logo");
      // The <img> exists in BOTH modes (non-compact: inside #logo;
      // compact: inline in the footer row). Measure it either way.
      var logoImg = document.getElementById("logoImg");
      var headline= document.getElementById("headline");
      var subhead = document.getElementById("subhead");

      var ELLIPSIS = "\\u2026";

      function esc(s) {
        return String(s)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function rect(el) { return el ? el.getBoundingClientRect() : null; }
      function overlaps(a, b) {
        return !!(a && b && a.bottom > b.top && a.top < b.bottom &&
                        a.right  > b.left && a.left < b.right);
      }
      function isVisible(el) { return !!el && el.style.display !== "none"; }
      function setCenterY(el, centerY) {
        el.style.top = (centerY / cfg.height * 100) + "%";
      }
      // Move an element's centre x/y so its box stays inside the safe zone.
      function clampToSafeZone(el) {
        if (!el) return;
        var r = el.getBoundingClientRect();
        var halfW = r.width / 2, halfH = r.height / 2;
        var left   = cfg.insets.left   * cfg.width;
        var right  = cfg.width  - cfg.insets.right  * cfg.width;
        var top    = cfg.insets.top    * cfg.height;
        var bottom = cfg.height - cfg.insets.bottom * cfg.height;
        var cx = Math.min(Math.max(r.left + halfW, left + halfW), right - halfW);
        var cy = Math.min(Math.max(r.top  + halfH, top  + halfH), bottom - halfH);
        el.style.left = (cx / cfg.width  * 100) + "%";
        setCenterY(el, cy);
      }

      // ── A1: rebuild the contact line from data, keyed by field name. ──
      var fineLinesArr = Array.isArray(cfg.fineLines) ? cfg.fineLines : [];
      var contactParts = Array.isArray(cfg.contact) ? cfg.contact : [];
      var dropped = {};
      // Every part dropped by EITHER pass (step 1 and step 8) lands here, so a
      // single "contact dropped: ..." warning is emitted at the end no matter
      // which pass did the dropping.
      var allDroppedNames = [];
      function renderContact() {
        if (!contact) return;
        var visible = contactParts.filter(function (p) { return !dropped[p.name]; });
        // Wrap-safe join (req 2): a normal space OUTSIDE the nowrap .unit is
        // the only soft-wrap point. The "·" is glued to the FOLLOWING part
        // inside that unit, so a rendered line can never END with a separator.
        // The leading space collapses at a line start, so a wrapped line
        // begins with "· part" (never ends with it). The first part stands
        // alone, so the line also never starts with a separator.
        var html = "";
        for (var ui = 0; ui < visible.length; ui++) {
          var p = visible[ui];
          var partSpan = '<span class="part" data-part="' + p.name + '">' + esc(p.text) + "</span>";
          if (ui === 0) {
            html += partSpan;
          } else {
            html += ' <span class="unit"><span class="sep">·</span> ' + partSpan + "</span>";
          }
        }
        contact.innerHTML = html;
        applyContactWrap();
      }
      // Requirement 2: on big canvases the contact line may wrap to 2 lines
      // instead of shrinking/clipping. On compact canvases it stays one line
      // (the script then shrinks or drops by width).
      function applyContactWrap() {
        if (contact) contact.style.whiteSpace = cfg.bigCanvas ? "normal" : "nowrap";
      }
      applyContactWrap();
      // Initial population: render every part before any fit/drop logic runs.
      // Without this the line stays empty and contactFits() sees no content.
      renderContact();

      // The height of one contact line box: line-height x font size (read from
      // the live computed style so it tracks the .f-right line-height: 1.25).
      function contactLineBox() {
        var cs = window.getComputedStyle(contact);
        var fs = parseFloat(cs.fontSize) || cfg.baseFont;
        var lh = parseFloat(cs.lineHeight);
        if (!lh || cs.lineHeight === "normal") return fs * 1.25;
        return lh < 10 ? lh * fs : lh;
      }
      // How many rendered lines the contact line currently occupies.
      function contactLineCount() {
        if (!contact) return 0;
        var box = contactLineBox();
        if (!box) return 1;
        return Math.ceil(contact.getBoundingClientRect().height / box - 0.1);
      }
      // Requirement 1: real overflow signal. Compact canvases must fit on one
      // line (horizontal scroll). Big canvases may WRAP, but the wrap is
      // capped at 2 lines - measured from rendered height / line box, never a
      // tautological rect-vs-clientHeight comparison.
      var CONTACT_MAX_LINES = 2;
      function contactWidthOverflow() {
        if (!contact) return false;
        if (!cfg.bigCanvas) return contact.scrollWidth > contact.clientWidth + 1;
        return contactLineCount() > CONTACT_MAX_LINES;
      }
      // Any .part whose box pokes outside the contact container's box.
      function clippedPart() {
        if (!contact) return null;
        var cr = rect(contact);
        if (!cr) return null;
        var els = contact.querySelectorAll(".part");
        for (var ci = 0; ci < els.length; ci++) {
          var pr = rect(els[ci]);
          if (!pr || pr.width === 0 || pr.height === 0) continue;
          if (pr.top < cr.top - 0.5 || pr.bottom > cr.bottom + 0.5 ||
              pr.left < cr.left - 0.5 || pr.right > cr.right + 0.5) {
            return els[ci].getAttribute("data-part");
          }
        }
        return null;
      }
      // Requirement 1: "clipped" = width overflow OR a part box outside the
      // container box.
      function contactClipped() { return contactWidthOverflow() || !!clippedPart(); }
      function contactFits() { return !contactClipped(); }
      // Requirement 1: fine print is clipped when its content exceeds the
      // client box (overflow:hidden). Measure the CONTAINER (#fine), not the
      // inline #fineText span - an inline element reports scrollHeight=0, so
      // measuring it can never detect the overflow that max-height clips.
      function fineFits() {
        if (!fine || !fineText) return true;
        return fine.scrollHeight <= fine.clientHeight + 1 &&
               fine.scrollWidth <= fine.clientWidth + 1;
      }
      // Requirement 3: fine print and contact get SEPARATE font sizes, so a
      // fine-print overflow can never shrink (starve) the contact line.
      function setContactFont(px) {
        if (contact) contact.style.fontSize = px + "px";
      }
      function setFineFont(px) {
        if (fine) fine.style.fontSize = px + "px";
      }
      function hideFinePrint() {
        if (fineText) fineText.textContent = "";
        // In compact mode the logo <img> rides INSIDE #fine. Hide only the
        // text so the logo survives; hide the whole strip only when it is
        // holding nothing else.
        if (fine) {
          var hasLogoInFine = cfg.logoInFooter && !!fine.querySelector("img");
          fine.style.display = hasLogoInFine ? "" : "none";
        }
      }

      // ── Requirement 3: fine print renders from LINES, and truncation keeps
      //    the <br> separators so lines can never run together. The ellipsis
      //    is appended only after a whole word. ──
      function wordBoundaryPrefix(full, keep) {
        if (keep >= full.length) return full;
        var cut = full.slice(0, keep);
        // Cut mid-word: drop the trailing partial word.
        if (!/\\s/.test(full.charAt(keep))) {
          cut = cut.replace(/\\s+\\S*$/, "");
        }
        return cut.replace(/[\\s\\u00b7]+$/, "");
      }
      function finePartsFor(keepChars) {
        var parts = [], used = 0;
        for (var li = 0; li < fineLinesArr.length; li++) {
          if (parts.length >= cfg.maxFineLines) break;
          var line = fineLinesArr[li];
          if (used + line.length <= keepChars) {
            parts.push(esc(line));
            used += line.length;
          } else {
            var remain = keepChars - used;
            if (remain > 0) parts.push(esc(wordBoundaryPrefix(line, remain)));
            break;
          }
        }
        return parts;
      }
      function totalFineChars() {
        var t = 0;
        for (var li = 0; li < fineLinesArr.length; li++) t += fineLinesArr[li].length;
        return t;
      }
      function setFineHtml(parts, ellipsis) {
        if (!fineText) return;
        if (ellipsis && parts.length > 0) {
          parts = parts.slice();
          parts[parts.length - 1] = parts[parts.length - 1] + ELLIPSIS;
        }
        fineText.innerHTML = parts.join("<br>");
      }
      // Initial render, already capped to maxFineLines.
      setFineHtml(finePartsFor(totalFineChars()), false);

      if (footer) {
        // 1. Contact: shrink its own font to the floor, then drop parts by
        //    FIELD NAME in the fixed order until the line fits.
        var cfs = cfg.baseFont;
        setContactFont(cfs);
        var g = 0;
        while (cfs > cfg.floorContact && !contactFits() && g++ < 60) {
          cfs -= 1;
          setContactFont(cfs);
        }
        out.contactFontSizeUsed = cfs;
        // Proof hooks (step verification): line count the moment the drop loop
        // starts (after the shrink loop bottomed out at the floor), and whether
        // any part was geometrically clipped. null + lineCount > 2 proves the
        // drop loop is driven by the LINE CAP with the fixed drop order, not
        // by a clipped part.
        out.contactLineCountBeforeDrop = contactLineCount();
        out.clippedPartBeforeDrop = clippedPart();

        // Requirement 1: drop only the CLIPPED part (found by geometry), by
        // the fixed field-name drop order, until nothing is clipped. One
        // warning total, listing every dropped field in drop order.
        var droppedNames = [];
        var guard = 0;
        while (!contactFits() && guard++ < 12) {
          var clipName = clippedPart();
          if (!clipName) {
            // Width overflow with no single offending part: drop by order.
            for (var di = 0; di < cfg.dropOrder.length; di++) {
              if (contactParts.some(function (p) { return p.name === cfg.dropOrder[di]; }) && !dropped[cfg.dropOrder[di]]) {
                clipName = cfg.dropOrder[di];
                break;
              }
            }
          }
          if (!clipName) break;
          dropped[clipName] = true;
          if (droppedNames.indexOf(clipName) === -1) droppedNames.push(clipName);
          renderContact();
        }
        if (droppedNames.length > 0) {
          droppedNames.sort(function (a, b) { return cfg.dropOrder.indexOf(a) - cfg.dropOrder.indexOf(b); });
          for (var dn = 0; dn < droppedNames.length; dn++) {
            if (allDroppedNames.indexOf(droppedNames[dn]) === -1) allDroppedNames.push(droppedNames[dn]);
          }
        }

        // 2. Fine print: its OWN font, independent of contact, down to the
        //    floor. Never shrink contact because fine print overflows.
        var ffs = cfg.baseFont;
        setFineFont(ffs);
        g = 0;
        while (ffs > cfg.floorFine && !fineFits() && g++ < 60) {
          ffs -= 1;
          setFineFont(ffs);
        }
        out.fineFontSizeUsed = ffs;
        out.fontSizeUsed = ffs;

        // 3. Fine print: truncate (line breaks preserved, "..." after the last
        //    whole word). More lines are allowed on big canvases.
        if (fine && fineText && isVisible(fine)) {
          var total = totalFineChars();
          var needsTrunc = fineLinesArr.length > cfg.maxFineLines || !fineFits();
          if (needsTrunc) {
            if (fine.clientHeight < cfg.floorFine) {
              hideFinePrint();
              out.warnings.push("fine print omitted: format too small");
            } else {
              var lo = 0, hi = total;
              while (lo < hi) {
                var mid = Math.ceil((lo + hi) / 2);
                setFineHtml(finePartsFor(mid), true);
                if (fineFits()) lo = mid; else hi = mid - 1;
              }
              setFineHtml(finePartsFor(lo), true);
              if (lo <= 0 || !fineText.innerHTML) {
                hideFinePrint();
                out.warnings.push("fine print omitted: format too small");
              } else {
                out.warnings.push("fine print truncated");
              }
            }
          }
        }

        // 4. A6 helper: does the footer still collide with headline/subhead/CTA?
        function footerHitsContent() {
          var f = rect(footer);
          if (!f) return false;
          var content = [headline, subhead, cta];
          for (var k = 0; k < content.length; k++) {
            if (isVisible(content[k]) && overlaps(f, rect(content[k]))) return true;
          }
          return false;
        }

        // 5. Compact: the in-footer logo starts at up to 70% of the canvas
        //    height. Shrink it to fit BEFORE the CTA lift and the omit ladder
        //    so the footer's height is final when the CTA is placed, and the
        //    logo (and contact) survive short formats instead of being dropped.
        if (cfg.logoInFooter && logoImg && footerHitsContent()) {
          var floorLogo = Math.max(6, Math.round(cfg.height * 0.12));
          var maxH = cfg.compactLogoMaxHeight;
          var g2 = 0;
          while (footerHitsContent() && maxH > floorLogo && g2++ < 40) {
            maxH = Math.max(floorLogo, Math.round(maxH * 0.85));
            logoImg.style.maxHeight = maxH + "px";
          }
        }

        // 5b. On a short compact canvas the footer cannot clear the CTA even at
        //     the logo floor. The CTA cannot lift clear either, so the omit
        //     ladder (step 7) omits the footer as one unit: no logo, no
        //     contact, no fine print. This is reported, never silent.

        // 6. Requirement 3: lift the CTA clear of the (now final-height) footer
        //    BEFORE the omit ladder. But only if the new position does not
        //    overlap headline/subhead. If it would, do NOT lift - leave the CTA
        //    and let the omit ladder resolve the footer/CTA overlap.
        if (cta) {
          clampToSafeZone(cta);
          var fr0 = rect(footer);
          if (fr0) {
            var cr0 = rect(cta);
            if (cr0.bottom > fr0.top - cfg.ctaGap) {
              var newBottom = fr0.top - cfg.ctaGap;
              var newCenter = newBottom - cr0.height / 2;
              var minCenter = cfg.insets.top * cfg.height + cr0.height / 2;
              // Requirement 3: the lifted box must not hit headline/subhead.
              var lifted = {
                top: newCenter - cr0.height / 2, bottom: newCenter + cr0.height / 2,
                left: cr0.left, right: cr0.right,
              };
              var hitsText = (isVisible(headline) && overlaps(lifted, rect(headline))) ||
                             (isVisible(subhead) && overlaps(lifted, rect(subhead)));
              if (newCenter >= minCenter && !hitsText) {
                setCenterY(cta, newCenter);
                out.ctaMoved = true;
              }
              // If we did not lift (hitsText or minCenter), the omit ladder
              // below handles the footer/CTA overlap. No standalone warning.
            }
          }
        }

        // 7. Omit ladder - ONLY for overlaps that remain after the CTA lift.
        //    On BIG canvases we never strip the footer: keep fine print,
        //    contact and logo exactly as they are, report the collision once
        //    and stop. On SMALL canvases the ladder still runs (whole-unit
        //    omission when the CTA cannot lift, otherwise piecemeal).
        if (footerHitsContent()) {
          var fr7 = rect(footer);
          var ctaCannotLift = !!(
            fr7 && cta && rect(cta) && rect(cta).bottom > fr7.top - cfg.ctaGap
          );
          if (cfg.bigCanvas) {
            // Requirement 2: keep the whole footer; do NOT hide fine print,
            // contact or logo for a footer/CTA overlap. Report and stop.
            out.warnings.push("cta could not clear the footer");
          } else if (ctaCannotLift) {
            // The whole brand footer goes as one unit. Hide the contact line
            // with it: contactHtml is read from the DOM, and a hidden footer
            // must never leave a populated contact line behind.
            if (contact) contact.style.display = "none";
            hideFinePrint();
            footer.style.display = "none";
            out.warnings.push("brand footer omitted: format too small");
          } else {
            if (footerHitsContent()) {
              hideFinePrint();
              if (footerHitsContent()) out.warnings.push("fine print omitted: format too small");
            }
            if (footerHitsContent()) {
              if (contact) contact.style.display = "none";
              out.warnings.push("contact omitted: format too small");
            }
            if (footerHitsContent()) {
              // Fine print and contact are gone; only the logo remains in the row.
              var footerLogo = fine ? fine.querySelector("img") : null;
              if (footerLogo) {
                footerLogo.style.display = "none";
                out.warnings.push("logo omitted: format too small");
              }
            }
            if (footerHitsContent()) {
              footer.style.display = "none";
              out.warnings.push("brand footer omitted: format too small");
            }
          }
        }

        // 8. Requirement 1: FINAL VERIFICATION PASS. After every font, width
        //    and lift step above, guarantee no visible contact part or fine
        //    print is left clipped. Drop clipped contact parts by the drop
        //    order (with a warning); truncate clipped fine print at a word
        //    boundary (with a warning). Never leave clipped text unreported.
        if (contact && contact.style.display !== "none") {
          var extraDropped = [];
          var vg = 0;
          while (contactFits() === false && vg++ < 12) {
            var vn = clippedPart();
            if (!vn) {
              for (var vi = 0; vi < cfg.dropOrder.length; vi++) {
                if (!dropped[cfg.dropOrder[vi]] &&
                    contactParts.some(function (p) { return p.name === cfg.dropOrder[vi]; })) {
                  vn = cfg.dropOrder[vi];
                  break;
                }
              }
            }
            if (!vn) break;
            dropped[vn] = true;
            if (extraDropped.indexOf(vn) === -1) extraDropped.push(vn);
            renderContact();
          }
          if (extraDropped.length > 0) {
            extraDropped.sort(function (a, b) { return cfg.dropOrder.indexOf(a) - cfg.dropOrder.indexOf(b); });
            for (var ed = 0; ed < extraDropped.length; ed++) {
              if (allDroppedNames.indexOf(extraDropped[ed]) === -1) allDroppedNames.push(extraDropped[ed]);
            }
          }
        }
        if (fine && fineText && isVisible(fine) && fineText.innerHTML && !fineFits()) {
          var vtot = totalFineChars();
          var vlo = 0, vhi = vtot;
          while (vlo < vhi) {
            var vmid = Math.ceil((vlo + vhi) / 2);
            setFineHtml(finePartsFor(vmid), true);
            if (fineFits()) vlo = vmid; else vhi = vmid - 1;
          }
          setFineHtml(finePartsFor(vlo), true);
          if (vlo <= 0 || !fineText.innerHTML) {
            hideFinePrint();
            out.warnings.push("fine print omitted: format too small");
          } else {
            out.warnings.push("fine print truncated");
          }
        }
      }

      var footerVisible = footer && footer.style.display !== "none";

      // ── Requirement 2: the non-compact logo must never sit on top of the
      //    CTA, headline, subhead or footer. After the CTA lift, search the
      //    safe zone for a clear spot (current, above, below, opposite side);
      //    if none is free, omit the logo rather than draw it over content. ──
      if (logo && isVisible(logo) && !cfg.logoInFooter) {
        clampToSafeZone(logo);
        var lgr = rect(logo);
        if (lgr) {
          var lhW = lgr.width / 2, lhH = lgr.height / 2;
          var lLeft   = cfg.insets.left   * cfg.width  + lhW;
          var lRight  = cfg.width  - cfg.insets.right  * cfg.width - lhW;
          var lTop    = cfg.insets.top    * cfg.height + lhH;
          var lBottom = cfg.height - cfg.insets.bottom * cfg.height - lhH;
          var cx0 = lgr.left + lhW, cy0 = lgr.top + lhH;
          var obs = [cta, headline, subhead, footer].filter(isVisible);
          function logoClearAt(cx, cy) {
            var b = { top: cy - lhH, bottom: cy + lhH, left: cx - lhW, right: cx + lhW };
            for (var k2 = 0; k2 < obs.length; k2++) {
              var rr = rect(obs[k2]);
              if (rr && overlaps(b, rr)) return false;
            }
            return true;
          }
          function clampN(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
          var cands = [[cx0, cy0]];
          var oppX = (cx0 <= cfg.width / 2) ? lRight : lLeft;
          for (var k3 = 0; k3 < obs.length; k3++) {
            var orr = rect(obs[k3]);
            if (!orr) continue;
            cands.push([cx0, orr.top - cfg.logoGap - lhH]);       // above
            cands.push([cx0, orr.bottom + cfg.logoGap + lhH]);    // below
            cands.push([oppX, cy0]);                              // opposite side
            cands.push([oppX, orr.top - cfg.logoGap - lhH]);      // opposite, above
            cands.push([oppX, orr.bottom + cfg.logoGap + lhH]);   // opposite, below
          }
          var placed = false;
          for (var c1 = 0; c1 < cands.length; c1++) {
            var ncx = clampN(cands[c1][0], lLeft, lRight);
            var ncy = clampN(cands[c1][1], lTop, lBottom);
            if (logoClearAt(ncx, ncy)) {
              if (Math.abs(ncx - cx0) > 0.5 || Math.abs(ncy - cy0) > 0.5) {
                logo.style.left = (ncx / cfg.width * 100) + "%";
                setCenterY(logo, ncy);
                out.logoMoved = true;
              }
              placed = true;
              break;
            }
          }
          if (!placed) {
            // No free spot anywhere in the safe zone: omit rather than overlap.
            logo.style.display = "none";
            out.warnings.push("logo omitted: no clear spot");
          }
        }
      }

      // Diagnostics: let the caller assert on the real post-layout geometry
      // instead of guessing from pixels. contactHtml is null once the contact
      // line has been hidden, so callers can tell "dropped" from "present".
      out.contactHtml = contact && contact.style.display !== "none" ? contact.innerHTML : null;
      out.footerVisible = !!footerVisible;
      out.footerDisplay = footer ? footer.style.display || "" : null;
      var logoEl = cfg.logoInFooter ? logoImg : logo;
      out.logoDisplay = logoEl ? logoEl.style.display || "" : null;
      function snap(el) {
        if (!el || el.style.display === "none") return null;
        var r = rect(el);
        return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
      }
      out.footerRect = snap(footerVisible ? footer : null);
      // Report the logo box in BOTH modes. Non-compact: the positioned #logo
      // wrapper. Compact: the <img> that rides in the footer row - callers
      // need its rect to prove the logo survived.
      out.logoRect = snap(cfg.logoInFooter ? logoImg : logo);
      out.ctaRect = snap(cta);
      out.headlineRect = snap(headline);
      out.subheadRect = snap(subhead);
      out.safeBottomY = cfg.height - cfg.insets.bottom * cfg.height;
      out.safeTopY = cfg.insets.top * cfg.height;

      // Requirement 4 proof hooks: contact container box + every .part box, so
      // a caller can assert no part is clipped without reading pixels.
      if (contact && contact.style.display !== "none") {
        var ccr = rect(contact);
        out.contactMetrics = ccr ? {
          clientWidth: contact.clientWidth, scrollWidth: contact.scrollWidth,
          clientHeight: contact.clientHeight, scrollHeight: contact.scrollHeight,
          rect: { top: ccr.top, bottom: ccr.bottom, left: ccr.left, right: ccr.right },
        } : null;
        // Requirement 1 proof hook: the line count the cap was judged against.
        out.contactLineCount = contactLineCount();
        var pel = contact.querySelectorAll(".part");
        var parts = [];
        for (var pi = 0; pi < pel.length; pi++) {
          var pr2 = rect(pel[pi]);
          parts.push({
            name: pel[pi].getAttribute("data-part"),
            rect: pr2 ? { top: pr2.top, bottom: pr2.bottom, left: pr2.left, right: pr2.right } : null,
          });
        }
        out.contactParts = parts;
      } else {
        out.contactMetrics = null;
        out.contactLineCount = 0;
        out.contactParts = [];
      }

      // Task 3: one "contact dropped" warning total (step 1 + step 8 merged),
      // then unique warning strings only - no duplicate diagnostics survive.
      if (allDroppedNames.length > 0) {
        allDroppedNames.sort(function (a, b) { return cfg.dropOrder.indexOf(a) - cfg.dropOrder.indexOf(b); });
        out.warnings.push("contact dropped: " + allDroppedNames.join(", ") + " (no room)");
      }
      out.warnings = out.warnings.filter(function (w, i, arr) { return arr.indexOf(w) === i; });

      window.__vfLayout = out;
    }

    // The layout pass measures the logo <img>, which has no size until it has
    // loaded. Run on window "load" so every box below is real.
    if (document.readyState === "complete") {
      runLayout();
    } else {
      window.addEventListener("load", runLayout);
    }
    })();
  </script>
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

/** Post-layout geometry the in-page pass settled on. Diagnostics only. */
export interface RenderLayout {
  warnings: string[];
  ctaMoved: boolean;
  logoMoved: boolean;
  fontSizeUsed: number;
  /** Fine-print font size the layout settled on (independent of contact). */
  fineFontSizeUsed?: number;
  /** Contact font size the layout settled on (independent of fine print). */
  contactFontSizeUsed?: number;
  contactHtml: string | null;
  footerVisible: boolean;
  footerDisplay: string | null;
  logoDisplay: string | null;
  footerRect: Box | null;
  logoRect: Box | null;
  ctaRect: Box | null;
  headlineRect: Box | null;
  subheadRect: Box | null;
  safeTopY: number;
  safeBottomY: number;
  /** Contact container box + scroll/client metrics (null when hidden). */
  contactMetrics: {
    clientWidth: number; scrollWidth: number;
    clientHeight: number; scrollHeight: number;
    rect: Box | null;
  } | null;
  /** Rendered contact line count (the 2-line cap on big canvases). */
  contactLineCount: number;
  /** Line count right before the drop loop runs (after shrink hit the floor). */
  contactLineCountBeforeDrop?: number;
  /** Offending part right before the drop loop (null = cap, not geometry, binds). */
  clippedPartBeforeDrop?: string | null;
  /** Every visible .part box, for clip assertions (req 4). */
  contactParts: { name: string | null; rect: Box | null }[];
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface RenderAdResult {
  png: Buffer;
  /** Layout problems that did not stop the render (fine print truncated, etc). */
  warnings: string[];
  /** Real post-layout geometry, for callers/tests that need to assert on it. */
  layout?: RenderLayout;
}

/**
 * Render an ad design to a PNG buffer using Puppeteer.
 *
 * @param design - The AI-generated ad design
 * @param formatSpec - The target format dimensions
 * @param fonts - Optional brand font choices for font resolution
 * @param scale - Device scale factor. Defaults to 2 (retina preview).
 *               Pass 1 for export so the PNG is exactly width x height pixels.
 * @param brand - Optional brand furniture (logo data URI, website, contact,
 *               fine print) drawn by the app rather than the model.
 */
export async function renderAdToPng(
  design: AdDesignResult,
  formatSpec: AdFormatSpec,
  fonts?: FontChoice[],
  scale: number = 2,
  brand?: RenderBrand
): Promise<RenderAdResult> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const warnings: string[] = [];

  try {
    // Set viewport to exact format dimensions at the requested scale
    await page.setViewport({
      width: formatSpec.width,
      height: formatSpec.height,
      deviceScaleFactor: scale,
    });

    // Build and set HTML content
    const html = await buildRenderHtml(design, formatSpec, fonts, brand);
    await page.setContent(html, { waitUntil: "load" });

    // Wait a moment for fonts to load
    await new Promise((resolve) => setTimeout(resolve, 300));

    // The in-page pass runs on window "load" (so the logo <img> has a real
    // size). Wait for it rather than racing it.
    // (globalThis rather than window: this file is type-checked with the
    // Electron tsconfig, which has no DOM lib.)
    let layout: RenderLayout | undefined;
    try {
      await page.waitForFunction(
        () => (globalThis as Record<string, unknown>)["__vfLayout"] != null,
        { timeout: LAYOUT_TIMEOUT_MS }
      );
      layout = (await page.evaluate(() =>
        (globalThis as Record<string, unknown>)["__vfLayout"]
      )) as RenderLayout;
    } catch {
      // waitForFunction timed out, or the in-page script threw before it could
      // publish __vfLayout. Either way `layout` stays undefined and we report
      // it below rather than silently claiming a clean render.
    }
    if (!layout) {
      warnings.push("layout check did not run");
    } else if (Array.isArray(layout.warnings)) {
      warnings.push(...layout.warnings);
    }

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

    return { png: screenshotBuffer as Buffer, warnings, layout };
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
