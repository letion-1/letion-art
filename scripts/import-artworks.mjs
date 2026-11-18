import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL in .env.local"
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const artworkRoot = path.join(
  process.cwd(),
  "public",
  "artwork"
);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const collectionDefinitions = [
  {
    folder: "Melatonia City",
    slug: "melatonia-city",
    title: "MELATONIA CITY",
    sortOrder: 1,
  },
  {
    folder: "Photoshoot",
    slug: "photoshoot",
    title: "PHOTOSHOOT",
    sortOrder: 2,
  },
  {
    folder: "Point-Of-View",
    slug: "point-of-view",
    title: "POINT OF VIEW",
    sortOrder: 3,
  },
  {
    folder: "Thinking-Out-Loud",
    slug: "thinking-out-loud",
    title: "THINKING OUT LOUD",
    sortOrder: 4,
  },
  {
    folder: "What-The-Duck",
    slug: "what-the-duck",
    title: "WHAT THE DUCK",
    sortOrder: 5,
  },
];

function stripImageExtensions(filename) {
  let result = filename;

  while (
    allowedExtensions.has(
      path.extname(result).toLowerCase()
    )
  ) {
    result = result.slice(
      0,
      result.lastIndexOf(".")
    );
  }

  return result;
}

function createTitle(filename) {
  return stripImageExtensions(filename)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getContentType(filename) {
  const extension =
    path.extname(filename).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";

    case ".png":
      return "image/png";

    case ".webp":
      return "image/webp";

    default:
      return "application/octet-stream";
  }
}

function getFiles(folderName) {
  const folderPath = path.join(
    artworkRoot,
    folderName
  );

  if (!fs.existsSync(folderPath)) {
    console.warn(
      `⚠ Folder not found: ${folderName}`
    );

    return [];
  }

  return fs
    .readdirSync(folderPath, {
      withFileTypes: true,
    })
    .filter((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      return allowedExtensions.has(
        path.extname(entry.name).toLowerCase()
      );
    })
    .map((entry) => entry.name)
    .sort((a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      )
    );
}

async function ensureCollection(
  collection
) {
  const { data: existing, error: lookupError } =
    await supabase
      .from("collections")
      .select("id, slug")
      .eq("slug", collection.slug)
      .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    console.log(
      `✓ Collection exists: ${collection.title}`
    );

    return existing.id;
  }

  const { data, error } =
    await supabase
      .from("collections")
      .insert({
        slug: collection.slug,
        title: collection.title,
        folder: collection.folder,
        introduction: "",
        description: "",
        published: true,
        sort_order:
          collection.sortOrder,
      })
      .select("id")
      .single();

  if (error) {
    throw error;
  }

  console.log(
    `✓ Created collection: ${collection.title}`
  );

  return data.id;
}

async function artworkAlreadyExists(
  sourceKey
) {
  const { data, error } =
    await supabase
      .from("artworks")
      .select("id")
      .eq("source_key", sourceKey)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function slugAlreadyExists(slug) {
  const { data, error } =
    await supabase
      .from("artworks")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function createUniqueSlug(
  title,
  collectionSlug
) {
  const baseSlug =
    createSlug(title) || "artwork";

  if (
    !(await slugAlreadyExists(baseSlug))
  ) {
    return baseSlug;
  }

  const collectionSlugged =
    `${collectionSlug}-${baseSlug}`;

  if (
    !(
      await slugAlreadyExists(
        collectionSlugged
      )
    )
  ) {
    return collectionSlugged;
  }

  let count = 2;

  while (
    await slugAlreadyExists(
      `${collectionSlugged}-${count}`
    )
  ) {
    count += 1;
  }

  return `${collectionSlugged}-${count}`;
}

async function uploadArtwork({
  collection,
  collectionId,
  filename,
  index,
}) {
  const sourceKey =
    `${collection.folder}/${filename}`;

  const existing =
    await artworkAlreadyExists(
      sourceKey
    );

  if (existing) {
    console.log(
      `  ↳ Already imported: ${filename}`
    );

    return "skipped";
  }

  const localFilePath = path.join(
    artworkRoot,
    collection.folder,
    filename
  );

  const extension =
    path.extname(filename).toLowerCase();

  const title =
    createTitle(filename);

  const slug =
    await createUniqueSlug(
      title,
      collection.slug
    );

  const storageFilename =
    `${slug}${extension}`;

  const storagePath =
    `${collection.slug}/${storageFilename}`;

  const fileBuffer =
    fs.readFileSync(localFilePath);

  console.log(
    `  ↑ Uploading: ${filename}`
  );

  const {
    error: uploadError,
  } = await supabase.storage
    .from("artworks")
    .upload(
      storagePath,
      fileBuffer,
      {
        contentType:
          getContentType(filename),

        upsert: false,

        cacheControl: "3600",
      }
    );

  if (uploadError) {
    const message =
      uploadError.message ?? "";

    const duplicate =
      message
        .toLowerCase()
        .includes("already exists") ||
      message
        .toLowerCase()
        .includes("duplicate");

    if (!duplicate) {
      throw uploadError;
    }

    console.log(
      `  ↳ Storage file already exists: ${storagePath}`
    );
  }

  const {
    data: publicUrlData,
  } = supabase.storage
    .from("artworks")
    .getPublicUrl(storagePath);

  const imageUrl =
    publicUrlData.publicUrl;

  const {
    error: insertError,
  } = await supabase
    .from("artworks")
    .insert({
      slug,
      source_key: sourceKey,

      collection_id:
        collectionId,

      title,

      image_path:
        storagePath,

      image_url:
        imageUrl,

      featured: false,

      original_available:
        false,

      prints_available:
        false,

      published: true,

      sort_order:
        index + 1,
    });

  if (insertError) {
    throw insertError;
  }

  console.log(
    `  ✓ Imported: ${title}`
  );

  return "imported";
}

async function run() {
  console.log("");
  console.log(
    "LET​ION STUDIO IMPORT"
  );
  console.log(
    "────────────────────────"
  );

  if (!fs.existsSync(artworkRoot)) {
    throw new Error(
      `Artwork directory not found: ${artworkRoot}`
    );
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let discovered = 0;

  for (
    const collection
    of collectionDefinitions
  ) {
    console.log("");
    console.log(
      `🎨 ${collection.title}`
    );

    const collectionId =
      await ensureCollection(
        collection
      );

    const files =
      getFiles(
        collection.folder
      );

    discovered +=
      files.length;

    console.log(
      `Found ${files.length} image(s)`
    );

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const filename =
        files[index];

      try {
        const result =
          await uploadArtwork({
            collection,
            collectionId,
            filename,
            index,
          });

        if (
          result === "imported"
        ) {
          imported += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;

        console.error(
          `  ✗ Failed: ${filename}`
        );

        console.error(
          error
        );
      }
    }
  }

  console.log("");
  console.log(
    "────────────────────────"
  );

  console.log(
    `Discovered: ${discovered}`
  );

  console.log(
    `Imported:   ${imported}`
  );

  console.log(
    `Skipped:    ${skipped}`
  );

  console.log(
    `Failed:     ${failed}`
  );

  console.log(
    "────────────────────────"
  );

  if (discovered !== 76) {
    console.log("");
    console.warn(
      `⚠ Expected 76 artworks, but found ${discovered}.`
    );

    console.warn(
      "Do not panic. Check the folder counts above so we can find the missing or extra file."
    );
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("");
  console.error(
    "IMPORT FAILED"
  );

  console.error(error);

  process.exit(1);
});