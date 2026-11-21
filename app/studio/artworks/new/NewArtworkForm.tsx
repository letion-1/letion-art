"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { uploadNewArtworkWithPreview } from "@/lib/studio/uploadNewArtworkWithPreview";

type Collection = {
  id: string;
  title: string;
  slug: string;
};

export default function NewArtworkForm({
  collections,
}: {
  collections: Collection[];
}) {
  const router = useRouter();

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<string | null>(null);

  const [title, setTitle] =
    useState("");

  const [collectionId, setCollectionId] =
    useState("");

  const [year, setYear] =
    useState("");

  const [medium, setMedium] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [
    originalAvailable,
    setOriginalAvailable,
  ] = useState(false);

  const [
    originalStatus,
    setOriginalStatus,
  ] = useState("not_for_sale");

  const [
    originalDimensions,
    setOriginalDimensions,
  ] = useState("");

  const [
    originalPrice,
    setOriginalPrice,
  ] = useState("");

  const [
    originalCurrency,
    setOriginalCurrency,
  ] = useState("EUR");

  const [
    printsAvailable,
    setPrintsAvailable,
  ] = useState(false);

  const [
    editionType,
    setEditionType,
  ] = useState("");

  const [
    editionSize,
    setEditionSize,
  ] = useState("");

  const [featured, setFeatured] =
    useState(false);

  const [published, setPublished] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function selectImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      event.target.files?.[0];

    if (!selected) {
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(selected.type)
    ) {
      setMessage(
        "Please choose a JPG, PNG or WEBP image."
      );

      return;
    }

    if (
      selected.size >
      50 * 1024 * 1024
    ) {
      setMessage(
        "This image is larger than 50 MB. Please use an optimized web copy."
      );

      return;
    }

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setFile(selected);

    setPreview(
      URL.createObjectURL(
        selected
      )
    );

    setMessage("");

    if (!title.trim()) {
      setTitle(
        filenameToTitle(
          selected.name
        )
      );
    }
  }

  async function createArtwork(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!file) {
      setMessage(
        "Choose an artwork image first."
      );

      return;
    }

    if (!title.trim()) {
      setMessage(
        "Artwork title is required."
      );

      return;
    }

    if (!collectionId) {
      setMessage(
        "Choose a collection."
      );

      return;
    }

    const parsedOriginalPrice =
      originalPrice.trim()
        ? Number(originalPrice)
        : null;

    if (
      parsedOriginalPrice !== null &&
      (
        Number.isNaN(
          parsedOriginalPrice
        ) ||
        parsedOriginalPrice < 0
      )
    ) {
      setMessage(
        "Enter a valid original price."
      );

      return;
    }

    const parsedEditionSize =
      editionSize.trim()
        ? Number(editionSize)
        : null;

    if (
      parsedEditionSize !== null &&
      (
        Number.isNaN(
          parsedEditionSize
        ) ||
        !Number.isInteger(
          parsedEditionSize
        ) ||
        parsedEditionSize < 1
      )
    ) {
      setMessage(
        "Edition size must be a whole number."
      );

      return;
    }

    setSaving(true);
    setMessage(
      "Creating artwork..."
    );

    // A stable identifier lets us verify whether a failed insert actually saved.
    const sourceKey = `studio/${crypto.randomUUID()}`;
    let uploadedPaths: string[] = [];

    try {
      const supabase =
        createClient();

      const collection =
        collections.find(
          (item) =>
            item.id ===
            collectionId
        );

      if (!collection) {
        throw new Error(
          "Selected collection could not be found."
        );
      }

      const baseSlug =
        createSlug(title);

      const slug =
        `${baseSlug}-${Date.now()}`;

      const extension =
        getExtension(file);

      const storagePath =
        `${collection.slug}/${slug}.${extension}`;

      /*
       * 1. Upload artwork image
       */
      const {
        error: uploadError,
        previewPath,
      } = await uploadNewArtworkWithPreview(supabase, storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (uploadError) {
        throw uploadError;
      }
      if (!previewPath) {
        throw new Error("The optimized preview was not created. Artwork creation stopped.");
      }
      // The next database operations may fail. Track only freshly uploaded paths.
      uploadedPaths = [storagePath, previewPath];

      /*
       * 2. Get public image URL
       */
      const {
        data: publicUrlData,
      } = supabase.storage
        .from("artworks")
        .getPublicUrl(previewPath);

      /*
       * 3. Find next position
       */
      const {
        data: lastArtwork,
      } = await supabase
        .from("artworks")
        .select("sort_order")
        .eq(
          "collection_id",
          collectionId
        )
        .order(
          "sort_order",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      const nextSortOrder =
        (
          lastArtwork?.sort_order ??
          0
        ) + 1;

      /*
       * 4. Create database record
       */
      const {
        data: artwork,
        error: insertError,
      } = await supabase
        .from("artworks")
        .insert({
          title:
            title.trim(),

          slug,

          source_key:
            sourceKey,

          collection_id:
            collectionId,

          year:
            year.trim() ||
            null,

          medium:
            medium.trim() ||
            null,

          description:
            description.trim() ||
            null,

          image_path:
            storagePath,

          image_url:
            publicUrlData.publicUrl,

          featured,

          published,

          original_available:
            originalAvailable,

          original_status:
            originalAvailable
              ? originalStatus ===
                "not_for_sale"
                ? "available"
                : originalStatus
              : "not_for_sale",

          original_dimensions:
            originalDimensions.trim() ||
            null,

          original_price:
            parsedOriginalPrice,

          original_currency:
            originalCurrency,

          prints_available:
            printsAvailable,

          edition_type:
            editionType.trim() ||
            null,

          edition_size:
            parsedEditionSize,

          sort_order:
            nextSortOrder,
        })
        .select("id")
        .single();

      if (insertError || !artwork) {
        throw insertError ?? new Error("Could not confirm artwork creation.");
      }

      // The artwork row now refers to both files. Never remove them in catch.
      uploadedPaths = [];

      setMessage(
        "Artwork created."
      );

      router.push(
        `/studio/artworks/${artwork.id}/edit`
      );

      router.refresh();
    } catch (error) {
      console.error(error);
      let recoveryNote = "";

      if (uploadedPaths.length) {
        try {
          const cleanupClient = createClient();
          // An insert can commit even if its response is lost. Check first.
          const { data: existing, error: lookupError } = await cleanupClient
            .from("artworks")
            .select("id")
            .eq("source_key", sourceKey)
            .limit(1)
            .maybeSingle();

          if (lookupError) {
            console.warn("Could not verify upload before cleanup:", lookupError);
            recoveryNote = " Uploaded files were preserved because the database state could not be verified.";
          } else if (existing) {
            recoveryNote = " This artwork may already exist in Studio; check the catalogue before retrying.";
          } else {
            const { error: cleanupError } = await cleanupClient.storage
              .from("artworks")
              .remove(uploadedPaths);
            if (cleanupError) {
              console.warn("Could not clean up failed artwork upload:", cleanupError);
              recoveryNote = " The database save failed, and some uploaded files may require manual storage cleanup.";
            }
          }
        } catch (cleanupError) {
          console.warn("Could not finish upload recovery:", cleanupError);
          recoveryNote = " Uploaded files were left untouched because cleanup could not be verified.";
        }
      }

      setMessage(
        (error instanceof Error ? error.message : "Could not create artwork.") + recoveryNote
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={
        createArtwork
      }
    >
      {/* INTRO */}
      <section className="border-b border-black/10 pb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Studio / Catalogue
        </p>

        <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
          New artwork
        </h1>

        <p className="mt-5 max-w-xl text-base leading-7 text-black/50">
          Add a new work to
          your catalogue and
          decide how it appears
          and sells.
        </p>
      </section>

      {/* IMAGE + DETAILS */}
      <section className="grid gap-10 border-b border-black/10 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Label>
            Artwork image
          </Label>

          <label className="mt-3 block cursor-pointer">
            <div className="relative aspect-[4/5] overflow-hidden border border-dashed border-black/25 bg-black/[0.025] transition hover:border-black">
              {preview ? (
                <img
                  src={
                    preview
                  }
                  alt="Artwork preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <span className="text-4xl font-light">
                    +
                  </span>

                  <p className="mt-4 text-xs uppercase tracking-[0.2em]">
                    Choose artwork
                  </p>

                  <p className="mt-3 text-xs leading-5 text-black/35">
                    JPG, PNG or WEBP
                    <br />
                    Maximum 50 MB
                  </p>
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={
                selectImage
              }
              className="hidden"
            />
          </label>

          {file && (
            <div className="mt-4 flex items-start justify-between gap-4 text-xs">
              <span className="max-w-[75%] truncate text-black/55">
                {file.name}
              </span>

              <span className="text-black/35">
                {formatFileSize(
                  file.size
                )}
              </span>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-3xl font-medium tracking-[-0.04em]">
            Artwork information
          </h2>

          <div className="mt-10 space-y-8">
            <Field
              label="Title"
              value={title}
              onChange={
                setTitle
              }
              placeholder="Artwork title"
            />

            <div>
              <Label>
                Collection
              </Label>

              <select
                required
                value={
                  collectionId
                }
                onChange={(
                  event
                ) =>
                  setCollectionId(
                    event
                      .target
                      .value
                  )
                }
                className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none focus:border-black"
              >
                <option value="">
                  Select collection
                </option>

                {collections.map(
                  (
                    collection
                  ) => (
                    <option
                      key={
                        collection.id
                      }
                      value={
                        collection.id
                      }
                    >
                      {
                        collection.title
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <Field
                label="Year"
                value={year}
                onChange={
                  setYear
                }
                placeholder="2026"
              />

              <Field
                label="Medium"
                value={medium}
                onChange={
                  setMedium
                }
                placeholder="Acrylic on canvas"
              />
            </div>

            <div>
              <Label>
                Story / description
              </Label>

              <textarea
                value={
                  description
                }
                onChange={(
                  event
                ) =>
                  setDescription(
                    event
                      .target
                      .value
                  )
                }
                rows={8}
                placeholder="Write about the work..."
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none placeholder:text-black/20 focus:border-black"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ORIGINAL */}
      <section className="grid gap-10 border-b border-black/10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <SectionHeading
          eyebrow="Commerce / 01"
          title="Original"
          description="Sell the physical original independently from any print editions."
        />

        <div className="space-y-8">
          <Toggle
            label="Original available for sale"
            checked={
              originalAvailable
            }
            onChange={(
              value
            ) => {
              setOriginalAvailable(
                value
              );

              if (value) {
                setOriginalStatus(
                  "available"
                );
              } else {
                setOriginalStatus(
                  "not_for_sale"
                );
              }
            }}
          />

          {originalAvailable && (
            <>
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <Label>
                    Status
                  </Label>

                  <select
                    value={
                      originalStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setOriginalStatus(
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none"
                  >
                    <option value="available">
                      Available
                    </option>

                    <option value="reserved">
                      Reserved
                    </option>

                    <option value="sold">
                      Sold
                    </option>
                  </select>
                </div>

                <Field
                  label="Dimensions"
                  value={
                    originalDimensions
                  }
                  onChange={
                    setOriginalDimensions
                  }
                  placeholder="120 × 90 cm"
                />
              </div>

              <div className="grid gap-8 md:grid-cols-[1fr_160px]">
                <Field
                  label="Price"
                  value={
                    originalPrice
                  }
                  onChange={
                    setOriginalPrice
                  }
                  placeholder="4500"
                  type="number"
                />

                <div>
                  <Label>
                    Currency
                  </Label>

                  <select
                    value={
                      originalCurrency
                    }
                    onChange={(
                      event
                    ) =>
                      setOriginalCurrency(
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none"
                  >
                    <option value="EUR">
                      EUR
                    </option>

                    <option value="USD">
                      USD
                    </option>

                    <option value="GBP">
                      GBP
                    </option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* PRINTS */}
      <section className="grid gap-10 border-b border-black/10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <SectionHeading
          eyebrow="Commerce / 02"
          title="Prints"
          description="Enable print editions for this work. Individual print sizes and prices can be added immediately after creation."
        />

        <div>
          <Toggle
            label="Prints available"
            checked={
              printsAvailable
            }
            onChange={
              setPrintsAvailable
            }
          />

          {printsAvailable && (
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <Field
                label="Edition type"
                value={
                  editionType
                }
                onChange={
                  setEditionType
                }
                placeholder="Limited edition"
              />

              <Field
                label="Edition size"
                value={
                  editionSize
                }
                onChange={
                  setEditionSize
                }
                placeholder="50"
                type="number"
              />
            </div>
          )}

          {printsAvailable && (
            <p className="mt-6 text-xs leading-6 text-black/40">
              After creating
              the artwork,
              you'll be taken
              to its editor
              where you can
              add each print
              size, paper,
              framing option
              and price.
            </p>
          )}
        </div>
      </section>

      {/* WEBSITE */}
      <section className="grid gap-10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <SectionHeading
          eyebrow="Website"
          title="Visibility"
          description="Control whether the artwork is public and whether it should receive additional prominence."
        />

        <div className="space-y-5">
          <Toggle
            label="Publish on website"
            checked={
              published
            }
            onChange={
              setPublished
            }
          />

          <Toggle
            label="Featured artwork"
            checked={
              featured
            }
            onChange={
              setFeatured
            }
          />
        </div>
      </section>

      {/* SAVE */}
      <div className="sticky bottom-0 z-30 border-t border-black/10 bg-[#f3f0e9]/95 py-5 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {message && (
              <p className="text-sm text-black/55">
                {message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-black px-8 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? "Creating..."
              : "Create artwork"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Label({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <label className="text-[10px] uppercase tracking-[0.2em] text-black/40">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label>
        {label}
      </Label>

      <input
        type={type}
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        min={
          type === "number"
            ? "0"
            : undefined
        }
        step={
          type === "number"
            ? "0.01"
            : undefined
        }
        className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none placeholder:text-black/20 focus:border-black"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-black/10 py-4">
      <span className="text-sm">
        {label}
      </span>

      <button
        type="button"
        aria-pressed={
          checked
        }
        onClick={() =>
          onChange(
            !checked
          )
        }
        className={`relative h-7 w-12 rounded-full transition ${
          checked
            ? "bg-black"
            : "bg-black/15"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-black/40">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
        {title}
      </h2>

      <p className="mt-4 max-w-sm text-sm leading-6 text-black/45">
        {description}
      </p>
    </div>
  );
}

function createSlug(
  value: string
) {
  const slug =
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return slug || "artwork";
}

function filenameToTitle(
  filename: string
) {
  return filename
    .replace(
      /\.(jpg|jpeg|png|webp)$/i,
      ""
    )
    .replace(
      /[-_]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function getExtension(
  file: File
) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      return "jpg";
  }
}

function formatFileSize(
  bytes: number
) {
  const mb =
    bytes /
    1024 /
    1024;

  return `${mb.toFixed(2)} MB`;
}
