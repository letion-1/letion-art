"use client";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Collection = {
  id: string;
  title: string;
  slug: string;
};
type Artwork = {
  id: string;
  title: string;
  slug: string;
  collection_id: string | null;
  year: string | null;
  medium: string | null;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  featured: boolean;
  published: boolean;
  original_available: boolean;
  original_dimensions: string | null;
  original_price: number | null;
  original_currency: string;
  original_status: string;
  prints_available: boolean;
  edition_type: string | null;
  edition_size: number | null;
};
type PrintVariant = {
  id: string;
  artwork_id: string;
  name: string;
  size_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
  price: number | null;
  currency: string;
  paper: string | null;
  finish: string | null;
  framed: boolean;
  frame_style: string | null;
  framing_details: string | null;
  creativehub_sku: string | null;
  creativehub_product_id: string | null;
  creativehub_variant_id: string | null;
  estimated_fulfilment_cost: number | null;
  fulfilment_currency: string;
  active: boolean;
  sort_order: number;
};
type VariantField =
  keyof PrintVariant;
type VariantValue =
  | string
  | number
  | boolean
  | null;
const SIZE_PRESETS = [
  { name: "Small", width: 210, height: 297, label: "21 × 29.7 cm" },
  { name: "Medium", width: 280, height: 350, label: "28 × 35 cm" },
  { name: "Large", width: 400, height: 500, label: "40 × 50 cm" },
  { name: "Statement", width: 600, height: 800, label: "60 × 80 cm" },
] as const;

