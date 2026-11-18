"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Collection = {
  id: string;
  title: string;
  slug: string;

  period:
    | string
    | null;

  introduction:
    | string
    | null;

  description:
    | string
    | null;

  hero_artwork_id:
    | string
    | null;

  hero_image_path:
    | string
    | null;

  hero_image_url:
    | string
    | null;

  published: boolean;

  sort_order: number;
};

type Artwork = {
  id: string;
  title: string;
  slug: string;

  image_url:
    | string
    | null;

  published: boolean;

  sort_order: number;
};

type HeroMode =
  | "artwork"
  | "custom"
  | "none";

export default function CollectionEditor({
  collection,
  artworks,
}: {
  collection: Collection;
  artworks: Artwork[];
}) {
  const router =
    useRouter();

  /*
   * BASIC COLLECTION INFO
   */

  const [
    title,
    setTitle,
  ] = useState(
    collection.title
  );

  const [
    period,
    setPeriod,
  ] = useState(
    collection.period ?? ""
  );

  const [
    introduction,
    setIntroduction,
  ] = useState(
    collection.introduction ??
      ""
  );

  const [
    description,
    setDescription,
  ] = useState(
    collection.description ??
      ""
  );

  const [
    published,
    setPublished,
  ] = useState(
    collection.published
  );

  /*
   * HERO STATE
   */

  const initialArtwork =
    useMemo(
      () =>
        artworks.find(
          (artwork) =>
            artwork.id ===
            collection.hero_artwork_id
        ) ?? null,
      [
        artworks,
        collection.hero_artwork_id,
      ]
    );

  const initialHeroMode:
    HeroMode =
      initialArtwork
        ? "artwork"
        : collection.hero_image_url
          ? "custom"
          : "none";

  const [
    heroMode,
    setHeroMode,
  ] = useState<HeroMode>(
    initialHeroMode
  );

  const [
    selectedArtworkId,
    setSelectedArtworkId,
  ] = useState<string | null>(
    initialArtwork?.id ??
      null
  );

  const [
    heroUrl,
    setHeroUrl,
  ] = useState<
    string | null
  >(
    collection.hero_image_url
  );

  const [
    heroPath,
    setHeroPath,
  ] = useState<
    string | null
  >(
    collection.hero_image_path
  );

  const [
    newHero,
    setNewHero,
  ] = useState<
    File | null
  >(
    null
  );

  const [
    preview,
    setPreview,
  ] = useState<
    string | null
  >(
    null
  );

  /*
   * UI STATE
   */

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  /*
   * CLEAN UP LOCAL IMAGE PREVIEW
   */

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(
          preview
        );
      }
    };
  }, [preview]);

  /*
   * SELECTED ARTWORK
   */

  const selectedArtwork =
    useMemo(
      () =>
        artworks.find(
          (artwork) =>
            artwork.id ===
            selectedArtworkId
        ) ?? null,
      [
        artworks,
        selectedArtworkId,
      ]
    );

  /*
   * HERO DISPLAY
   */

  const displayedHero =
    heroMode === "artwork"
      ? selectedArtwork
          ?.image_url ??
        null
      : heroMode ===
          "custom"
        ? preview ??
          heroUrl
        : null;

  /*
   * CUSTOM HERO FILE
   */

  function chooseHero(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      setMessage(
        "Hero image must be JPG, PNG or WEBP."
      );

      event.target.value =
        "";

      return;
    }

    if (
      file.size >
      50 * 1024 * 1024
    ) {
      setMessage(
        "Hero image must be smaller than 50 MB."
      );

      event.target.value =
        "";

      return;
    }

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setNewHero(file);

    setPreview(
      URL.createObjectURL(
        file
      )
    );

    setHeroMode(
      "custom"
    );

    setSelectedArtworkId(
      null
    );

    setMessage(
      "Custom hero selected. Save collection to apply it."
    );
  }

  /*
   * CHOOSE EXISTING ARTWORK
   */

  function selectArtworkHero(
    artwork: Artwork
  ) {
    if (
      !artwork.image_url
    ) {
      setMessage(
        "This artwork does not have an image."
      );

      return;
    }

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setPreview(null);

    setNewHero(null);

    setSelectedArtworkId(
      artwork.id
    );

    setHeroMode(
      "artwork"
    );

    setMessage(
      `"${artwork.title}" selected as collection hero. Save collection to apply it.`
    );
  }

  /*
   * REMOVE HERO
   */

  function removeHero() {
    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setPreview(null);

    setNewHero(null);

    setSelectedArtworkId(
      null
    );

    setHeroMode(
      "none"
    );

    setMessage(
      "Hero will be removed when you save the collection."
    );
  }

  /*
   * SAVE COLLECTION
   */

  async function save(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage(
        "Collection title is required."
      );

      return;
    }

    if (
      heroMode ===
        "artwork" &&
      !selectedArtwork
    ) {
      setMessage(
        "Choose an artwork for the collection hero."
      );

      return;
    }

    setSaving(true);

    setMessage(
      "Saving..."
    );

    let uploadedNewPath:
      | string
      | null = null;

    try {
      const supabase =
        createClient();

      let nextHeroArtworkId:
        | string
        | null = null;

      let nextHeroPath:
        | string
        | null = null;

      let nextHeroUrl:
        | string
        | null = null;

      /*
       * ARTWORK HERO
       */

      if (
        heroMode ===
          "artwork" &&
        selectedArtwork
      ) {
        nextHeroArtworkId =
          selectedArtwork.id;

        nextHeroPath =
          null;

        nextHeroUrl =
          selectedArtwork.image_url;
      }

      /*
       * CUSTOM HERO
       */

      if (
        heroMode ===
        "custom"
      ) {
        nextHeroArtworkId =
          null;

        /*
         * Upload a newly
         * selected file.
         */
        if (newHero) {
          const extension =
            getExtension(
              newHero
            );

          const path =
            `collection-heroes/${collection.id}-${Date.now()}.${extension}`;

          const {
            error:
              uploadError,
          } =
            await supabase.storage
              .from(
                "artworks"
              )
              .upload(
                path,
                newHero,
                {
                  upsert:
                    false,

                  cacheControl:
                    "3600",

                  contentType:
                    newHero.type,
                }
              );

          if (
            uploadError
          ) {
            throw uploadError;
          }

          uploadedNewPath =
            path;

          const {
            data:
              publicUrl,
          } =
            supabase.storage
              .from(
                "artworks"
              )
              .getPublicUrl(
                path
              );

          nextHeroPath =
            path;

          nextHeroUrl =
            publicUrl.publicUrl;
        } else {
          /*
           * Keep existing custom
           * hero if no new file
           * was chosen.
           */

          nextHeroPath =
            heroPath;

          nextHeroUrl =
            heroUrl;
        }
      }

      /*
       * NONE
       */

      if (
        heroMode === "none"
      ) {
        nextHeroArtworkId =
          null;

        nextHeroPath =
          null;

        nextHeroUrl =
          null;
      }

      /*
       * UPDATE DATABASE
       */

      const {
        error:
          updateError,
      } = await supabase
        .from(
          "collections"
        )
        .update({
          title:
            title.trim(),

          period:
            period.trim() ||
            null,

          introduction:
            introduction.trim() ||
            null,

          description:
            description.trim() ||
            null,

          hero_artwork_id:
            nextHeroArtworkId,

          hero_image_path:
            nextHeroPath,

          hero_image_url:
            nextHeroUrl,

          published,
        })
        .eq(
          "id",
          collection.id
        );

      if (
        updateError
      ) {
        /*
         * If DB update fails,
         * remove newly uploaded
         * custom image.
         */

        if (
          uploadedNewPath
        ) {
          await supabase.storage
            .from(
              "artworks"
            )
            .remove([
              uploadedNewPath,
            ]);
        }

        throw updateError;
      }

      /*
       * CLEAN OLD CUSTOM HERO
       *
       * Only remove it after the
       * DB update succeeds.
       */

      if (
        heroPath &&
        heroPath !==
          nextHeroPath
      ) {
        const {
          error:
            oldHeroDeleteError,
        } =
          await supabase.storage
            .from(
              "artworks"
            )
            .remove([
              heroPath,
            ]);

        if (
          oldHeroDeleteError
        ) {
          console.warn(
            "Collection saved, but the old custom hero could not be removed:",
            oldHeroDeleteError
          );
        }
      }

      /*
       * UPDATE LOCAL STATE
       */

      setHeroPath(
        nextHeroPath
      );

      setHeroUrl(
        nextHeroUrl
      );

      setSelectedArtworkId(
        nextHeroArtworkId
      );

      if (preview) {
        URL.revokeObjectURL(
          preview
        );
      }

      setPreview(null);

      setNewHero(null);

      setMessage(
        "Collection saved."
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save collection."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * SAFE COLLECTION DELETE
   */

  async function deleteCollection() {
    /*
     * Never delete a collection
     * containing artworks.
     */

    if (
      artworks.length >
      0
    ) {
      setMessage(
        `This collection contains ${artworks.length} artwork${
          artworks.length ===
          1
            ? ""
            : "s"
        }. Move or delete those artworks before deleting the collection.`
      );

      return;
    }

    const firstConfirmation =
      window.confirm(
        `Delete "${collection.title}"?\n\nThis collection is empty and will be permanently removed.`
      );

    if (
      !firstConfirmation
    ) {
      return;
    }

    const secondConfirmation =
      window.confirm(
        "This cannot be undone. Permanently delete this collection?"
      );

    if (
      !secondConfirmation
    ) {
      return;
    }

    setDeleting(true);

    setMessage(
      "Deleting collection..."
    );

    try {
      const supabase =
        createClient();

      /*
       * Delete DB row first.
       *
       * We only clean the custom
       * storage hero afterwards.
       */

      const {
        error:
          deleteError,
      } = await supabase
        .from(
          "collections"
        )
        .delete()
        .eq(
          "id",
          collection.id
        );

      if (
        deleteError
      ) {
        throw deleteError;
      }

      /*
       * Only heroPath belongs to
       * the collection itself.
       *
       * An artwork-selected hero has
       * no heroPath, so its artwork
       * image will never be deleted.
       */

      if (heroPath) {
        const {
          error:
            storageError,
        } =
          await supabase.storage
            .from(
              "artworks"
            )
            .remove([
              heroPath,
            ]);

        if (
          storageError
        ) {
          console.warn(
            "Collection deleted, but its custom hero file could not be removed:",
            storageError
          );
        }
      }

      router.push(
        "/studio/collections"
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete collection."
      );

      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={save}
    >
      {/* =====================================
          HEADER
      ====================================== */}

      <section className="border-b border-black/10 pb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Collection
        </p>

        <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
          {collection.title}
        </h1>
      </section>

      {/* =====================================
          HERO + INFORMATION
      ====================================== */}

      <section className="grid gap-12 border-b border-black/10 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        {/* HERO */}

        <div>
          <Label>
            Collection hero
          </Label>

          <div className="mt-3 relative aspect-[4/3] overflow-hidden border border-black/10 bg-black/[0.025]">
            {displayedHero ? (
              <img
                src={
                  displayedHero
                }
                alt={
                  collection.title
                }
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs uppercase tracking-[0.2em] text-black/30">
                  No hero selected
                </span>
              </div>
            )}

            {heroMode ===
              "artwork" &&
              selectedArtwork && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3 text-white">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/50">
                    Artwork hero
                  </p>

                  <p className="mt-1 text-xs">
                    {
                      selectedArtwork.title
                    }
                  </p>
                </div>
              )}

            {heroMode ===
              "custom" && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3 text-white">
                  <p className="text-[9px] uppercase tracking-[0.18em]">
                    Custom hero image
                  </p>
                </div>
              )}
          </div>

          {/* HERO MODE */}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setHeroMode(
                  "artwork"
                );

                setMessage(
                  "Choose an artwork below."
                );
              }}
              className={`border px-3 py-3 text-[9px] uppercase tracking-[0.15em] transition ${
                heroMode ===
                "artwork"
                  ? "border-black bg-black text-white"
                  : "border-black/15 hover:border-black"
              }`}
            >
              Artwork
            </button>

            <label
              className={`cursor-pointer border px-3 py-3 text-center text-[9px] uppercase tracking-[0.15em] transition ${
                heroMode ===
                "custom"
                  ? "border-black bg-black text-white"
                  : "border-black/15 hover:border-black"
              }`}
            >
              Upload

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  chooseHero
                }
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={
                removeHero
              }
              className={`border px-3 py-3 text-[9px] uppercase tracking-[0.15em] transition ${
                heroMode ===
                "none"
                  ? "border-black bg-black text-white"
                  : "border-black/15 hover:border-black"
              }`}
            >
              None
            </button>
          </div>

          {newHero && (
            <div className="mt-4 border border-black/10 p-4">
              <p className="truncate text-xs font-medium">
                {
                  newHero.name
                }
              </p>

              <p className="mt-1 text-[10px] text-black/35">
                {formatFileSize(
                  newHero.size
                )}
              </p>
            </div>
          )}

          <p className="mt-4 text-[10px] leading-5 text-black/35">
            Choose an artwork from
            this collection or upload
            a custom JPG, PNG or WEBP.
            Maximum upload size:
            50 MB.
          </p>
        </div>

        {/* INFORMATION */}

        <div>
          <h2 className="text-3xl font-medium tracking-[-0.04em]">
            Information
          </h2>

          <div className="mt-10 space-y-8">
            <Field
              label="Title"
              value={
                title
              }
              onChange={
                setTitle
              }
            />

            <Field
              label="Period / year"
              value={
                period
              }
              onChange={
                setPeriod
              }
              placeholder="2024 – 2026"
            />

            <div>
              <Label>
                Introduction
              </Label>

              <textarea
                value={
                  introduction
                }
                onChange={(
                  event
                ) =>
                  setIntroduction(
                    event
                      .target
                      .value
                  )
                }
                rows={4}
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none focus:border-black"
              />
            </div>

            <div>
              <Label>
                Collection story
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
                rows={10}
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none focus:border-black"
              />
            </div>

            <Toggle
              label="Published"
              checked={
                published
              }
              onChange={
                setPublished
              }
            />
          </div>
        </div>
      </section>

      {/* =====================================
          SELECT ARTWORK HERO
      ====================================== */}

      <section className="border-b border-black/10 py-12">
        <div className="flex flex-col gap-4 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              Hero artwork
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
              Choose from collection
            </h2>
          </div>

          <p className="max-w-sm text-xs leading-5 text-black/40">
            Selecting one of these
            artworks makes it the
            collection cover without
            creating another copy of
            the image.
          </p>
        </div>

        {artworks.length >
        0 ? (
          <div className="grid grid-cols-2 gap-4 pt-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {artworks.map(
              (artwork) => {
                const selected =
                  heroMode ===
                    "artwork" &&
                  selectedArtworkId ===
                    artwork.id;

                return (
                  <button
                    key={
                      artwork.id
                    }
                    type="button"
                    onClick={() =>
                      selectArtworkHero(
                        artwork
                      )
                    }
                    disabled={
                      !artwork.image_url
                    }
                    className={`group text-left transition ${
                      selected
                        ? "opacity-100"
                        : "opacity-70 hover:opacity-100"
                    } ${
                      !artwork.image_url
                        ? "cursor-not-allowed opacity-30"
                        : ""
                    }`}
                  >
                    <div
                      className={`relative aspect-[4/5] overflow-hidden border-2 bg-black/5 transition ${
                        selected
                          ? "border-black"
                          : "border-transparent"
                      }`}
                    >
                      {artwork.image_url ? (
                        <img
                          src={
                            artwork.image_url
                          }
                          alt={
                            artwork.title
                          }
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-black/25">
                          No image
                        </div>
                      )}

                      {selected && (
                        <div className="absolute left-3 top-3 bg-black px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white">
                          Current hero
                        </div>
                      )}
                    </div>

                    <p className="mt-3 truncate text-sm font-medium">
                      {
                        artwork.title
                      }
                    </p>

                    <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-black/35">
                      {artwork.published
                        ? "Published"
                        : "Draft"}
                    </p>
                  </button>
                );
              }
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-black/40">
            Add artwork to this
            collection before choosing
            an artwork hero.
          </div>
        )}
      </section>

      {/* =====================================
          ARTWORK CONTENTS
      ====================================== */}

      <section className="border-b border-black/10 py-12">
        <div className="flex items-end justify-between border-b border-black/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-black/40">
              Contents
            </p>

            <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
              Artworks
            </h2>
          </div>

          <span className="text-xs text-black/35">
            {
              artworks.length
            }{" "}
            works
          </span>
        </div>

        {artworks.length >
        0 ? (
          <div className="grid grid-cols-2 gap-4 pt-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {artworks.map(
              (artwork) => (
                <a
                  key={
                    artwork.id
                  }
                  href={`/studio/artworks/${artwork.id}/edit`}
                  className="group"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-black/5">
                    {artwork.image_url ? (
                      <img
                        src={
                          artwork.image_url
                        }
                        alt={
                          artwork.title
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-black/25">
                        No image
                      </div>
                    )}
                  </div>

                  <p className="mt-3 truncate text-sm font-medium">
                    {
                      artwork.title
                    }
                  </p>

                  <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-black/35">
                    {artwork.published
                      ? "Published"
                      : "Draft"}
                  </p>
                </a>
              )
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-black/40">
            No artworks in this
            collection.
          </div>
        )}
      </section>

      {/* =====================================
          DANGER ZONE
      ====================================== */}

      <section className="grid gap-10 border-b border-red-900/15 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-800/60">
            Danger zone
          </p>

          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            Delete collection
          </h2>

          <p className="mt-4 max-w-sm text-sm leading-6 text-black/45">
            Collection deletion is
            only available when the
            collection contains no
            artworks.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-6 border border-red-900/15 p-6 sm:flex-row sm:items-center">
          <div>
            {artworks.length >
            0 ? (
              <>
                <p className="text-sm font-medium">
                  Collection is not
                  empty
                </p>

                <p className="mt-2 max-w-lg text-xs leading-5 text-black/40">
                  Move or delete the{" "}
                  {
                    artworks.length
                  }{" "}
                  artwork
                  {artworks.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  in this collection
                  before deleting it.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Permanently delete
                </p>

                <p className="mt-2 max-w-lg text-xs leading-5 text-black/40">
                  This collection has
                  no artworks and can
                  be safely removed.
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={
              deleteCollection
            }
            disabled={
              deleting ||
              artworks.length >
                0
            }
            className="shrink-0 border border-red-800/40 px-5 py-3 text-[9px] uppercase tracking-[0.18em] text-red-800 transition hover:bg-red-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
          >
            {deleting
              ? "Deleting..."
              : "Delete collection"}
          </button>
        </div>
      </section>

      {/* =====================================
          SAVE BAR
      ====================================== */}

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
            disabled={
              saving ||
              deleting
            }
            className="bg-black px-8 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-70 disabled:opacity-40"
          >
            {saving
              ? "Saving..."
              : "Save collection"}
          </button>
        </div>
      </div>
    </form>
  );
}

/*
 * LABEL
 */

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

/*
 * FIELD
 */

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;

  value: string;

  onChange: (
    value: string
  ) => void;

  placeholder?: string;
}) {
  return (
    <div>
      <Label>
        {label}
      </Label>

      <input
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
        className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none placeholder:text-black/20 focus:border-black"
      />
    </div>
  );
}

/*
 * TOGGLE
 */

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
        aria-label={
          label
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

/*
 * IMAGE EXTENSION
 */

function getExtension(
  file: File
) {
  switch (
    file.type
  ) {
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

/*
 * FILE SIZE
 */

function formatFileSize(
  bytes: number
) {
  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}