import "server-only";

import fs from "node:fs";
import path from "node:path";

import { collections } from "@/lib/collections";
import { artworkMetadata } from "@/lib/artworkMetadata";

export type Artwork = {
  slug: string;

  title: string;
  year?: number;
  medium?: string;
  description?: string;

  image: string;

  collection: string;

  featured: boolean;

  originalAvailable?: boolean;
  originalDimensions?: string;

  printsAvailable?: boolean;

  printSizes?: string[];

  print?: {
    currency?: string;
    price?: number;

    sizes?: {
      name: string;
      price?: number;
    }[];

    paper?: string;
    finish?: string;
    framed?: boolean;
    framingDetails?: string;
  };
};

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

function stripImageExtensions(filename: string) {
  let result = filename;

  while (
    imageExtensions.has(path.extname(result).toLowerCase())
  ) {
    result = result.slice(0, result.lastIndexOf("."));
  }

  return result;
}

function createTitle(filename: string) {
  return stripImageExtensions(filename)
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createImageUrl(folder: string, filename: string) {
  return [
    "/artwork",
    encodeURIComponent(folder),
    encodeURIComponent(filename),
  ].join("/");
}

function getArtworkFiles(folder: string) {
  const folderPath = path.join(
    process.cwd(),
    "public",
    "artwork",
    folder
  );

  if (!fs.existsSync(folderPath)) {
    return [];
  }

  return fs
    .readdirSync(folderPath, {
      withFileTypes: true,
    })
    .filter(
      (entry) =>
        entry.isFile() &&
        imageExtensions.has(
          path.extname(entry.name).toLowerCase()
        )
    )
    .map((entry) => entry.name)
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

const usedSlugs = new Set<string>();

function getUniqueSlug(
  title: string,
  collectionSlug: string
) {
  const baseSlug = createSlug(title);

  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }

  const collectionSlugged =
    `${collectionSlug}-${baseSlug}`;

  if (!usedSlugs.has(collectionSlugged)) {
    usedSlugs.add(collectionSlugged);
    return collectionSlugged;
  }

  let count = 2;

  while (
    usedSlugs.has(
      `${collectionSlugged}-${count}`
    )
  ) {
    count += 1;
  }

  const finalSlug =
    `${collectionSlugged}-${count}`;

  usedSlugs.add(finalSlug);

  return finalSlug;
}

export const artworks: Artwork[] = collections.flatMap(
  (collection) => {
    const files = getArtworkFiles(
      collection.folder
    );

    return files.map((filename) => {
      const metadataKey =
        `${collection.folder}/${filename}`;

      const metadata =
        artworkMetadata[metadataKey] ?? {};

      const fallbackTitle =
        createTitle(filename);

      const title =
        metadata.title ?? fallbackTitle;

      return {
        slug: getUniqueSlug(
          title,
          collection.slug
        ),

        title,

        year: metadata.year,

        medium: metadata.medium,

        description:
          metadata.description,

        image: createImageUrl(
          collection.folder,
          filename
        ),

        collection:
          collection.slug,

        featured:
          metadata.featured ?? false,

        originalAvailable:
          metadata.originalAvailable,

        originalDimensions:
          metadata.originalDimensions,

        printsAvailable:
          metadata.printsAvailable,

        printSizes:
          metadata.printSizes,

        print:
          metadata.print,
      };
    });
  }
);

export const featuredArtworks =
  artworks.filter(
    (artwork) => artwork.featured
  );