export default function ArtworkEditor({
  artwork,
  collections,
  initialVariants,
}: {
  artwork: Artwork;
  collections: Collection[];
  initialVariants: PrintVariant[];
}) {
  const router =
    useRouter();
  const [form, setForm] =
    useState({
      title:
        artwork.title ?? "",
      collection_id:
        artwork.collection_id ?? "",
      year:
        artwork.year ?? "",
      medium:
        artwork.medium ?? "",
      description:
        artwork.description ?? "",
      featured:
        artwork.featured ?? false,
      published:
        artwork.published ?? false,
      original_available:
        artwork.original_available ??
        false,
      original_dimensions:
        artwork.original_dimensions ??
        "",
      original_price:
        artwork.original_price?.toString() ??
        "",
      original_currency:
        artwork.original_currency ??
        "EUR",
      original_status:
        artwork.original_status ??
        "not_for_sale",
      prints_available:
        artwork.prints_available ??
        false,
      edition_type:
        artwork.edition_type ??
        "",
      edition_size:
        artwork.edition_size?.toString() ??
        "",
    });
  const [
    variants,
    setVariants,
  ] = useState<PrintVariant[]>(
    initialVariants
  );
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);
  const [presetFramed, setPresetFramed] = useState(false);
  const [presetLandscape, setPresetLandscape] = useState(false);
  const [creatingPresets, setCreatingPresets] = useState(false);

  const [
    currentImageUrl,
    setCurrentImageUrl,
  ] = useState<string | null>(
    artwork.image_url
  );
  const [
    currentImagePath,
    setCurrentImagePath,
  ] = useState<string | null>(
    artwork.image_path
  );
  const [
    replacementImage,
    setReplacementImage,
  ] = useState<File | null>(
    null
  );
  const [
    replacementPreview,
    setReplacementPreview,
  ] = useState<string | null>(
    null
  );
  const [
    replacingImage,
    setReplacingImage,
  ] = useState(false);
  const [
    deletingArtwork,
    setDeletingArtwork,
  ] = useState(false);
  const [
    saving,
    setSaving,
  ] = useState(false);
  const [
    message,
    setMessage,
  ] = useState("");
  useEffect(() => {
    return () => {
      if (
        replacementPreview
      ) {
        URL.revokeObjectURL(
          replacementPreview
        );
      }
    };
  }, [
    replacementPreview,
  ]);
  function updateField(
    name:
      keyof typeof form,
    value:
      string | boolean
  ) {
    setForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }
  /*
   * =====================================
   * SAVE ARTWORK
   * =====================================
   */
  async function saveArtwork(
    event: FormEvent
  ) {
    event.preventDefault();
    if (
      !form.title.trim()
    ) {
      setMessage(
        "Artwork title is required."
      );
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const supabase =
        createClient();
      const originalPrice =
        form.original_price.trim()
          ? Number(
              form.original_price
            )
          : null;
      const editionSize =
        form.edition_size.trim()
          ? Number(
              form.edition_size
            )
          : null;
      if (
        originalPrice !==
          null &&
        (
          Number.isNaN(
            originalPrice
          ) ||
          originalPrice < 0
        )
      ) {
        setMessage(
          "Original price must be a valid positive number."
        );
        return;
      }
      if (
        editionSize !==
          null &&
        (
          Number.isNaN(
            editionSize
          ) ||
          !Number.isInteger(
            editionSize
          ) ||
          editionSize < 1
        )
      ) {
        setMessage(
          "Edition size must be a positive whole number."
        );
        return;
      }
      const {
        error:
          artworkError,
      } = await supabase
        .from("artworks")
        .update({
          title:
            form.title.trim(),
          collection_id:
            form.collection_id ||
            null,
          year:
            form.year.trim() ||
            null,
          medium:
            form.medium.trim() ||
            null,
          description:
            form.description.trim() ||
            null,
          featured:
            form.featured,
          published:
            form.published,
          original_available:
            form.original_available,
          original_dimensions:
            form.original_dimensions.trim() ||
            null,
          original_price:
            originalPrice,
          original_currency:
            form.original_currency,
          original_status:
            form.original_status,
          prints_available:
            form.prints_available,
          edition_type:
            form.edition_type.trim() ||
            null,
          edition_size:
            editionSize,
        })
        .eq(
          "id",
          artwork.id
        );
      if (
        artworkError
      ) {
        throw artworkError;
      }
      setMessage(
        "Artwork saved."
      );
      router.refresh();
    } catch (error) {
      console.error(
        error
      );
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Could not save artwork."
      );
    } finally {
      setSaving(false);
    }
  }
  /* Existing artwork editor section */

  function selectReplacementImage(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];
    if (!file) {
      return;
    }
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (
      !allowed.includes(
        file.type
      )
    ) {
      setMessage(
        "Image must be JPG, PNG or WEBP."
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
        "Image must be smaller than 50 MB."
      );
      event.target.value =
        "";
      return;
    }
    if (
      replacementPreview
    ) {
      URL.revokeObjectURL(
        replacementPreview
      );
    }
    setReplacementImage(
      file
    );
    setReplacementPreview(
      URL.createObjectURL(
        file
      )
    );
    setMessage(
      "New image selected."
    );
  }
  function cancelReplacementImage() {
    if (
      replacementPreview
    ) {
      URL.revokeObjectURL(
        replacementPreview
      );
    }
    setReplacementImage(
      null
    );
    setReplacementPreview(
      null
    );
    setMessage("");
  }
  async function replaceArtworkImage() {
    if (
      !replacementImage
    ) {
      return;
    }
    setReplacingImage(
      true
    );
    setMessage(
      "Replacing image..."
    );
    let uploadedPath:
      | string
      | null = null;
    try {
      const supabase =
        createClient();
      const extension =
        getImageExtension(
          replacementImage
        );
      const path =
        `artworks/${artwork.id}-${Date.now()}.${extension}`;
      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from("artworks")
          .upload(
            path,
            replacementImage,
            {
              upsert:
                false,
              contentType:
                replacementImage.type,
              cacheControl:
                "3600",
            }
          );
      if (
        uploadError
      ) {
        throw uploadError;
      }
      uploadedPath =
        path;
      const {
        data:
          publicUrl,
      } =
        supabase.storage
          .from("artworks")
          .getPublicUrl(
            path
          );
      const nextUrl =
        publicUrl.publicUrl;
      const {
        error:
          updateError,
      } = await supabase
        .from("artworks")
        .update({
          image_path:
            path,
          image_url:
            nextUrl,
        })
        .eq(
          "id",
          artwork.id
        );
      if (
        updateError
      ) {
        await supabase.storage
          .from("artworks")
          .remove([
            path,
          ]);
        throw updateError;
      }
  /* Existing artwork editor section */

      if (
        currentImagePath &&
        currentImagePath !==
          path
      ) {
        const {
          error:
            deleteOldError,
        } =
          await supabase.storage
            .from("artworks")
            .remove([
              currentImagePath,
            ]);
        if (
          deleteOldError
        ) {
          console.warn(
            "New image saved, but old image cleanup failed:",
            deleteOldError
          );
        }
      }
      setCurrentImagePath(
        path
      );
      setCurrentImageUrl(
        nextUrl
      );
      if (
        replacementPreview
      ) {
        URL.revokeObjectURL(
          replacementPreview
        );
      }
      setReplacementImage(
        null
      );
      setReplacementPreview(
        null
      );
      setMessage(
        "Artwork image replaced."
      );
      router.refresh();
    } catch (error) {
  /* Existing artwork editor section */

      if (
        uploadedPath
      ) {
        try {
          const supabase =
            createClient();
          const {
            data:
              currentRow,
          } =
            await supabase
              .from(
                "artworks"
              )
              .select(
                "image_path"
              )
              .eq(
                "id",
                artwork.id
              )
              .single();
          if (
            currentRow
              ?.image_path !==
            uploadedPath
          ) {
            await supabase.storage
              .from(
                "artworks"
              )
              .remove([
                uploadedPath,
              ]);
          }
        } catch {
          // Ignore cleanup failure.
        }
      }
      console.error(
        error
      );
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Could not replace image."
      );
    } finally {
      setReplacingImage(
        false
      );
    }
  }
  /* Existing artwork editor section */

  async function addPrintVariant() {
    const supabase =
      createClient();
    setMessage(
      "Creating print option..."
    );
    const {
      data,
      error,
    } = await supabase
      .from(
        "print_variants"
      )
      .insert({
        artwork_id:
          artwork.id,
        name:
          "New print option",
        size_label:
          null,
        width_mm:
          null,
        height_mm:
          null,
        price:
          null,
        currency:
          "EUR",
        paper:
          null,
        finish:
          null,
        framed:
          false,
        frame_style:
          null,
        framing_details:
          null,
        creativehub_sku:
          null,
        creativehub_product_id:
          null,
        creativehub_variant_id: null,
        estimated_fulfilment_cost:
          null,
        fulfilment_currency:
          "EUR",
        active:
          false,
        sort_order:
          variants.length +
          1,
      })
      .select("*")
      .single();
    if (error) {
      setMessage(
        error.message
      );
      return;
    }
    setVariants(
      (current) => [
        ...current,
        data as PrintVariant,
      ]
    );
    setMessage(
      "Print option created."
    );
  }
  async function addSelectedPresets() {
    if (creatingPresets || selectedPresets.length === 0) return;
    setCreatingPresets(true);
    setMessage("");
    const supabase = createClient();
    const created: PrintVariant[] = [];
    try {
      for (const preset of SIZE_PRESETS) {
        if (!selectedPresets.includes(preset.name)) continue;
        const width = presetLandscape ? preset.height : preset.width;
        const height = presetLandscape ? preset.width : preset.height;
        const alreadyExists = [...variants, ...created].some((v) =>
          v.width_mm === width &&
          v.height_mm === height &&
          v.framed === presetFramed &&
          (!presetFramed || (v.frame_style || "").toLowerCase().includes("black"))
        );
        if (alreadyExists) continue;
        const { data, error } = await supabase
          .from("print_variants")
          .insert({
            artwork_id: artwork.id,
            name: preset.name + (presetFramed ? " / Black frame" : ""),
            size_label: `${width / 10} × ${height / 10} cm`,
            width_mm: width,
            height_mm: height,
            price: null,
            currency: "EUR",
            paper: null,
            finish: null,
            framed: presetFramed,
            frame_style: presetFramed ? "Black" : null,
            framing_details: null,
            creativehub_sku: null,
            creativehub_product_id: null,
            creativehub_variant_id: null,
            estimated_fulfilment_cost: null,
            fulfilment_currency: "GBP",
            active: false,
            sort_order: variants.length + created.length + 1,
          })
          .select("*")
          .single();
        if (error || !data) throw error ?? new Error("Could not create preset.");
        created.push(data as PrintVariant);
      }
      if (created.length) setVariants((current) => [...current, ...created]);
      setSelectedPresets([]);
      setMessage(created.length
        ? `${created.length} preset variant(s) created. Add prices and Creativehub mappings, then enable each option.`
        : "These sizes and presentation options already exist. No duplicates created.");
      router.refresh();
    } catch (error) {
      if (created.length) setVariants((current) => [...current, ...created]);
      setMessage(error instanceof Error ? error.message : "Could not create presets.");
    } finally {
      setCreatingPresets(false);
    }
  }

  async function updateVariant(
    variant:
      PrintVariant
  ) {
    if (
      !variant.name.trim()
    ) {
      setMessage(
        "Print option name is required."
      );
      return;
    }
    if (
      variant.price !==
        null &&
      (
        Number.isNaN(
          variant.price
        ) ||
        variant.price < 0
      )
    ) {
      setMessage(
        "Retail price is invalid."
      );
      return;
    }
    if (
      variant.estimated_fulfilment_cost !==
        null &&
      (
        Number.isNaN(
          variant.estimated_fulfilment_cost
        ) ||
        variant.estimated_fulfilment_cost <
          0
      )
    ) {
      setMessage(
        "Fulfilment cost is invalid."
      );
      return;
    }
    const supabase =
      createClient();
    const {
      error,
    } = await supabase
      .from(
        "print_variants"
      )
      .update({
        name:
          cleanText(
            variant.name
          ),
        size_label:
          cleanText(
            variant.size_label
          ),
        width_mm:
          variant.width_mm,
        height_mm:
          variant.height_mm,
        price:
          variant.price,
        currency:
          variant.currency,
        paper:
          cleanText(
            variant.paper
          ),
        finish:
          cleanText(
            variant.finish
          ),
        framed:
          variant.framed,
        frame_style:
          variant.framed
            ? cleanText(
                variant.frame_style
              )
            : null,
        framing_details:
          variant.framed
            ? cleanText(
                variant.framing_details
              )
            : null,
        creativehub_sku:
          cleanText(
            variant.creativehub_sku
          ),
        creativehub_product_id:
          cleanText(
            variant.creativehub_product_id
          ),
        creativehub_variant_id: cleanText(variant.creativehub_variant_id),
        estimated_fulfilment_cost:
          variant.estimated_fulfilment_cost,
        fulfilment_currency:
          variant.fulfilment_currency,
        active:
          variant.active,
      })
      .eq(
        "id",
        variant.id
      );
    if (error) {
      setMessage(
        error.message
      );
      return;
    }
    setMessage(
      `Saved ${variant.name}.`
    );
    router.refresh();
  }
  async function deleteVariant(
    id: string
  ) {
    const variant =
      variants.find(
        (item) =>
          item.id === id
      );
    const confirmed =
      window.confirm(
        `Delete "${
          variant?.name ??
          "this print option"
        }"?`
      );
    if (!confirmed) {
      return;
    }
    const supabase =
      createClient();
    const {
      error,
    } = await supabase
      .from(
        "print_variants"
      )
      .delete()
      .eq(
        "id",
        id
      );
    if (error) {
      setMessage(
        error.message
      );
      return;
    }
    setVariants(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            id
        )
    );
    setMessage(
      "Print option deleted."
    );
  }
  function changeVariant(
    id: string,
    field:
      VariantField,
    value:
      VariantValue
  ) {
    setVariants(
      (current) =>
        current.map(
          (variant) =>
            variant.id ===
            id
              ? {
                  ...variant,
                  [field]:
                    value,
                }
              : variant
        )
    );
  }
  /*
   * =====================================
   * DELETE ARTWORK
   * =====================================
   */
  async function deleteArtwork() {
    const first =
      window.confirm(
        `Delete "${artwork.title}"?\n\nThis will permanently remove the artwork and its print options.`
      );
    if (!first) {
      return;
    }
    const second =
      window.confirm(
        "This cannot be undone. Permanently delete the artwork?"
      );
    if (!second) {
      return;
    }
    setDeletingArtwork(
      true
    );
    setMessage(
      "Deleting artwork..."
    );
    try {
      const supabase =
        createClient();
      /*
       * Remove dependent
       * print variants first.
       */
      const {
        error:
          variantError,
      } = await supabase
        .from(
          "print_variants"
        )
        .delete()
        .eq(
          "artwork_id",
          artwork.id
        );
      if (
        variantError
      ) {
        throw variantError;
      }
      /*
       * Delete artwork row.
       */
      const {
        error:
          artworkError,
      } = await supabase
        .from(
          "artworks"
        )
        .delete()
        .eq(
          "id",
          artwork.id
        );
      if (
        artworkError
      ) {
        throw artworkError;
      }
      /*
       * Storage cleanup only
       * after database deletion.
       */
      if (
        currentImagePath
      ) {
        const {
          error:
            storageError,
        } =
          await supabase.storage
            .from(
              "artworks"
            )
            .remove([
              currentImagePath,
            ]);
        if (
          storageError
        ) {
          console.warn(
            "Artwork deleted but image cleanup failed:",
            storageError
          );
        }
      }
      router.push(
        "/studio/artworks"
      );
      router.refresh();
    } catch (error) {
      console.error(
        error
      );
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Could not delete artwork."
      );
      setDeletingArtwork(
        false
      );
    }
  }
  const displayImage =
    replacementPreview ??
    currentImageUrl;
  return (
    <form
      onSubmit={
        saveArtwork
      }
    >
      {/* =====================================
          ARTWORK
      ====================================== */}
      <section className="grid gap-10 border-b border-black/10 pb-12 lg:grid-cols-[minmax(0,0.85fr)\_minmax(0,1.15fr)]">
        <div>
          <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
            {displayImage ? (
              <img
                src={
                  displayImage
                }
                alt={
                  artwork.title
                }
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-black/30">
                No image
              </div>
            )}
            {replacementPreview && (
              <div className="absolute left-4 top-4 bg-black px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-white">
                New image preview
              </div>
            )}
          </div>
          <div className="mt-4">
            <label className="flex cursor-pointer items-center justify-center border border-black px-5 py-4 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white">
              Choose replacement image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  selectReplacementImage
                }
                className="hidden"
              />
            </label>
            <p className="mt-3 text-[10px] leading-5 text-black/35">
              JPG, PNG or WEBP.
              Maximum 50 MB.
            </p>
            {replacementImage && (
              <div className="mt-5 border border-black/10 p-4">
                <p className="truncate text-xs font-medium">
                  {
                    replacementImage.name
                  }
                </p>
                <p className="mt-1 text-[10px] text-black/35">
                  {formatFileSize(
                    replacementImage.size
                  )}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={
                      replacingImage
                    }
                    onClick={
                      cancelReplacementImage
                    }
                    className="border border-black/20 px-4 py-3 text-[9px] uppercase tracking-[0.16em] transition hover:border-black disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={
                      replacingImage
                    }
                    onClick={
                      replaceArtworkImage
                    }
                    className="bg-black px-4 py-3 text-[9px] uppercase tracking-[0.16em] text-white transition hover:opacity-70 disabled:opacity-40"
                  >
                    {replacingImage
                      ? "Replacing..."
                      : "Replace image"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-black/40">
            Artwork
          </p>
          <h1 className="mt-4 text-5xl font-medium tracking-[-0.05em] md:text-7xl">
            Edit work
          </h1>
          <div className="mt-12 space-y-8">
            <Field
              label="Title"
              value={
                form.title
              }
              onChange={(
                value
              ) =>
                updateField(
                  "title",
                  value
                )
              }
            />
            <div>
              <Label>
                Collection
              </Label>
              <select
                value={
                  form.collection_id
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "collection_id",
                    event
                      .target
                      .value
                  )
                }
                className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none focus:border-black"
              >
                <option value="">
                  No collection
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
                value={
                  form.year
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "year",
                    value
                  )
                }
                placeholder="2026"
              />
              <Field
                label="Medium"
                value={
                  form.medium
                }
                onChange={(
                  value
                ) =>
                  updateField(
                    "medium",
                    value
                  )
                }
                placeholder="Acrylic on canvas"
              />
            </div>
            <div>
              <Label>
                Artwork story / description
              </Label>
              <textarea
                value={
                  form.description
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "description",
                    event
                      .target
                      .value
                  )
                }
                rows={8}
                className="mt-3 w-full resize-y border border-black/15 bg-transparent p-4 leading-7 outline-none focus:border-black"
                placeholder="Write about the work..."
              />
            </div>
          </div>
        </div>
      </section>
      {/* =====================================
          ORIGINAL
      ====================================== */}
      <section className="grid gap-10 border-b border-black/10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-black/40">
            Commerce / 01
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            Original
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/45">
            Control whether the
            physical original
            artwork is available
            for purchase.
          </p>
        </div>
        <div className="space-y-8">
          <Toggle
            label="Original available for sale"
            checked={
              form.original_available
            }
            onChange={(
              value
            ) => {
              updateField(
                "original_available",
                value
              );
              if (
                value &&
                form.original_status ===
                  "not_for_sale"
              ) {
                updateField(
                  "original_status",
                  "available"
                );
              }
            }}
          />
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <Label>
                Sale status
              </Label>
              <select
                value={
                  form.original_status
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "original_status",
                    event
                      .target
                      .value
                  )
                }
                className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none focus:border-black"
              >
                <option value="not_for_sale">
                  Not for sale
                </option>
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
                form.original_dimensions
              }
              onChange={(
                value
              ) =>
                updateField(
                  "original_dimensions",
                  value
                )
              }
              placeholder="120 × 90 cm"
            />
          </div>
          <div className="grid gap-8 md:grid-cols-[1fr_160px]">
            <Field
              label="Original price"
              value={
                form.original_price
              }
              onChange={(
                value
              ) =>
                updateField(
                  "original_price",
                  value
                )
              }
              placeholder="4500"
              type="number"
            />
            <CurrencySelect
              label="Currency"
              value={
                form.original_currency
              }
              onChange={(
                value
              ) =>
                updateField(
                  "original_currency",
                  value
                )
              }
            />
          </div>
        </div>
      </section>
      {/* =====================================
          PRINTS
      ====================================== */}
      <section className="grid gap-10 border-b border-black/10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-black/40">
            Commerce / 02
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            Prints
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/45">
            Create each physical
            print configuration
            that can be sold and
            fulfilled by
            creativehub.
          </p>
        </div>
        <div>
          <Toggle
            label="Prints available"
            checked={
              form.prints_available
            }
            onChange={(
              value
            ) =>
              updateField(
                "prints_available",
                value
              )
            }
          />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Field
              label="Edition type"
              value={
                form.edition_type
              }
              onChange={(
                value
              ) =>
                updateField(
                  "edition_type",
                  value
                )
              }
              placeholder="Limited edition"
            />
            <Field
              label="Edition size"
              value={
                form.edition_size
              }
              onChange={(
                value
              ) =>
                updateField(
                  "edition_size",
                  value
                )
              }
              placeholder="50"
              type="number"
            />
          </div>
          <div className="mt-12 border-t border-black/10 pt-8">
            <div className="flex items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-medium">
                  Sellable print variants

