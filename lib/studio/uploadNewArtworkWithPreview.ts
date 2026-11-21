import type { SupabaseClient } from "@supabase/supabase-js";
import { createWebArtworkPreview } from "@/lib/studio/createWebArtworkPreview";

/**
 * Upload a new artwork exactly once as an unmodified original, and create
 * a separate small public preview. The caller continues saving originalPath
 * as image_path, while getPublicUrl(previewPath) becomes image_url.
 *
 * Runs in the Studio browser. Never expose a service-role key in this flow.
 */
export async function uploadNewArtworkWithPreview(
  supabase: SupabaseClient,
  originalPath: string,
  originalFile: File,
  originalOptions?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
    metadata?: Record<string, string>;
  }
) {
  if (!originalPath || typeof originalPath !== "string") {
    throw new Error("Artwork original path is missing.");
  }

  // Fail before any upload if this image cannot be made safely into WebP.
  const preview = await createWebArtworkPreview(originalFile);
  const previewPath = `web-previews/${crypto.randomUUID()}.webp`;
  const storage = supabase.storage.from("artworks");

  const originalUpload = await storage.upload(originalPath, originalFile, {
    ...originalOptions,
    upsert: false,
    contentType: originalFile.type,
  });

  // Return the standard Supabase upload result on failure. Existing form's
  // error handling still works, and no preview was uploaded.
  if (originalUpload.error) {
    return { ...originalUpload, previewPath: null as string | null };
  }

  const previewUpload = await storage.upload(previewPath, preview, {
    upsert: false,
    contentType: "image/webp",
    cacheControl: "31536000",
  });

  if (previewUpload.error) {
    // The original path is unique and was created by this call. Clean up both
    // newly uploaded objects, but never touch pre-existing artwork files.
    const { error: cleanupError } = await storage.remove([originalPath]);
    if (cleanupError) {
      console.warn("New artwork upload cleanup failed:", cleanupError);
    }
    return { data: null, error: previewUpload.error, previewPath: null as string | null };
  }

  return { ...originalUpload, previewPath: previewPath as string | null };
}
