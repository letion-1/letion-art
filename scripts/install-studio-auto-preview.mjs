import fs from 'node:fs';
import path from 'node:path';

// This script changes just the existing edit-image handler, NOT the rest of the 2700+ line Studio editor.
// It refuses to apply if the expected anchors or file structure differ.
const root = process.cwd();
const target = path.join(root, 'app', 'studio', 'artworks', '[id]', 'edit', 'ArtworkEditor.tsx');
const helper = path.join(root, 'lib', 'studio', 'createWebArtworkPreview.ts');
const helperInPackage = path.join(root, 'lib', 'studio', 'createWebArtworkPreview.ts');
if (!fs.existsSync(target) || !fs.existsSync(helper)) {
  throw new Error('Required files missing. Extract the ZIP to the project root first.');
}
const source = fs.readFileSync(target, 'utf8');
const importLine = 'import { createWebArtworkPreview } from "@/lib/studio/createWebArtworkPreview";';
const anchorA = '  async function replaceArtworkImage() {';
const anchorB = '  async function addPrintVariant() {';
const start = source.indexOf(anchorA);
const end = source.indexOf(anchorB);
if (source.includes(importLine) && source.includes('web-previews/')) {
  console.log('Artwork Editor appears already patched. No changes made.');
  process.exit(0);
}
if (start < 0 || end <= start || source.indexOf(anchorA, start + 1) !== -1 || source.indexOf(anchorB, end + 1) !== -1) {
  throw new Error('Artwork Editor no longer matches the known upload handler. Refusing to modify it.');
}
const oldHandler = source.slice(start, end);
if (!oldHandler.includes('currentImagePath') || !oldHandler.includes('replacementImage') || !oldHandler.includes('image_url')) {
  throw new Error('Unexpected replacement image handler. Refusing to modify it.');
}
const replacement = `  async function replaceArtworkImage() {
    if (!replacementImage) return;
    setReplacingImage(true);
    setMessage("Preparing optimized gallery preview...");
    const supabase = createClient();
    const stamp = Date.now();
    const originalExtension = getImageExtension(replacementImage);
    const originalPath = \`artworks/\${artwork.id}-\${stamp}.\${originalExtension}\`;
    const previewPath = \`web-previews/\${artwork.id}-\${stamp}.webp\`;
    let originalUploaded = false;
    let previewUploaded = false;
    let databaseUpdated = false;
    try {
      // Generate small preview first; fail safely before uploading anything.
      const webPreview = await createWebArtworkPreview(replacementImage);
      setMessage("Uploading original and optimized display image...");
      // Preserve the original for later print production. NEVER delete the old master on replacement.
      const { error: originalError } = await supabase.storage
        .from("artworks")
        .upload(originalPath, replacementImage, {
          upsert: false,
          contentType: replacementImage.type,
          cacheControl: "3600",
        });
      if (originalError) throw originalError;
      originalUploaded = true;
      const { error: previewError } = await supabase.storage
        .from("artworks")
        .upload(previewPath, webPreview, {
          upsert: false,
          contentType: "image/webp",
          cacheControl: "31536000",
        });
      if (previewError) throw previewError;
      previewUploaded = true;
      const { data: previewPublicUrl } = supabase.storage
        .from("artworks")
        .getPublicUrl(previewPath);
      const nextUrl = previewPublicUrl.publicUrl;
      const { data: updatedRow, error: updateError } = await supabase
        .from("artworks")
        .update({ image_path: originalPath, image_url: nextUrl })
        .eq("id", artwork.id)
        .select("id")
        .single();
      if (updateError || !updatedRow) throw updateError || new Error("Could not update artwork record.");
      databaseUpdated = true;
      setCurrentImagePath(originalPath);
      setCurrentImageUrl(nextUrl);
      if (replacementPreview) URL.revokeObjectURL(replacementPreview);
      setReplacementImage(null);
      setReplacementPreview(null);
      setMessage(
        \`Artwork updated. Website preview: \${Math.round(webPreview.size / 1024)} KB; print-quality original preserved.\`
      );
      router.refresh();
    } catch (error) {
      // If the DB did not change, remove ONLY the two newly uploaded objects.
      // Existing images, print masters and URLs are never deleted.
      if (!databaseUpdated) {
        const remove = [];
        if (originalUploaded) remove.push(originalPath);
        if (previewUploaded) remove.push(previewPath);
        if (remove.length) {
          const { error: cleanupError } = await supabase.storage.from("artworks").remove(remove);
          if (cleanupError) console.warn("Could not clean up failed new uploads:", cleanupError);
        }
      }
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Could not update image.");
    } finally {
      setReplacingImage(false);
    }
  }

`;
const prefix = source.includes(importLine)
  ? source
  : source.replace('import { createClient } from "@/lib/supabase/client";',
    'import { createClient } from "@/lib/supabase/client";\n' + importLine);
if (!prefix.includes(importLine)) throw new Error('Could not find existing Supabase import. No changes made.');
const a = prefix.indexOf(anchorA);
const b = prefix.indexOf(anchorB);
const result = prefix.slice(0, a) + replacement + prefix.slice(b);
if (result === source) throw new Error('No changes produced.');
const backup = target + '.before-auto-preview.bak';
if (fs.existsSync(backup)) throw new Error('A backup already exists: ' + backup + '. Save or remove it before retrying.');
fs.writeFileSync(backup, source);
fs.writeFileSync(target, result);
console.log('UPDATED:', target);
console.log('BACKUP:', backup);
console.log('The replacement-image handler now creates a WebP preview and preserves old originals.');
console.log('NewArtworkForm is intentionally not modified: its current source was not available to verify.');
