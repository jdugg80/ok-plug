import { useEffect, useState } from "react";
import type {
  AdFormatSpec,
  AdDesignResult,
  CustomAdFormatSpec,
  FontChoice,
  SourceAsset,
  RenderBrand,
} from "@/types/domain";
import {
  assembleContactParts,
  assembleFinePrint,
  chooseLogo,
  getSafeInsets,
  isCompactCanvas,
  resolveFontStack,
} from "@/types/domain";
import styles from "./AdCanvas.module.css";

/**
 * Preview brand. Adds the raw logo metadata + a resolved-URI map so the
 * canvas can run the same chooseLogo() the PNG exporter uses, without doing
 * any I/O itself.
 */
export interface PreviewBrand extends RenderBrand {
  logos?: SourceAsset[];
  /** asset id -> data URI, resolved by the page via the readImage IPC. */
  logoDataUris?: Record<string, string>;
  /** Brand fonts, so the footer uses the brand's body stack (A5). */
  fonts?: FontChoice[];
}

export interface AdCanvasProps {
  formatSpec: AdFormatSpec | CustomAdFormatSpec;
  design: AdDesignResult;
  imageUrl?: string;
  brand?: PreviewBrand;
}

/** Same clamp the PNG renderer uses; the preview just never measures. */
function previewFooterFont(width: number, height: number): number {
  return Math.max(11, Math.min(28, Math.round(0.022 * Math.min(width, height))));
}