<a
  href={`/studio/artworks/${artwork.id}/creativehub`}
  className="mb-6 inline-flex border border-black bg-black px-5 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-transparent hover:text-black"
>
  Connect to Creativehub ↗
</a>

                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">
                  Each row represents
                  one purchasable
                  configuration, such
                  as 60 × 80 cm print
                  only or 60 × 80 cm
                  black framed.
                </p>
              </div>
              <button
                type="button"
                onClick={
                  addPrintVariant
                }
                className="shrink-0 border border-black px-4 py-3 text-[10px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
              >
                + Add custom variant
              </button>
            </div>
            <div className="mt-7 border border-black/15 bg-white/35 p-5">
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/40">Add standard print sizes</p>
              <p className="mt-2 text-xs leading-5 text-black/50">
                Select Small, Medium, Large or Statement, then click Create selected variants. Existing matching options are skipped.
                New options start disabled until you enter a retail price and map Creativehub.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {SIZE_PRESETS.map((preset) => (
                  <label key={preset.name} className="flex cursor-pointer items-center gap-3 border border-black/10 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedPresets.includes(preset.name)}
                      onChange={(event) => setSelectedPresets((current) =>
                        event.target.checked
                          ? [...current, preset.name]
                          : current.filter((name) => name !== preset.name)
                      )}
                    />
                    <span className="font-medium">{preset.name}</span>
                    <span className="ml-auto text-xs text-black/40">{preset.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={presetFramed}
                    onChange={(event) => setPresetFramed(event.target.checked)} />
                  Black frame (separate variant)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={presetLandscape}
                    onChange={(event) => setPresetLandscape(event.target.checked)} />
                  Landscape orientation (swap dimensions)
                </label>
              </div>
              <button type="button" disabled={creatingPresets || selectedPresets.length === 0}
                onClick={addSelectedPresets}
                className="mt-5 bg-black px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-white disabled:opacity-40">
                {creatingPresets ? "Creating..." : "Create selected variants"}
              </button>
            </div>
            <div className="mt-8 space-y-8">
              {variants.length ===
                0 && (
                <div className="border border-dashed border-black/20 px-5 py-12 text-center">
                  <p className="text-sm text-black/40">
                    No print variants yet.
                  </p>
                </div>
              )}
              {variants.map(
                (
                  variant
                ) => (
                  <PrintVariantEditor
                    key={
                      variant.id
                    }
                    variant={
                      variant
                    }
                    onChange={
                      changeVariant
                    }
                    onSave={
                      updateVariant
                    }
                    onDelete={
                      deleteVariant
                    }
                  />
                )
              )}
            </div>
          </div>
        </div>
      </section>
      {/* =====================================
          VISIBILITY
      ====================================== */}
      <section className="grid gap-10 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-black/40">
            Website
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            Visibility
          </h2>
        </div>
        <div className="space-y-6">
          <Toggle
            label="Published on website"
            checked={
              form.published
            }
            onChange={(
              value
            ) =>
              updateField(
                "published",
                value
              )
            }
          />
          <Toggle
            label="Featured artwork"
            checked={
              form.featured
            }
            onChange={(
              value
            ) =>
              updateField(
                "featured",
                value
              )
            }
          />
        </div>
      </section>
      {/* =====================================
          DANGER ZONE
      ====================================== */}
      <section className="grid gap-10 border-t border-red-900/15 py-12 lg:grid-cols-[0.6fr_1.4fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-800/60">
            Danger zone
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em]">
            Delete artwork
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-black/45">
            Permanently remove
            this artwork, its
            print options and
            uploaded image.
          </p>
        </div>
        <div className="flex flex-col items-start justify-between gap-6 border border-red-900/15 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium">
              Permanently delete
            </p>
            <p className="mt-2 max-w-md text-xs leading-5 text-black/40">
              The artwork will
              immediately disappear
              from Studio and the
              public website.
            </p>
          </div>
          <button
            type="button"
            onClick={
              deleteArtwork
            }
            disabled={
              deletingArtwork
            }
            className="shrink-0 border border-red-800/40 px-5 py-3 text-[9px] uppercase tracking-[0.18em] text-red-800 transition hover:bg-red-800 hover:text-white disabled:opacity-40"
          >
            {deletingArtwork
              ? "Deleting..."
              : "Delete artwork"}
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
              replacingImage ||
              deletingArtwork
            }
            className="bg-black px-8 py-4 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-70 disabled:opacity-40"
          >
            {saving
              ? "Saving..."
              : "Save artwork"}
          </button>
        </div>
      </div>
    </form>
  );
}
/*
 * =====================================
 * PRINT VARIANT EDITOR
 * =====================================
 */
