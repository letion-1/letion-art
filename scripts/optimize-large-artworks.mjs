import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const files = [
  "public/artwork/Melatonia City/girl artwork 2.jpg",
  "public/artwork/Melatonia City/self-potrait 2.jpg",
  "public/artwork/Melatonia City/selfie artwork 2.jpg",
  "public/artwork/Photoshoot/photoshoot-4.0.png",
  "public/artwork/Thinking-Out-Loud/estate.jpg",
];

const backupRoot = path.join(
  root,
  "artwork-masters"
);

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

async function optimize(relativePath) {
  const source = path.join(
    root,
    relativePath
  );

  if (!fs.existsSync(source)) {
    console.log(
      `✗ Missing: ${relativePath}`
    );
    return;
  }

  const relativeFromArtwork =
    path.relative(
      path.join(root, "public", "artwork"),
      source
    );

  const backup = path.join(
    backupRoot,
    relativeFromArtwork
  );

  fs.mkdirSync(
    path.dirname(backup),
    { recursive: true }
  );

  if (!fs.existsSync(backup)) {
    fs.copyFileSync(
      source,
      backup
    );

    console.log(
      `✓ Master backed up: ${relativeFromArtwork}`
    );
  } else {
    console.log(
      `↳ Master backup already exists: ${relativeFromArtwork}`
    );
  }

  const extension =
    path.extname(source).toLowerCase();

  const temp =
    `${source}.optimized`;

  const image =
    sharp(source)
      .rotate()
      .resize({
        width: 3200,
        height: 3200,
        fit: "inside",
        withoutEnlargement: true,
      });

  if (
    extension === ".jpg" ||
    extension === ".jpeg"
  ) {
    await image
      .jpeg({
        quality: 88,
        progressive: true,
        mozjpeg: true,
      })
      .toFile(temp);
  } else if (
    extension === ".png"
  ) {
    await image
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
      })
      .toFile(temp);
  } else {
    throw new Error(
      `Unsupported extension: ${extension}`
    );
  }

  const before =
    fs.statSync(source).size;

  const after =
    fs.statSync(temp).size;

  fs.renameSync(
    temp,
    source
  );

  console.log(
    `✓ Optimized ${relativeFromArtwork}`
  );

  console.log(
    `  ${formatMB(before)} MB → ${formatMB(after)} MB`
  );
}

async function run() {
  console.log("");
  console.log(
    "LETION WEB IMAGE OPTIMIZER"
  );
  console.log(
    "──────────────────────────"
  );

  for (const file of files) {
    try {
      await optimize(file);
    } catch (error) {
      console.error(
        `✗ Failed: ${file}`
      );
      console.error(error);
    }
  }

  console.log("");
  console.log(
    "──────────────────────────"
  );

  console.log(
    "Finished."
  );

  console.log(
    `Masters: ${backupRoot}`
  );
}

run();