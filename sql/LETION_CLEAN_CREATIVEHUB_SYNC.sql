-- LETION ART / Clean Creativehub Import + Sync
-- Run in Supabase SQL Editor after Phase 7 and Phase 8 migrations.
-- Replaces only the existing importer RPC. Does not delete artworks,
-- galleries, Creativehub products or order records.
-- Existing customer EUR prices are NEVER overwritten.

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
  v_name text;
  v_paper text;
  v_framed boolean;
  v_frame_color text;
  v_existing_local record;
  v_index integer := 0;
  v_created integer := 0;
  v_skipped integer := 0;
  v_updated integer := 0;
  v_removed integer := 0;
  v_relinked boolean := false;
  v_has_order boolean;
  v_dim_text text;
  v_prior_product uuid;
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
    -- An artwork explicitly removed from Manage Prints may be re-imported with
    -- a different supplier product, provided no order ever used its old options.
    -- Never reassign an active listing or alter order-linked print options.
    if not exists (select 1 from public.studio_print_catalog_hidden where artwork_id=v_artwork_id) then
      raise exception 'This artwork has a different Creativehub product. Use Remove from Prints first to replace its print setup.';
    end if;
    select exists (
      select 1 from public.order_items oi
      where oi.artwork_id=v_artwork_id
        or oi.print_variant_id in (select pv.id from public.print_variants pv where pv.artwork_id=v_artwork_id)
    ) into v_has_order;
    if v_has_order then
      raise exception 'Existing print options have customer order history. Cannot replace their supplier mapping automatically.';
    end if;
    if jsonb_array_length(p_variants)=0 then
      raise exception 'Replacement Creativehub product has no configured variants. Keep the existing print setup until ready.';
    end if;
    -- No orders depend on these old print options. Clear only print-side
    -- data; original artwork, portfolio, source images and collection stay.
    delete from public.print_variants where artwork_id=v_artwork_id;
    delete from public.studio_creativehub_product_photos where artwork_id=v_artwork_id;
    update public.artworks set
      prints_available=false,
      source_key = case when source_key='creativehub/' || v_sync_product
        then 'creativehub/' || p_product_id::text else source_key end
      where id=v_artwork_id;
    update public.creativehub_draft_imports set linked_artwork_id=null, updated_at=now()
      where linked_artwork_id=v_artwork_id and product_id<>p_product_id;
    update public.artwork_creativehub_sync
       set product_id=p_product_id, drop_id=null, upload_id=null, state='needs_review',last_error=null,updated_at=now()
       where artwork_id=v_artwork_id;
    v_relinked := true;
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
    -- Skip supplier variants that have not been configured completely.
    if coalesce(v_row->>'print_width_mm','') !~ '^\d+(\.\d+)?$'
       or coalesce(v_row->>'print_height_mm','') !~ '^\d+(\.\d+)?$' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_width := (v_row->>'print_width_mm')::numeric;
    v_height := (v_row->>'print_height_mm')::numeric;
    if v_width <= 0 or v_height <= 0 then raise exception 'Supplier variant has invalid dimensions'; end if;

    select id, artwork_id, creativehub_sku into v_existing_local
      from public.print_variants where creativehub_variant_id::text = v_remote_id::text limit 1;
    if found and v_existing_local.artwork_id <> v_artwork_id then
      raise exception 'Creativehub variant is already linked to another artwork. No data was changed.';
    end if;

    v_label := coalesce(nullif(v_row->>'size',''), nullif(v_row->>'size_label',''), 'Print ' || v_index::text);
    v_framed := coalesce((v_row->>'is_framed')::boolean,false);
    v_frame_color := nullif(v_row->>'frame_color','');
    v_name := v_label || case when v_framed then ' / framed' ||
      case when coalesce(v_frame_color, nullif(v_row->>'frame_type','')) is not null
        then ' / ' || initcap(coalesce(v_frame_color,nullif(v_row->>'frame_type','')))
        else '' end else '' end;
    -- Use the frame color or frame type to distinguish supplier variants.
    -- Avoid long repeating fractional dimensions in Studio.
    v_dim_text := rtrim(rtrim(round(v_width / 10, 2)::text, '0'), '.');
    if v_width % 10 = 0 then v_dim_text := (v_width / 10)::integer::text; end if;
    v_dim_text := v_dim_text || ' × ' ||
      case when v_height % 10 = 0 then (v_height / 10)::integer::text
      else rtrim(rtrim(round(v_height / 10,2)::text,'0'),'.') end || ' cm';
    v_paper := case lower(coalesce(v_row->>'paper_id',''))
      when '6' then 'Hahnemühle Photo Rag' when 'photo-rag' then 'Hahnemühle Photo Rag'
      when '1' then 'Hahnemühle German Etching' when 'german-etching' then 'Hahnemühle German Etching'
      when '2' then 'Hahnemühle Pearl' when 'pearl-giclee' then 'Hahnemühle Pearl'
      when '3' then 'Canson Baryta' when 'baryta' then 'Canson Baryta'
      when '5' then 'Hahnemühle Bamboo' when 'bamboo' then 'Hahnemühle Bamboo'
      else nullif(v_row->>'paper_id','') end;
    if v_existing_local.id is not null
       and v_existing_local.creativehub_sku is distinct from v_remote_sku
       and exists(select 1 from public.order_items oi where oi.print_variant_id=v_existing_local.id)
    then
      -- Historical orders use the former SKU. Never rewrite their underlying
      -- print option. Deactivate it and report that manual review is needed.
      update public.print_variants set active=false where id=v_existing_local.id;
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_existing_local.id is not null then
      -- Preserve the customer's EUR retail price and active flag.
      -- If the supplier changed SKU, deactivate only that variant until reviewed.
      update public.print_variants pv set
        name = v_name,
        size_label = v_dim_text,
        width_mm = v_width, height_mm = v_height,
        paper = v_paper, framed = v_framed,
        frame_style = case when v_framed then initcap(coalesce(v_frame_color, nullif(v_row->>'frame_type',''), '')) else null end,
        creativehub_product_id = p_product_id,
        creativehub_sku = v_remote_sku,
        active = case when pv.creativehub_sku is distinct from v_remote_sku then false else pv.active end
      where pv.id=v_existing_local.id and pv.artwork_id=v_artwork_id;
      v_updated := v_updated + 1;
    else
      insert into public.print_variants (
        artwork_id, name, size_label, width_mm, height_mm, paper, framed, frame_style,
        price, currency, creativehub_product_id, creativehub_variant_id, creativehub_sku,
        active, sort_order
      ) values (
        v_artwork_id, v_name,
        v_dim_text, v_width, v_height, v_paper, v_framed,
        case when v_framed then initcap(coalesce(v_frame_color, nullif(v_row->>'frame_type',''), '')) else null end,
        null, 'EUR', p_product_id, v_remote_id, v_remote_sku,
        false, v_index
      );
      v_created := v_created + 1;
    end if;
  end loop;

  -- Retired supplier variants remain for historical purposes but cannot be bought.
  -- Do not disable everything on an empty supplier response.
  if v_remote_count > 0 then
    update public.print_variants pv set active=false
      where pv.artwork_id=v_artwork_id and pv.creativehub_product_id=p_product_id
        and pv.creativehub_variant_id is not null and pv.active=true
        and not exists (
          select 1 from jsonb_array_elements(p_variants) r
          where r->>'id'=pv.creativehub_variant_id::text
        );
    get diagnostics v_removed = row_count;
  end if;

  -- Keep explicitly edited website artwork titles/descriptions. Refresh
  -- supplier-owned metadata only for an imported artwork that has not been
  -- customized since its last supplier snapshot.
  update public.artworks a set
    title=v_title,
    description=nullif(p_product->>'description','')
    from public.creativehub_draft_imports old
    where a.id=v_artwork_id and a.source_key=v_source_key
      and old.product_id=p_product_id and old.linked_artwork_id=v_artwork_id
      and a.title=coalesce(nullif(old.product_json->>'name',''),old.product_json->>'title')
      and a.description is not distinct from nullif(old.product_json->>'description','');

  -- Refresh the website preview only when it was still pointing at the old
  -- supplier preview. Never overwrite a locally uploaded master/preview.
  update public.artworks a set image_url=v_image_url
   from public.creativehub_draft_imports old
   where a.id=v_artwork_id and a.source_key=v_source_key
     and a.image_path is null and v_image_url is not null
     and old.product_id=p_product_id and old.linked_artwork_id=v_artwork_id
     and a.image_url in (
       old.product_json->>'artwork_preview_medium_url',
       old.product_json->>'artwork_thumbnail_url',
       old.product_json->>'artwork_url'
     );

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

  -- Re-import after deliberate removal restores it to Manage Prints.
  -- Website selling stays disabled until the user explicitly enables it.
  delete from public.studio_print_catalog_hidden where artwork_id=v_artwork_id;

  return jsonb_build_object('artworkId', v_artwork_id, 'productId', p_product_id,
    'remoteVariants', v_remote_count, 'createdPrintOptions', v_created,
    'updatedPrintOptions', v_updated, 'disabledUnavailableOptions', v_removed,
    'relinkedPrintSetup', v_relinked,
    'unusableSupplierVariants', v_skipped,
    'published', (select published from public.artworks where id=v_artwork_id));
end;
$$;


revoke all on function public.studio_import_creativehub_draft(uuid,jsonb,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.studio_import_creativehub_draft(uuid,jsonb,jsonb,uuid,uuid) to service_role;
