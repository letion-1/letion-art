/**
 * Make a lightweight display image directly in the Studio user's browser.
 * Does not mutate, downsample, or upload the original File.
 * Keeping all processing on the client avoids server upload size limits.
 */
export async function createWebArtworkPreview(original: File): Promise<File> {
  const supported = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!supported.has(original.type)) {
    throw new Error("Choose a JPG, PNG or WebP artwork.");
  }
  if (original.size > 50 * 1024 * 1024) {
    throw new Error("Artwork files must be smaller than 50 MB.");
  }
  if (typeof window === "undefined") {
    throw new Error("Artwork preview generation must run in the browser.");
  }

  const bitmap = await createImageBitmap(original);
  try {
    if (!bitmap.width || !bitmap.height) {
      throw new Error("The image has invalid dimensions.");
    }
    if (bitmap.width * bitmap.height > 150_000_000) {
      throw new Error("This image has too many pixels to process in a browser.");
    }

    const options: Array<{ dimension: number; quality: number }> = [
      { dimension: 1800, quality: 0.8 },
      { dimension: 1800, quality: 0.7 },
      { dimension: 1600, quality: 0.72 },
    ];
    let output: Blob | null = null;
    for (const option of options) {
      const ratio = Math.min(1, option.dimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("Your browser could not start image processing.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      output = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("WebP encoding failed."))),
          "image/webp",
          option.quality
        );
      });
      canvas.width = 0;
      canvas.height = 0;
      if (output.type !== "image/webp") {
        throw new Error("This browser does not support WebP previews.");
      }
      if (output.size <= 900_000) break;
    }
    if (!output || !output.size) throw new Error("Could not create a preview.");
    const base = original.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
    return new File([output], `${base || "artwork"}-web.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
