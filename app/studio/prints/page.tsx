import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ManagePrintsClient from "./ManagePrintsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ArtworkRow = {
  id: string;
  title: string;
  image_url: string | null;
  prints_available: boolean;
  published: boolean;
};

type VariantRow = {
  id: string;
  artwork_id: string;
  name: string;
  size_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
  paper: string | null;
  framed: boolean;
  frame_style: string | null;
  price: number | null;
  currency: string;
  active: boolean;
  creativehub_product_id: string | null;
  creativehub_variant_id: string | null;
  creativehub_sku: string | null;
};

type SyncRow = {
  artwork_id: string;
  state: string;
  product_id: string | null;
  master_path: string | null;
  last_error: string | null;
};

export default async function ManagePrintsPage() {
  // Require BOTH an authenticated user and the same admin membership
  // required by the existing Creativehub catalog-sync API.
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/studio/login");

  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .from("studio_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !membership) notFound();

  const [artworkQuery, variantQuery, syncQuery, hiddenQuery] = await Promise.all([
    admin.from("artworks")
      .select("id,title,image_url,prints_available,published")
      .order("title", { ascending: true })
      .limit(1000),
    admin.from("print_variants")
      .select("id,artwork_id,name,size_label,width_mm,height_mm,paper,framed,frame_style,price,currency,active,creativehub_product_id,creativehub_variant_id,creativehub_sku")
      .order("sort_order", { ascending: true })
      .limit(1000),
    admin.from("artwork_creativehub_sync")
      .select("artwork_id,state,product_id,master_path,last_error")
      .limit(1000),
    admin.from("studio_print_catalog_hidden").select("artwork_id").limit(1000),
  ]);

  if (artworkQuery.error) throw new Error(`Artworks could not be loaded: ${artworkQuery.error.message}`);
  if (variantQuery.error) throw new Error(`Print options could not be loaded: ${variantQuery.error.message}`);
  if (syncQuery.error) throw new Error(`Creativehub mappings could not be loaded: ${syncQuery.error.message}`);
  if (hiddenQuery.error) throw new Error("Apply Phase 8 Supabase SQL before using Manage Prints.");
  const hiddenIds = new Set((hiddenQuery.data ?? []).map(row => row.artwork_id));

  const artworkRows = (artworkQuery.data ?? []) as ArtworkRow[];
  const variants = (variantQuery.data ?? []) as VariantRow[];
  const syncRows = (syncQuery.data ?? []) as SyncRow[];
  const byArtwork = new Map<string, VariantRow[]>();
  for (const variant of variants) {
    const list = byArtwork.get(variant.artwork_id) ?? [];
    list.push(variant);
    byArtwork.set(variant.artwork_id, list);
  }
  const bySync = new Map(syncRows.map((row) => [row.artwork_id, row]));
  const artworks = artworkRows
    .filter((row) => (row.prints_available || byArtwork.has(row.id)) && !hiddenIds.has(row.id))
    .map((row) => {
      const sync = bySync.get(row.id);
      return {
        ...row,
        variants: byArtwork.get(row.id) ?? [],
        sync: sync ? {
          state: sync.state,
          productId: sync.product_id,
          hasMaster: Boolean(sync.master_path),
          error: sync.last_error,
        } : null,
      };
    });

  return <ManagePrintsClient artworks={artworks} truncated={artworkRows.length >= 1000 || variants.length >= 1000 || syncRows.length >= 1000} />;
}
