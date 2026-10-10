/**
 * Watermark Service
 * Overlays a semi-transparent watermark on rendered ad images using sharp.
 * Protects assets during client review while keeping them visually clear.
 */

const WATERMARK_TEXT = "O-Kay-Est Media";
const WATERMARK_OPACITY = 0.18;
const WATERMARK_PADDING = 16;

// Lazy-loaded sharp instance (dynamic import required — ESM-only package in CJS context)
let sharpInstance: any = null;

async function getSharp(): Promise<any> {
  if (!sharpInstance) {
    sharpInstance = (await import("sharp")).default;
  }
  return sharpInstance;
}

/**
 * Add a semi-transparent watermark to a PNG buffer.
 * The watermark is placed in the bottom-right corner with the business
 * name rendered in bold white at low opacity.
 *
 * @param pngBuffer - The rendered ad image as a PNG buffer
 * @returns New PNG buffer with watermark applied
 */
export async function addWatermark(pngBuffer: Buffer): Promise<Buffer> {
  const sharp = await getSharp();

  const metadata = await sharp(pngBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Scale watermark text proportionally (max ~10% of width, min 12px)
  const fontSize = Math.max(12, Math.round(width * 0.025));
  const textHeight = fontSize + 8;

  // Create SVG for the watermark text
  const svgText = `
    <svg width="${width}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: 700;
          fill: rgba(255, 255, 255, ${WATERMARK_OPACITY});
          letter-spacing: 0.05em;
        }
      </style>
      <text
        x="${width - WATERMARK_PADDING}"
        y="${fontSize + 4}"
        text-anchor="end"
      >${WATERMARK_TEXT}</text>
    </svg>
  `;

  // Render the SVG text to a PNG buffer
  const textBuffer = await sharp(Buffer.from(svgText))
    .png()
    .toBuffer();

  // Composite the watermark text onto the bottom-right of the image
  const watermarked = await sharp(pngBuffer)
    .composite([
      {
        input: textBuffer,
        top: height - textHeight - WATERMARK_PADDING,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return watermarked as Buffer;
}

/**
 * Add a watermark and save to disk in one step.
 *
 * @param pngBuffer - The rendered ad image
 * @param outputPath - Full path to save the watermarked PNG
 * @returns The saved file path
 */
export async function addWatermarkToFile(
  pngBuffer: Buffer,
  outputPath: string
): Promise<string> {
  const { promises: fs } = await import("fs");
  const path = await import("path");

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const watermarked = await addWatermark(pngBuffer);
  await fs.writeFile(outputPath, watermarked);

  return outputPath;
}
