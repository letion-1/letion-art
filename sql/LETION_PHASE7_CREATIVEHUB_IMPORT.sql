-- LETION ART · Creativehub draft import and safe local artwork deletion
-- Run once in Supabase SQL Editor. Creates only Studio-side records/procedures.
-- It NEVER changes creativehub products, orders, or storage objects.

create table if not exists public.creativehub_draft_imports (
  product_id uuid primary key,
  linked_artwork_id uuid references public.artworks(id) on delete set null,
  product_json jsonb not null default '{}'::jsonb,
  variants_json jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creativehub_draft_imports enable row level security;
revoke all on public.creativehub_draft_imports from public, anon, authenticated;

-- A repeat import of the same supplier product must never create a second artwork.
create unique index if not exists letion_creativehub_artwork_source_unique
  on public.artworks(source_key)
  where source_key like 'creativehub/%';

create or replace function public.studio_import_creativehub_draft(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb,
  p_existing_artwork_id uuid default null,
  p_collection_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_artwork_id uuid;
  v_existing_mirror uuid;
  v_title text;
  v_slug text;
  v_source_key text;
  v_image_url text;
  v_row jsonb;
  v_remote_id uuid;
  v_remote_sku text;
  v_width numeric;
  v_height numeric;
  v_label text;
  v_paper text;
  v_framed boolean;
  v_frame_color text;
  v_existing_local record;
  v_index integer := 0;
  v_created integer := 0;
  v_skipped integer := 0;
  v_remote_count integer;
  v_sync_product text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role only operation';
  end if;
  if p_product_id is null or jsonb_typeof(p_product) <> 'object' or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Invalid verified Creativehub product data';
  end if;
  if p_product->>'id' is distinct from p_product_id::text then
    raise exception 'Supplier product ID mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('creativehub-draft:' || p_product_id::text, 0));
  v_title := nullif(btrim(coalesce(p_product->>'name', p_product->>'title', '')), '');
  if v_title is null then raise exception 'Supplier product has no title'; end if;
  v_source_key := 'creativehub/' || p_product_id::text;
  v_image_url := coalesce(nullif(p_product->>'artwork_preview_medium_url',''), nullif(p_product->>'artwork_thumbnail_url',''), nullif(p_product->>'artwork_url',''));
  if v_image_url is not null and v_image_url !~* '^https://' then
    raise exception 'Supplier returned an unsupported image URL';
  end if;

  select linked_artwork_id into v_existing_mirror
    from public.creativehub_draft_imports where product_id = p_product_id for update;
  if v_existing_mirror is not null and p_existing_artwork_id is not null
     and v_existing_mirror <> p_existing_artwork_id then
    raise exception 'This supplier product is already imported to another artwork';
  end if;

  v_artwork_id := coalesce(v_existing_mirror, p_existing_artwork_id);
  if exists (select 1 from public.artwork_creativehub_sync where product_id::text=p_product_id::text
             and (v_artwork_id is null or artwork_id <> v_artwork_id)) then
    raise exception 'Creativehub product already linked to another artwork in Studio';
  end if;
  if v_artwork_id is null then
    select id into v_artwork_id from public.artworks where source_key = v_source_key limit 1;
  end if;
  if v_artwork_id is null then
    if v_image_url is null then raise exception 'Creativehub product has no usable preview URL; upload a website image or link an existing artwork instead'; end if;
    if p_collection_id is null or not exists (select 1 from public.collections where id = p_collection_id) then
      raise exception 'Choose an existing collection for the new imported artwork';
    end if;
    v_slug := trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'));
    v_slug := left(coalesce(nullif(v_slug, ''), 'artwork'), 55) || '-ch-' || left(p_product_id::text, 8);
    insert into public.artworks (
      title, slug, source_key, collection_id, description, image_path, image_url,
      published, featured, prints_available, original_available, original_status, sort_order
    ) values (
      v_title, v_slug, v_source_key, p_collection_id,
      nullif(p_product->>'description',''), null, v_image_url,
      false, false, false, false, 'not_for_sale',
      coalesce((select max(sort_order) from public.artworks where collection_id=p_collection_id),0) + 1
    ) returning id into v_artwork_id;
  else
    if not exists (select 1 from public.artworks where id = v_artwork_id) then
      raise exception 'Selected website artwork no longer exists';
    end if;
  end if;

  select product_id::text into v_sync_product
    from public.artwork_creativehub_sync where artwork_id = v_artwork_id for update;
  if v_sync_product is not null and v_sync_product <> p_product_id::text then
    raise exception 'Artwork is already linked to a different supplier product';
  end if;

  v_remote_count := jsonb_array_length(p_variants);
  for v_row in select value from jsonb_array_elements(p_variants) loop
    v_index := v_index + 1;
    if nullif(v_row->>'id','') is null or nullif(v_row->>'sku','') is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_remote_id := (v_row->>'id')::uuid;
    v_remote_sku := v_row->>'sku';
    v_width := (v_row->>'print_width_mm')::numeric;
    v_height := (v_row->>'print_height_mm')::numeric;
    if v_width <= 0 or v_height <= 0 then raise exception 'Supplier variant has invalid dimensions'; end if;

    select id, artwork_id, creativehub_sku into v_existing_local
      from public.print_variants where creativehub_variant_id::text = v_remote_id::text limit 1;
    if found then
      if v_existing_local.artwork_id <> v_artwork_id or v_existing_local.creativehub_sku is distinct from v_remote_sku then
        raise exception 'Variant already imported elsewhere or SKU changed; manual review required';
      end if;
      continue;
    end if;

    v_label := coalesce(nullif(v_row->>'size',''), nullif(v_row->>'size_label',''), 'Print ' || v_index::text);
    v_framed := coalesce((v_row->>'is_framed')::boolean,false);
    v_frame_color := nullif(v_row->>'frame_color','');
    v_paper := case lower(coalesce(v_row->>'paper_id',''))
      when '6' then 'Hahnemühle Photo Rag' when 'photo-rag' then 'Hahnemühle Photo Rag'
      when '1' then 'Hahnemühle German Etching' when 'german-etching' then 'Hahnemühle German Etching'
      when '2' then 'Hahnemühle Pearl' when 'pearl-giclee' then 'Hahnemühle Pearl'
      when '3' then 'Canson Baryta' when 'baryta' then 'Canson Baryta'
      when '5' then 'Hahnemühle Bamboo' when 'bamboo' then 'Hahnemühle Bamboo'
      else nullif(v_row->>'paper_id','') end;
    insert into public.print_variants (
      artwork_id, name, size_label, width_mm, height_mm, paper, framed, frame_style,
      price, currency, creativehub_product_id, creativehub_variant_id, creativehub_sku,
      active, sort_order
    ) values (
      v_artwork_id, v_label || case when v_framed then ' / framed' else '' end,
      (v_width / 10)::text || ' × ' || (v_height / 10)::text || ' cm',
      v_width, v_height, v_paper, v_framed,
      case when v_framed then initcap(coalesce(v_frame_color, '')) else null end,
      null, 'EUR', p_product_id, v_remote_id, v_remote_sku,
      false, v_index
    );
    v_created := v_created + 1;
  end loop;

  insert into public.creativehub_draft_imports (product_id, linked_artwork_id, product_json, variants_json, updated_at)
  values (p_product_id, v_artwork_id, p_product, p_variants, now())
  on conflict (product_id) do update
    set linked_artwork_id=excluded.linked_artwork_id,
        product_json=excluded.product_json,
        variants_json=excluded.variants_json,
        updated_at=now();

  insert into public.artwork_creativehub_sync (artwork_id, product_id, state, last_error)
  values (v_artwork_id, p_product_id,
          case when v_remote_count=0 then 'needs_review' else 'linked' end,
          case when v_remote_count=0 then 'Imported supplier draft has no print variants yet.' else null end)
  on conflict (artwork_id) do update
    set product_id=excluded.product_id,
        state=excluded.state,
        last_error=excluded.last_error,
        updated_at=now();

  return jsonb_build_object('artworkId', v_artwork_id, 'productId', p_product_id,
    'remoteVariants', v_remote_count, 'createdPrintOptions', v_created,
    'unusableSupplierVariants', v_skipped, 'published', false);
end;
$$;

revoke all on function public.studio_import_creativehub_draft(uuid,jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.studio_import_creativehub_draft(uuid,jsonb,jsonb,uuid,uuid) to service_role;

create or replace function public.studio_delete_artwork_guarded(p_artwork_id uuid, p_confirmation text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_title text;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service-role only operation'; end if;
  select title into v_title from public.artworks where id = p_artwork_id for update;
  if not found then raise exception 'Artwork not found'; end if;
  if p_confirmation is distinct from v_title then raise exception 'Confirmation title did not match'; end if;
  if exists (select 1 from public.order_items where artwork_id = p_artwork_id
       or print_variant_id in (select id from public.print_variants where artwork_id=p_artwork_id)) then
    raise exception 'This artwork has order history. Keep it for accounting; hide it instead of deleting.';
  end if;
  if exists (select 1 from public.artwork_creativehub_sync where artwork_id = p_artwork_id and
      (product_id is not null or drop_id is not null or upload_id is not null))
     or exists (select 1 from public.print_variants where artwork_id=p_artwork_id and
                (creativehub_product_id is not null or creativehub_variant_id is not null or creativehub_sku is not null)) then
    raise exception 'Supplier-linked artwork cannot be deleted directly. Hide it or safely unlink it first.';
  end if;
  delete from public.artwork_creativehub_sync where artwork_id=p_artwork_id;
  delete from public.print_variants where artwork_id=p_artwork_id;
  delete from public.artworks where id=p_artwork_id;
  -- No storage files or supplier resources are deleted.
  return true;
end;
$$;
revoke all on function public.studio_delete_artwork_guarded(uuid,text) from public, anon, authenticated;
grant execute on function public.studio_delete_artwork_guarded(uuid,text) to service_role;
