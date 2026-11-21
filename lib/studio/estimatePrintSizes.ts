/**
 * LETION ART local estimates using theprintspace's published print-quality
 * guidance: 300 PPI preferred, 200 PPI minimum, preserve source aspect ratio.
 * These Small / Medium / Large subdivisions are STUDIO estimates; they are NOT
 * supplier-generated recommendation tiers. Verify exact supplier variants
 * in Creativehub before selling. Never upscale or treat this as an upload pass.
 */
export type SizeTier = "Small" | "Medium" | "Large";
export type PrintSizeSuggestion = {
  tier: SizeTier;
  widthMm: number;
  heightMm: number;
  ppi: 300;
};
export type PrintSizeEstimate = {
  widthPx: number;
  heightPx: number;
  megapixels: number;
  meetsCreativehubMinimum: boolean;
  meetsCreativehubStandardMaximum: boolean;
  preferredMaxWidthMm: number;
  preferredMaxHeightMm: number;
  minimumMaxWidthMm: number;
  minimumMaxHeightMm: number;
  suggestions: PrintSizeSuggestion[];
};
const MIN_PIXELS = 2_000_000;
const PREFERRED_PPI = 300;
const MINIMUM_PPI = 200;
// Conservative common fine-art paper caps for Studio estimation only.
const MAX_SHORT_MM = 1016;
const MAX_LONG_MM = 3048;
function maxAtPpi(w: number, h: number, ppi: number) {
  let width = w * 25.4 / ppi;
  let height = h * 25.4 / ppi;
  const shorter = Math.min(width, height);
  const longer = Math.max(width, height);
  const fit = Math.min(1, MAX_SHORT_MM / shorter, MAX_LONG_MM / longer);
  width *= fit;
  height *= fit;
  return { widthMm: width, heightMm: height };
}
export function estimatePrintSizes(widthPx: number, heightPx: number): PrintSizeEstimate {
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) ||
      widthPx < 1 || heightPx < 1 || widthPx * heightPx > 2_000_000_000) {
    throw new Error("Image dimensions are invalid or exceed the supported preview range.");
  }
  const megapixels = Math.round(widthPx * heightPx / 10000) / 100;
  const preferred = maxAtPpi(widthPx, heightPx, PREFERRED_PPI);
  const minimum = maxAtPpi(widthPx, heightPx, MINIMUM_PPI);
  // Explicitly a Studio policy, not the supplier's unpublished tier algorithm.
  const fractions = [
    { tier: "Small", scale: .5 },
    { tier: "Medium", scale: .75 },
    { tier: "Large", scale: 1 },
  ] as const;
  const suggestions: PrintSizeSuggestion[] = fractions.map(({tier,scale}) => ({
    tier,
    widthMm: Math.max(1, Math.round(preferred.widthMm * scale)),
    heightMm: Math.max(1, Math.round(preferred.heightMm * scale)),
    ppi: 300,
  }));
  return {
    widthPx: Math.round(widthPx), heightPx: Math.round(heightPx), megapixels,
    meetsCreativehubMinimum: widthPx * heightPx >= MIN_PIXELS,
    meetsCreativehubStandardMaximum: widthPx * heightPx <= 200_000_000,
    preferredMaxWidthMm: Math.round(preferred.widthMm),
    preferredMaxHeightMm: Math.round(preferred.heightMm),
    minimumMaxWidthMm: Math.round(minimum.widthMm),
    minimumMaxHeightMm: Math.round(minimum.heightMm),
    suggestions,
  };
}
