/**
 * Stock photo service using Unsplash API.
 * Free tier: 50 requests/hour, no credit card required.
 * Get API key at: https://unsplash.com/developers
 */

const UNSPLASH_ACCESS_KEY = ""; // Set via Settings or env var
const UNSPLASH_API_BASE = "https://api.unsplash.com";

export interface StockPhoto {
  id: string;
  url: string; // Regular size (1080px wide)
  thumbUrl: string; // Small thumbnail
  alt: string;
  photographer: string;
  width: number;
  height: number;
}

/**
 * Search Unsplash for photos matching a query.
 * Returns up to `count` results.
 */
export async function searchStockPhotos(
  query: string,
  count: number = 5
): Promise<StockPhoto[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    // Fallback: return placeholder gradient
    return [
      {
        id: "placeholder",
        url: "",
        thumbUrl: "",
        alt: "Placeholder",
        photographer: "",
        width: 1080,
        height: 1080,
      },
    ];
  }

  try {
    const response = await fetch(
      `${UNSPLASH_API_BASE}/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=squarish`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.results.map((photo: any) => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbUrl: photo.urls.thumb,
      alt: photo.alt_description || "Stock photo",
      photographer: photo.user.name,
      width: photo.width,
      height: photo.height,
    }));
  } catch (error) {
    console.error("Failed to fetch stock photos:", error);
    return [];
  }
}

/**
 * Get a single random photo matching a query.
 */
export async function getRandomStockPhoto(
  query: string
): Promise<StockPhoto | null> {
  const photos = await searchStockPhotos(query, 1);
  return photos.length > 0 ? photos[0] : null;
}