function PrintVariantEditor({
  variant,
  onChange,
  onSave,
  onDelete,
}: {
  variant:
    PrintVariant;
  onChange: (
    id: string,
    field:
      VariantField,
    value:
      VariantValue
  ) => void;
  onSave: (
    variant:
      PrintVariant
  ) => void;
  onDelete: (
    id: string
  ) => void;
}) {
  return (
    <div
      className={`border p-6 ${
        variant.active
          ? "border-black/15"
          : "border-black/10 opacity-60"
      }`}
    >
      {/* HEADER */}
      <div className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-black/35">
            Print variant
          </p>
          <p className="mt-2 font-medium">
            {variant.name ||
              "Untitled variant"}
          </p>
        </div>
        <ToggleCompact
          label={
            variant.active
              ? "Active"
              : "Disabled"
          }
          checked={
            variant.active
          }
          onChange={(
            value
          ) =>
            onChange(
              variant.id,
              "active",
              value
            )
          }
        />
      </div>
      {/* STANDARD SIZE PRESET FOR THIS VARIANT */}
      <div className="mt-6 border border-black/10 bg-black/[0.025] p-4">
        <label htmlFor={`size-preset-${variant.id}`} className="block text-[10px] uppercase tracking-[0.18em] text-black/55">
          Choose a standard print size
        </label>
        <select
          id={`size-preset-${variant.id}`}
          value=""
          disabled={Boolean(variant.creativehub_variant_id || variant.creativehub_sku)}
          onChange={(event) => {
            const preset = SIZE_PRESETS.find((item) => item.name === event.target.value);
            if (!preset) return;
            onChange(variant.id, "name", preset.name + (variant.framed ? " / Black frame" : ""));
            onChange(variant.id, "size_label", preset.label);
            onChange(variant.id, "width_mm", preset.width);
            onChange(variant.id, "height_mm", preset.height);
          }}
          className="mt-3 w-full border border-black/15 bg-white px-4 py-3 text-sm outline-none focus:border-black disabled:opacity-40"
        >
          <option value="">Select Small / Medium / Large / Statement</option>
          {SIZE_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>{preset.name} · {preset.label}</option>
          ))}
        </select>
        <p className="mt-2 text-[11px] leading-5 text-black/45">
          {variant.creativehub_variant_id || variant.creativehub_sku
            ? "Size is locked for a Creativehub-mapped variant. Create a separate variant to offer another size."
            : "Selecting a preset fills in the dimensions below. You can then change them if the artwork requires a different crop or orientation. Save variant to keep the changes."}
        </p>
      </div>
      {/* CUSTOMER-FACING */}
      <div className="mt-6">
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
          Customer option
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <VariantTextField
            label="Variant name"
            value={
              variant.name
            }
            placeholder="60 × 80 cm / Black frame"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "name",
                value
              )
            }
          />
          <VariantTextField
            label="Size label"
            value={
              variant.size_label ??
              ""
            }
            placeholder="60 × 80 cm"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "size_label",
                value
              )
            }
          />
          <VariantNumberField
            label="Width (cm)"
            value={variant.width_mm === null ? null : variant.width_mm / 10}
            placeholder="60"
            onChange={(value) => onChange(variant.id, "width_mm", value === null ? null : Math.round(value * 10))}
          />
          <VariantNumberField
            label="Height (cm)"
            value={variant.height_mm === null ? null : variant.height_mm / 10}
            placeholder="80"
            onChange={(value) => onChange(variant.id, "height_mm", value === null ? null : Math.round(value * 10))}
          />
          <VariantTextField
            label="Paper"
            value={
              variant.paper ??
              ""
            }
            placeholder="Hahnemühle Photo Rag"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "paper",
                value
              )
            }
          />
          <VariantTextField
            label="Print finish"
            value={
              variant.finish ??
              ""
            }
            placeholder="Giclée"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "finish",
                value
              )
            }
          />
        </div>
      </div>
      {/* FRAME */}
      <div className="mt-8 border-t border-black/10 pt-6">
        <Toggle
          label="Framed option"
          checked={
            variant.framed
          }
          onChange={(
            value
          ) =>
            onChange(
              variant.id,
              "framed",
              value
            )
          }
        />
        {variant.framed && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <VariantTextField
              label="Frame style"
              value={
                variant.frame_style ??
                ""
              }
              placeholder="Black wood"
              onChange={(
                value
              ) =>
                onChange(
                  variant.id,
                  "frame_style",
                  value
                )
              }
            />
            <VariantTextField
              label="Framing details"
              value={
                variant.framing_details ??
                ""
              }
              placeholder="Black wood frame, white border"
              onChange={(
                value
              ) =>
                onChange(
                  variant.id,
                  "framing_details",
                  value
                )
              }
            />
          </div>
        )}
      </div>
      {/* PRICING */}
      <div className="mt-8 border-t border-black/10 pt-6">
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
          Pricing
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-[1fr_120px_1fr_120px]">
          <VariantNumberField
            label="Retail price"
            value={
              variant.price
            }
            placeholder="350"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "price",
                value
              )
            }
          />
          <CurrencyVariantSelect
            label="Currency"
            value={
              variant.currency
            }
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "currency",
                value
              )
            }
          />
          <VariantNumberField
            label="Fulfilment cost"
            value={
              variant.estimated_fulfilment_cost
            }
            placeholder="118.40"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "estimated_fulfilment_cost",
                value
              )
            }
          />
          <CurrencyVariantSelect
            label="Cost currency"
            value={
              variant.fulfilment_currency
            }
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "fulfilment_currency",
                value
              )
            }
          />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Metric label="Retail" value={variant.price !== null ? formatMoney(variant.price, variant.currency) : "Not set"} />
          <Metric label="Saved production estimate" value={variant.estimated_fulfilment_cost !== null
            ? formatMoney(variant.estimated_fulfilment_cost, variant.fulfilment_currency)
            : "Not set"} />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-black/45">
          Full estimated contribution and margin appear in the live calculator below after production,
          delivery, supplier VAT, currency conversion and estimated payment fees are included.
        </p>
      </div>
      {/* CREATIVEHUB */}
      <div className="mt-8 border-t border-black/10 pt-6">
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
          Creativehub / theprintspace
        </p>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-black/40">
          These identifiers connect
          this exact website variant
          to the product that
          creativehub should print
          and fulfil.
        </p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <VariantTextField
            label="Creativehub SKU"
            value={
              variant.creativehub_sku ??
              ""
            }
            placeholder="Paste creativehub SKU"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "creativehub_sku",
                value
              )
            }
          />
          <VariantTextField
            label="Creativehub variant ID (required for quotes and fulfilment)"
            value={variant.creativehub_variant_id ?? ""}
            placeholder="Creativehub variant UUID"
            onChange={(value) => onChange(variant.id, "creativehub_variant_id", value)}
          />
          <VariantTextField
            label="Creativehub product ID"
            value={
              variant.creativehub_product_id ??
              ""
            }
            placeholder="Product ID"
            onChange={(
              value
            ) =>
              onChange(
                variant.id,
                "creativehub_product_id",
                value
              )
            }
          />
        </div>
        <div className="mt-5 border border-black/10 bg-black/[0.025] p-4">
          <p className="text-[10px] leading-5 text-black/45">
            Leave the Creativehub
            fields empty until the
            corresponding product
            exists in your
            creativehub account.
            Set the product ID, variant ID and SKU from the actual Creativehub product. Save the variant before requesting a quote.
          </p>
        </div>
      </div>
      <CreativehubPricingCalculator variant={variant} onChange={onChange} />
      {/* ACTIONS */}
      <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-5">
        <button
          type="button"
          onClick={() =>
            onDelete(
              variant.id
            )
          }
          className="text-[10px] uppercase tracking-[0.18em] text-red-700/60 transition hover:text-red-700"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() =>
            onSave(
              variant
            )
          }
          className="bg-black px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-white transition hover:opacity-70"
        >
          Save variant
        </button>
      </div>
    </div>
  );
}
type FulfilmentQuote = {
  quoteSuccessful: true;
  creativehub: {
    currency: string | null;
    productionCost: number | null;
    deliveryCost: number | null;
    addonCost: number | null;
    vat: number | null;
    totalIncludingVat: number | null;
  };
};

