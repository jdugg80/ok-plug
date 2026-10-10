import type { AdFormatSpec, AdDesignResult } from "@/types/domain";
import styles from "./AdCanvas.module.css";

export interface AdCanvasProps {
  formatSpec: AdFormatSpec;
  design: AdDesignResult;
  imageUrl?: string;
  logoUrl?: string;
}

export function AdCanvas({
  formatSpec,
  design,
  imageUrl,
  logoUrl,
}: AdCanvasProps) {
  // Scale for preview (max 500px width)
  const scale = Math.min(1, 500 / formatSpec.width);
  const previewWidth = formatSpec.width * scale;
  const previewHeight = formatSpec.height * scale;

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

        {/* Logo */}
        <div
          className={styles.logo}
          style={{
            left: `${design.logoPosition.x * 100}%`,
            top: `${design.logoPosition.y * 100}%`,
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className={styles.logoImage} />
          ) : (
            <div
              className={styles.logoPlaceholder}
              style={{ color: design.textColor, borderColor: `${design.textColor}40` }}
            >
              LOGO
            </div>
          )}
        </div>
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
