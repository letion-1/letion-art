"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCollectionForm() {
  const router = useRouter();

  const [title, setTitle] =
    useState("");

  const [period, setPeriod] =
    useState("");

  const [
    introduction,
    setIntroduction,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [published, setPublished] =
    useState(true);

  const [heroFile, setHeroFile] =
    useState<File | null>(null);

  const [
    heroPreview,
    setHeroPreview,
  ] = useState<string | null>(
    null
  );

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    return () => {
      if (heroPreview) {
        URL.revokeObjectURL(
          heroPreview
        );
      }
    };
  }, [heroPreview]);

  function selectHero(
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
        "Hero image must be JPG, PNG or WEBP."
      );

      return;
    }

    if (
      selected.size >
      50 * 1024 * 1024
    ) {
      setMessage(
        "Hero image must be smaller than 50 MB."
      );

      return;
    }

    if (heroPreview) {
      URL.revokeObjectURL(
        heroPreview
      );
    }

    setHeroFile(selected);

    setHeroPreview(
      URL.createObjectURL(
        selected
      )
    );

    setMessage("");
  }

  async function createCollection(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!title.trim()) {
      setMessage(
        "Collection title is required."
      );

      return;
    }

    setSaving(true);
    setMessage(
      "Creating collection..."
    );

    let uploadedPath:
      | string
      | null = null;

    try {
      const supabase =
        createClient();

      /*
       * Create a unique slug.
       */
      const baseSlug =
        createSlug(title);

      const slug =
        `${baseSlug}-${Date.now()}`;

      let heroImagePath:
        | string
        | null = null;

      let heroImageUrl:
        | string
        | null = null;

      /*
       * Upload hero if supplied.
       */
      if (heroFile) {
        const extension =
          getExtension(
            heroFile
          );

        heroImagePath =
          `collection-heroes/${slug}.${extension}`;

        uploadedPath =
          heroImagePath;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("artworks")
          .upload(
            heroImagePath,
            heroFile,
            {
              upsert: false,
              cacheControl:
                "3600",
              contentType:
                heroFile.type,
            }
          );

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: publicUrl,
        } = supabase.storage
          .from("artworks")
          .getPublicUrl(
            heroImagePath
          );

        heroImageUrl =
          publicUrl.publicUrl;
      }

      /*
       * Find next collection
       * display position.
       */
      const {
        data: lastCollection,
      } = await supabase
        .from("collections")
        .select("sort_order")
        .order("sort_order", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      const sortOrder =
        (
          lastCollection?.sort_order ??
          0
        ) + 1;

      /*
       * Create collection.
       */
      const {
        data: collection,
        error: insertError,
      } = await supabase
        .from("collections")
        .insert({
          title:
            title.trim(),

          slug,

          folder:
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

          hero_image_path:
            heroImagePath,

          hero_image_url:
            heroImageUrl,

          published,

          sort_order:
            sortOrder,
        })
        .select("id")
        .single();

      if (insertError) {
        if (uploadedPath) {
          await supabase.storage
            .from("artworks")
            .remove([
              uploadedPath,
            ]);
        }

        throw insertError;
      }

      router.push(
        `/studio/collections/${collection.id}/edit`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create collection."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={
        createCollection
      }
    >
      {/* INTRO */}
      <section className="border-b border-black/10 pb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-black/40">
          Studio / Collections
        </p>

        <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
          New collection
        </h1>

        <p className="mt-5 max-w-xl text-base leading-7 text-black/50">
          Create a new body of
          work for the
          catalogue.
        </p>
      </section>

      <section className="grid gap-12 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        {/* HERO */}
        <div>
          <Label>
            Collection hero
          </Label>

          <label className="mt-3 block cursor-pointer">
            <div className="aspect-[4/3] overflow-hidden border border-dashed border-black/25 bg-black/[0.025] transition hover:border-black">
              {heroPreview ? (
                <img
                  src={
                    heroPreview
                  }
                  alt="Collection hero preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <span className="text-4xl font-light">
                    +
                  </span>

                  <p className="mt-4 text-xs uppercase tracking-[0.2em]">
                    Add hero image
                  </p>

                  <p className="mt-3 text-xs text-black/35">
                    Optional
                  </p>
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={
                selectHero
              }
              className="hidden"
            />
          </label>

          {heroFile && (
            <p className="mt-3 truncate text-xs text-black/40">
              {heroFile.name}
            </p>
          )}
        </div>

        {/* INFORMATION */}
        <div>
          <h2 className="text-3xl font-medium tracking-[-0.04em]">
            Collection information
          </h2>

          <div className="mt-10 space-y-8">
            <Field
              label="Collection title"
              value={title}
              onChange={
                setTitle
              }
              placeholder="New collection"
            />

            <Field
              label="Period / year"
              value={period}
              onChange={
                setPeriod
              }
              placeholder="2026"
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
                placeholder="A short introduction shown near the beginning of the collection..."
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none placeholder:text-black/20 focus:border-black"
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
                placeholder="Tell the story behind this body of work..."
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none placeholder:text-black/20 focus:border-black"
              />
            </div>

            <Toggle
              label="Publish collection"
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

      {/* CREATE BAR */}
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
              : "Create collection"}
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

  return (
    slug ||
    "collection"
  );
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