export function AdCanvas({
  formatSpec,
  design,
  imageUrl,
  brand,
}: AdCanvasProps) {
  // Scale for preview (max 500px width)
  const width = formatSpec.width;
  const height = formatSpec.height;
  const scale = Math.min(1, 500 / width);
  const previewWidth = width * scale;
  const previewHeight = height * scale;

  const insets = getSafeInsets(formatSpec);
  const compact = isCompactCanvas(width, height);
  const footerFont = previewFooterFont(width, height);

  const fineLines = assembleFinePrint(brand);
  const contactParts = assembleContactParts(brand);

  // A6 (preview approximation): the footer must never overlap the headline,
  // subhead or CTA. The PNG renderer measures for real; here we estimate the
  // boxes in design-space pixels and omit (never overlap) when they collide.
  // Order mirrors the PNG path: fine print first, then the contact line.
  const ctaBottom = design.ctaPosition.y * height + design.ctaSize + 20;
  const headlineBottom = design.headlinePosition.y * height + design.headlineSize * 1.2;
  const subheadBottom = design.subheadPosition.y * height + design.subheadSize * 1.4;
  const contentBottom = Math.max(ctaBottom, headlineBottom, subheadBottom);
  const footerTopIfFineAndContact =
    height * (1 - insets.bottom) - footerFont * 1.25 * (fineLines.length + contactParts.length);
  const footerTopIfContact =
    height * (1 - insets.bottom) - footerFont * 1.25 * contactParts.length;

  const showFinePreview =
    fineLines.length === 0 || footerTopIfFineAndContact >= contentBottom;
  const shownFineLines = showFinePreview ? fineLines : [];
  const showContactPreview =
    contactParts.length === 0 || footerTopIfContact >= contentBottom;
  const shownContactParts = showContactPreview ? contactParts : [];

  const hasFooter = shownFineLines.length > 0 || shownContactParts.length > 0;
  // A5: the brand footer uses the brand's body stack, never the browser default.
  const bodyFont = resolveFontStack("body", brand?.fonts);

  // Same selection rule as the PNG path. The preview only draws a logo when
  // the page has already resolved that asset's bytes.
  const logoChoice = brand
    ? chooseLogo(brand.logos, design.backgroundColor || design.backgroundGradient)
    : null;
  const logoSrc = logoChoice
    ? brand?.logoDataUris?.[logoChoice.logo.id]
    : brand?.logoDataUri;
  const hasLogo = Boolean(logoSrc);
  const logoInFooter = compact && hasLogo;

  // A3/A4 (preview approximation): clamp the logo centre into the safe zone and
  // keep it clear of the footer so it never sits on the fine print / contact
  // line. The PNG renderer measures the real boxes.
  const logoMaxH = height * 0.18;
  const footerTopEst =
    hasFooter || logoInFooter
      ? height * (1 - insets.bottom) -
        footerFont * 1.25 * Math.max(1, shownFineLines.length + shownContactParts.length)
      : height;
  const logoTopLimit = height * insets.top + logoMaxH / 2;
  const logoBottomLimit = Math.min(
    height * (1 - insets.bottom) - logoMaxH / 2,
    footerTopEst - logoMaxH / 2
  );
  const logoCenterY = Math.min(
    Math.max(design.logoPosition.y * height, logoTopLimit),
    Math.max(logoTopLimit, logoBottomLimit)
  );

  return (
    <div className={styles.canvasWrapper}>
      <div
        className={styles.canvas}
        style={{
          width: previewWidth,
          height: previewHeight,
          background: design.backgroundGradient || design.backgroundColor,
          color: design.textColor,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background Image (if available) */}
        {imageUrl && (
          <div
            className={styles.backgroundImage}
            style={{
              backgroundImage: `url(${imageUrl})`,
              left: `${design.imagePosition.x * 100}%`,
              top: `${design.imagePosition.y * 100}%`,
              width: `${design.imagePosition.width * 100}%`,
              height: `${design.imagePosition.height * 100}%`,
            }}
          />
        )}

        {/* Overlay for text readability */}
        <div
          className={styles.overlay}
          style={{ background: design.overlayColor }}
        />

        {/* Headline */}
        <div
          className={styles.headline}
          style={{
            left: `${design.headlinePosition.x * 100}%`,
            top: `${design.headlinePosition.y * 100}%`,
            fontSize: Math.max(14, design.headlineSize * scale),
            fontFamily: design.headlineFont,
            fontWeight: design.headlineWeight,
            color: design.textColor,
          }}
        >
          {design.headline}
        </div>

        {/* Subhead */}
        {design.subhead && (
          <div
            className={styles.subhead}
            style={{
              left: `${design.subheadPosition.x * 100}%`,
              top: `${design.subheadPosition.y * 100}%`,
              fontSize: Math.max(10, design.subheadSize * scale),
              fontFamily: design.subheadFont,
              color: design.textColor,
              opacity: 0.9,
            }}
          >
            {design.subhead}
          </div>
        )}

        {/* CTA Button */}
        <div
          className={styles.cta}
          style={{
            left: `${design.ctaPosition.x * 100}%`,
            top: `${design.ctaPosition.y * 100}%`,
            fontSize: Math.max(10, design.ctaSize * scale),
            fontFamily: design.ctaFont,
            backgroundColor: design.accentColor,
            color: "#ffffff",
            padding: `${10 * scale}px ${24 * scale}px`,
            borderRadius: `${6 * scale}px`,
          }}
        >
          {design.cta}
        </div>

        {/* Logo — only when a real asset resolves. No text fallback. */}
        {hasLogo && !compact && (
          <div
            className={styles.logo}
            style={{
              left: `${design.logoPosition.x * 100}%`,
              top: `${(logoCenterY / height) * 100}%`,
            }}
          >
            <img
              src={logoSrc}
              alt=""
              className={styles.logoImage}
              style={{
                maxWidth: `${width * 0.12}px`,
                maxHeight: `${height * 0.18}px`,
              }}
            />
          </div>
        )}

        {/* Brand footer — same helpers, approximate auto-fit. */}
        {(hasFooter || logoInFooter) && (
          <div
            className={`${styles.footer}${compact ? ` ${styles.footerCompact}` : ""}`}
            style={{
              left: `${insets.left * 100}%`,
              right: `${insets.right * 100}%`,
              bottom: `${insets.bottom * 100}%`,
              fontSize: footerFont,
              color: design.textColor,
              fontFamily: bodyFont,
            }}
          >
            <div className={styles.fLeft}>
              {logoInFooter && logoSrc && (
                <img
                  src={logoSrc}
                  alt=""
                  className={styles.footerLogo}
                  style={{ maxHeight: `${height * 0.7}px` }}
                />
              )}
              <span>
                {shownFineLines.map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </span>
            </div>
            <div className={styles.fRight}>
              {shownContactParts.map((part, i) => (
                <span key={part.name}>
                  {i > 0 && <span className={styles.sep}> · </span>}
                  <span className={styles.part}>{part.text}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Format info */}
      <div className={styles.formatInfo}>
        <span>{formatSpec.platform}</span>
        <span>{formatSpec.placement}</span>
        <span>{formatSpec.width}×{formatSpec.height}</span>
      </div>
    </div>
  );
}

/**
 * Resolve every logo in a brand kit to a data URI, once, for preview use.
 * Failures are skipped silently — a missing logo just means no logo drawn.
 */
export async function resolvePreviewLogos(
  rootPath: string | undefined,
  logos: readonly SourceAsset[] | undefined
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!rootPath || !logos || logos.length === 0) return out;
  for (const logo of logos) {
    try {
      out[logo.id] = await window.vibeforge.readImage(rootPath, logo.relativePath);
    } catch {
      // skip
    }
  }
  return out;
}

/** Convenience hook so both pages share the same resolution code. */
export function usePreviewLogos(
  rootPath: string | undefined,
  logos: readonly SourceAsset[] | undefined
): Record<string, string> {
  const [uris, setUris] = useState<Record<string, string>>({});
  const key = (logos ?? []).map((l) => `${l.id}:${l.relativePath}`).join("|");
  useEffect(() => {
    let cancelled = false;
    resolvePreviewLogos(rootPath, logos).then((result) => {
      if (!cancelled) setUris(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, key]);
  return uris;
}