function CreativehubPricingCalculator({
  variant,
  onChange,
}: {
  variant: PrintVariant;
  onChange: (id: string, field: VariantField, value: VariantValue) => void;
}) {
  const [country, setCountry] = useState("DE");
  const [quantity, setQuantity] = useState(1);
  const [customerShipping, setCustomerShipping] = useState(0);
  const [conversion, setConversion] = useState("");
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [fxError, setFxError] = useState("");
  const [feePercent, setFeePercent] = useState(2.9);
  const [feeFixed, setFeeFixed] = useState(0.3);
  const [quote, setQuote] = useState<FulfilmentQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestQuote() {
    if (!variant.creativehub_variant_id || !variant.creativehub_product_id) {
      setError("Save the Creativehub product and variant IDs before requesting a quote.");
      return;
    }
    setLoading(true);
    setError("");
    setFxError("");
    setFxDate(null);
    setQuote(null);
    setConversion("");
    try {
      const response = await fetch("/api/studio/creativehub/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioVariantId: variant.id,
          quantity,
          country,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.quoteSuccessful) {
        throw new Error(result.error ?? "Could not retrieve Creativehub quote.");
      }
      setQuote(result as FulfilmentQuote);
      const supplierCurrency = result.creativehub?.currency;
      if (supplierCurrency && supplierCurrency.toUpperCase() !== variant.currency.toUpperCase()) {
        try {
          const fxResponse = await fetch(
            `/api/studio/creativehub/fx?from=${encodeURIComponent(supplierCurrency)}&to=${encodeURIComponent(variant.currency)}`,
            { cache: "no-store" }
          );
          const fx = await fxResponse.json();
          if (!fxResponse.ok || !Number.isFinite(fx.rate) || fx.rate <= 0) {
            throw new Error(fx.error || "Exchange rate unavailable.");
          }
          setConversion(String(fx.rate));
          setFxDate(fx.date ?? null);
        } catch {
          setFxError("Automatic exchange rate unavailable. Enter the rate manually to calculate your estimate.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve quote.");
    } finally {
      setLoading(false);
    }
  }

  const quotedCurrency = quote?.creativehub.currency ?? null;
  const sameCurrency = quotedCurrency?.toUpperCase() === variant.currency.toUpperCase();
  const exchangeRate = sameCurrency ? 1 : Number(conversion);
  const hasRate = sameCurrency || (conversion.trim() !== "" && Number.isFinite(exchangeRate) && exchangeRate > 0);
  const retail = variant.price === null ? null : Number(variant.price) * quantity;
  const collected = retail === null ? null : retail + customerShipping;
  const supplier = quote?.creativehub.totalIncludingVat ?? null;
  const convertedSupplier = supplier !== null && hasRate ? supplier * exchangeRate : null;
  const fee = collected !== null ? collected * feePercent / 100 + feeFixed : null;
  const profit = collected !== null && convertedSupplier !== null && fee !== null
    ? collected - convertedSupplier - fee
    : null;
  const margin = profit !== null && collected !== null && collected > 0
    ? profit / collected * 100 : null;

  return (
    <div className="mt-8 border-t border-black/10 pt-6">
      <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">Pricing & profit calculator</p>
      <p className="mt-2 text-xs leading-6 text-black/45">
        Fetch a live quotation for this mapped variant. Estimates use the full supplier quote,
        including its VAT. Nothing is sent to production.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Delivery country</Label>
          <select value={country} onChange={(e) => { setCountry(e.target.value); setQuote(null); }}
            className="mt-2 w-full border border-black/15 bg-transparent p-3 text-sm">
            {[
              ["DE", "Germany"], ["GB", "United Kingdom"],
              ["FR", "France"], ["NL", "Netherlands"],
              ["BE", "Belgium"], ["AT", "Austria"],
              ["CH", "Switzerland"], ["US", "United States"],
              ["CA", "Canada"], ["AU", "Australia"],
              ["KE", "Kenya"],
            ].map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div>
          <Label>Quantity</Label>
          <input type="number" min={1} max={50} step={1} value={quantity}
            onChange={(e) => { setQuantity(Number(e.target.value)); setQuote(null); }}
            className="mt-2 w-full border border-black/15 bg-transparent p-3 text-sm" />
        </div>
        <div>
          <Label>Customer shipping charged ({variant.currency})</Label>
          <input type="number" min={0} step="0.01" value={customerShipping}
            onChange={(e) => setCustomerShipping(Math.max(0, Number(e.target.value) || 0))}
            className="mt-2 w-full border border-black/15 bg-transparent p-3 text-sm" />
        </div>
      </div>
      <button type="button" onClick={requestQuote}
        disabled={loading || !variant.creativehub_variant_id || !Number.isInteger(quantity) || quantity < 1 || quantity > 50}
        className="mt-5 bg-black px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-white disabled:opacity-40">
        {loading ? "Getting quote..." : "Calculate fulfilment cost"}
      </button>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      {quote && (
        <div className="mt-6 border border-black/15 p-5">
          <h4 className="text-sm font-medium">Creativehub quote · {country} · Qty {quantity}</h4>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <span>Production: {showQuotedMoney(quote.creativehub.productionCost, quotedCurrency)}</span>
            <span>Supplier delivery: {showQuotedMoney(quote.creativehub.deliveryCost, quotedCurrency)}</span>
            <span>Add-ons: {showQuotedMoney(quote.creativehub.addonCost, quotedCurrency)}</span>
            <span>Supplier VAT: {showQuotedMoney(quote.creativehub.vat, quotedCurrency)}</span>
          </div>
          <p className="mt-4 border-t border-black/10 pt-4 text-xl font-medium">
            Total supplier quote: {showQuotedMoney(supplier, quotedCurrency)}
          </p>
          {!sameCurrency && (
            <div className="mt-5">
              <Label>Exchange rate · 1 {quotedCurrency} in {variant.currency}</Label>
              <input type="number" min="0.00001" step="any" placeholder="Enter a current rate"
                value={conversion} onChange={(e) => setConversion(e.target.value)}
                className="mt-2 w-full border border-black/15 bg-transparent p-3 text-sm" />
              <p className="mt-2 text-[11px] text-black/40">
                {fxDate ? `Reference exchange rate dated ${fxDate}. Your actual bank or payment-provider rate may differ.`
                  : "Enter a current rate if automatic conversion is unavailable."}
                {fxError && <span className="block text-amber-800">{fxError}</span>}
              </p>
            </div>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <VariantNumberField label="Estimated payment fee (%)" value={feePercent}
              onChange={(value) => setFeePercent(Math.max(0, value ?? 0))} />
            <VariantNumberField label={`Fixed payment fee (${variant.currency})`} value={feeFixed}
              onChange={(value) => setFeeFixed(Math.max(0, value ?? 0))} />
          </div>
          <div className="mt-5 grid gap-3 border-t border-black/10 pt-4 text-sm sm:grid-cols-2">
            <div>Retail + customer shipping: <strong>{showQuotedMoney(collected, variant.currency)}</strong></div>
            <div>Converted supplier total: <strong>{showQuotedMoney(convertedSupplier, variant.currency)}</strong></div>
            <div>Estimated payment fees: <strong>{showQuotedMoney(fee, variant.currency)}</strong></div>
            <div>Estimated contribution: <strong>{showQuotedMoney(profit, variant.currency)}</strong></div>
            <div>Estimated margin: <strong>{margin === null ? "Enter a valid retail price and FX rate" : `${margin.toFixed(1)}%`}</strong></div>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-black/45">
            Contribution is not net profit. It excludes your own sales tax obligations,
            other business costs and any additional currency-conversion fees.
            Customer shipping entered here is for this estimate only, not the live checkout.
          </p>
          {quote.creativehub.productionCost !== null && quantity === 1 && (
            <button type="button" className="mt-4 border border-black/20 px-4 py-3 text-[10px] uppercase tracking-[0.15em]"
              onClick={() => {
                onChange(variant.id, "estimated_fulfilment_cost", quote.creativehub.productionCost);
                if (quotedCurrency) onChange(variant.id, "fulfilment_currency", quotedCurrency.toUpperCase());
              }}>
              Use quoted production cost in variant (then save)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function showQuotedMoney(amount: number | null, currency: string | null): string {
  if (amount === null || !currency) return "Not quoted";
  return formatMoney(Number(amount), currency.toUpperCase());
}

/*
 * =====================================
 * SHARED UI
 * =====================================
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
        step={
          type === "number"
            ? "0.01"
            : undefined
        }
        min={
          type === "number"
            ? "0"
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
function ToggleCompact({
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
    <button
      type="button"
      onClick={() =>
        onChange(
          !checked
        )
      }
      className={`border px-4 py-2 text-[9px] uppercase tracking-[0.18em] transition ${
        checked
          ? "border-black bg-black text-white"
          : "border-black/20 text-black/45"
      }`}
    >
      {label}
    </button>
  );
}
function VariantTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (
    value: string
  ) => void;
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
        className="mt-2 w-full border-b border-black/20 bg-transparent py-3 outline-none placeholder:text-black/20 focus:border-black"
      />
    </div>
  );
}
function VariantNumberField({
  label,
  value,
  placeholder,
  onChange,
  integer = false,
}: {
  label: string;
  value:
    | number
    | null;
  placeholder?: string;
  integer?: boolean;
  onChange: (
    value:
      | number
      | null
  ) => void;
}) {
  return (
    <div>
      <Label>
        {label}
      </Label>
      <input
        type="number"
        min="0"
        step={
          integer
            ? "1"
            : "0.01"
        }
        value={
          value ?? ""
        }
        onChange={(
          event
        ) => {
          const raw =
            event.target.value;
          if (!raw) {
            onChange(null);
            return;
          }
          const parsed =
            Number(raw);
          onChange(
            Number.isNaN(
              parsed
            )
              ? null
              : parsed
          );
        }}
        placeholder={
          placeholder
        }
        className="mt-2 w-full border-b border-black/20 bg-transparent py-3 outline-none placeholder:text-black/20 focus:border-black"
      />
    </div>
  );
}
function CurrencySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <Label>
        {label}
      </Label>
      <select
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-3 w-full border-b border-black/20 bg-transparent py-4 outline-none focus:border-black"
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
  );
}
function CurrencyVariantSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <Label>
        {label}
      </Label>
      <select
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full border-b border-black/20 bg-transparent py-3 outline-none"
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
  );
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-black/10 p-4">
      <p className="text-[8px] uppercase tracking-[0.18em] text-black/35">
        {label}
      </p>
      <p className="mt-2 text-lg font-medium tracking-[-0.02em]">
        {value}
      </p>
    </div>
  );
}
/*
 * =====================================
 * HELPERS
 * =====================================
 */
function cleanText(
  value:
    | string
    | null
) {
  if (!value) {
    return null;
  }
  const cleaned =
    value.trim();
  return cleaned ||
    null;
}
function getImageExtension(
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
function formatFileSize(
  bytes: number
) {
  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(
      1
    )} KB`;
  }
  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(
    1
  )} MB`;
}
function formatMoney(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-IE",
      {
        style:
          "currency",
        currency,
        maximumFractionDigits:
          2,
      }
    ).format(
      amount
    );
  } catch {
    return `${currency} ${amount.toFixed(
      2
    )}`;
  }
}