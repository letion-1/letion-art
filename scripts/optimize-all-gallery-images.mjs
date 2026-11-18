
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const artworkRoot = path.join(
  root,
  "public",
  "artwork"
);

const backupRoot = path.join(
  root,
  "artwork-masters"
);

// These settings affect only website images.
// High-resolution originals are backed up separately.
const MAX_DIMENSION = 2400;
const JPEG_QUALITY = 86;
const MIN_FILE_SIZE_MB = 2;

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function collectImages(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectImages(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(jpg|jpeg|png)$/i.test(entry.name)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

async function optimize(file) {
  const relative = path.relative(artworkRoot, file);
  const backup = path.join(backupRoot, relative);

  const currentSize = fs.statSync(file).size;

  if (currentSize < MIN_FILE_SIZE_MB * 1024 * 1024) {
    return {
      status: "skipped",
      saved: 0,
    };
  }

  // Preserve the original before any image processing.
  fs.mkdirSync(path.dirname(backup), {
    recursive: true,
  });

  if (!fs.existsSync(backup)) {
    fs.copyFileSync(file, backup);
  }

  // Always optimize from the preserved master.
  // This prevents repeated JPEG quality loss.
  const source = backup;
  const extension = path.extname(file).toLowerCase();

  const temp = `${file}.optimizing-${process.pid}${extension}`;

  try {
    let pipeline = sharp(source)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (extension === ".jpg" || extension === ".jpeg") {
      pipeline = pipeline.jpeg({
        quality: JPEG_QUALITY,
        progressive: true,
        mozjpeg: true,
      });
    } else {
      // Keep PNG as PNG and preserve transparency.
      // Do not convert artwork to a limited colour palette.
      pipeline = pipeline.png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: false,
      });
    }

    await pipeline.toFile(temp);

    const optimizedSize = fs.statSync(temp).size;

    // Never replace the website copy with a larger file.
    if (optimizedSize >= currentSize) {
      return {
        status: "skipped",
        saved: 0,
      };
    }

    fs.renameSync(temp, file);

    console.log(
      `${relative}: ${mb(currentSize)} MB -> ${mb(optimizedSize)} MB`
    );

    return {
      status: "optimized",
      saved: currentSize - optimizedSize,
    };
  } finally {
    if (fs.existsSync(temp)) {
      fs.unlinkSync(temp);
    }
  }
}

async function main() {
  if (!fs.existsSync(artworkRoot)) {
    throw new Error(
      `Artwork directory not found: ${artworkRoot}`
    );
  }

  console.log("LETION ART GALLERY OPTIMIZER");
  console.log("Website copies only");
  console.log(`Masters: ${backupRoot}`);
  console.log("");

  const files = collectImages(artworkRoot);

  let optimized = 0;
  let skipped = 0;
  let failed = 0;
  let totalSaved = 0;

  console.log(`Found ${files.length} artwork images.`);

  for (const file of files) {
    try {
      const result = await optimize(file);

      if (result.status === "optimized") {
        optimized++;
        totalSaved += result.saved;
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;
      console.error(
        `Failed: ${path.relative(artworkRoot, file)}`,
        error
      );
    }
  }

  console.log("");
  console.log("OPTIMIZATION COMPLETE");
  console.log(`Optimized: ${optimized}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Space saved: ${mb(totalSaved)} MB`);
  console.log(`Originals preserved in: ${backupRoot}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
