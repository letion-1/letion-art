-- LETION ART / Creativehub Import -> Available as Print -> Customer Shop
-- Requires Phase 7, Phase 8 and Clean Creativehub Sync migrations.
-- Re-runnable. No orders or supplier products created or deleted.
-- Custom EUR retail prices remain unchanged. Prices auto-converted by this
-- integration refresh when Creativehub GBP prices change.

begin;

create table if not exists public.studio_creativehub_import_fx (
  artwork_id uuid primary key references public.artworks(id) on delete cascade,
  product_id uuid not null,
  gbp_to_eur numeric(16,8) not null check (gbp_to_eur between 0.5 and 3.0),
  reference_date date,
  last_synced_at timestamptz not null default now()
);
alter table public.studio_creativehub_import_fx enable row level security;
revoke all on public.studio_creativehub_import_fx from public, anon, authenticated;

-- Track which EUR prices we converted automatically. Only those may be
-- recalculated during a later Creativehub sync; manually edited EUR prices
-- are never overwritten.
create table if not exists public.studio_creativehub_auto_prices (
  variant_id uuid primary key references public.print_variants(id) on delete cascade,
  last_auto_eur numeric(14,2) not null,
  last_supplier_gbp numeric(14,2) not null,
  last_synced_at timestamptz not null default now()
);
alter table public.studio_creativehub_auto_prices enable row level security;
revoke all on public.studio_creativehub_auto_prices from public, anon, authenticated;


-- Do not automatically turn on an artwork's print-selling switch.
-- But *when the owner turns it on*, show the imported options whose supplier
-- snapshot and EUR price are complete. Never create or dispatch an order.
create or replace function public.studio_activate_imported_prints(p_artwork_id uuid)
returns integer language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_count integer:=0;
begin
  if not exists (
    select 1 from public.artworks where id=p_artwork_id
      and published=true and prints_available=true
  ) then return 0; end if;

  update public.print_variants pv set active=true
    from public.creativehub_draft_imports d,
      lateral jsonb_array_elements(d.variants_json) src
    where d.linked_artwork_id=p_artwork_id
      and pv.artwork_id=p_artwork_id
      and pv.creativehub_product_id::text=d.product_id::text
      and pv.creativehub_variant_id::text=src->>'id'
      and pv.creativehub_sku=src->>'sku'
      and pv.creativehub_sku is not null
      and pv.currency='EUR' and pv.price>0
      and pv.active=false;
  get diagnostics v_count=row_count;

  -- The user's Available as Print switch also authorizes the imported
  -- supplier display mockups for this print product. No print masters.
  update public.studio_creativehub_product_photos p set is_public=true
    from public.creativehub_draft_imports d
    where d.linked_artwork_id=p_artwork_id
      and p.artwork_id=p_artwork_id
      and p.product_id::text=d.product_id::text
      and (p.photo_type='artwork_preview' or exists (
        select 1 from public.print_variants pv where pv.artwork_id=p_artwork_id
          and pv.active=true and pv.creativehub_variant_id=p.supplier_variant_id
      ));
  -- An explicitly available imported artwork belongs in Manage Prints again.
  delete from public.studio_print_catalog_hidden h
    where h.artwork_id=p_artwork_id and exists (
      select 1 from public.creativehub_draft_imports d
      where d.linked_artwork_id=p_artwork_id
    );
  return v_count;
end;
$$;


-- Prepare the EUR prices for genuine Creativehub variants. Called after the
-- supplier import/sync completes. Enabling print availability is handled by
-- a separate trigger so toggling the artwork switch works normally.
create or replace function public.studio_prepare_imported_print_prices(
  p_artwork_id uuid,
  p_product_id uuid,
  p_rate numeric,
  p_reference_date date default null
)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare
  v_prepared integer := 0;
  v_activated integer := 0;
  v_photo_count integer := 0;
  v_art record;
  v_source record;
  v_local record;
  v_auto numeric;
  v_has_auto boolean;
  v_new_eur numeric;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role only';
  end if;
  if p_rate is null or p_rate < 0.5 or p_rate > 3.0 then
    raise exception 'Invalid GBP/EUR exchange rate';
  end if;
  select id,published,prints_available into v_art
    from public.artworks where id=p_artwork_id for update;
  if not found then raise exception 'Artwork not found'; end if;
  if not exists (
    select 1 from public.creativehub_draft_imports d
      where d.product_id::text=p_product_id::text and d.linked_artwork_id=p_artwork_id
  ) then raise exception 'The supplier snapshot does not belong to this artwork'; end if;

  insert into public.studio_creativehub_import_fx(
    artwork_id,product_id,gbp_to_eur,reference_date,last_synced_at
  ) values(p_artwork_id,p_product_id,p_rate,p_reference_date,now())
  on conflict(artwork_id) do update set
    product_id=excluded.product_id, gbp_to_eur=excluded.gbp_to_eur,
    reference_date=excluded.reference_date, last_synced_at=now();

  -- Match stable variant IDs and SKUs. Fill new prices, and refresh only
  -- prices that still match our previous automatic EUR conversion. An artist
  -- edited retail price is never replaced by a supplier/FX update.
  for v_source in
    select elem->>'id' as variant_id, elem->>'sku' as sku,
      case when upper(coalesce(elem->>'price_currency',''))='GBP'
        and coalesce(elem->>'retail_price','') ~ '^\d+(\.\d+)?$'
        then (elem->>'retail_price')::numeric else null end as gbp
    from public.creativehub_draft_imports d,
      lateral jsonb_array_elements(d.variants_json) elem
    where d.product_id=p_product_id and d.linked_artwork_id=p_artwork_id
  loop
    if v_source.gbp is null or v_source.gbp not between 0.01 and 100000
       or coalesce(v_source.variant_id,'')='' or coalesce(v_source.sku,'')='' then
      continue;
    end if;
    select id,price,currency into v_local from public.print_variants
      where artwork_id=p_artwork_id
        and creativehub_product_id::text=p_product_id::text
        and creativehub_variant_id::text=v_source.variant_id
        and creativehub_sku=v_source.sku
      for update;
    if not found then continue; end if;
    select last_auto_eur into v_auto from public.studio_creativehub_auto_prices
      where variant_id=v_local.id;
    v_has_auto := found;
    if v_local.price is null or (v_has_auto and v_local.currency='EUR'
         and v_local.price = v_auto) then
      v_new_eur := round(v_source.gbp*p_rate,2);
      update public.print_variants set price=v_new_eur,currency='EUR'
        where id=v_local.id;
      insert into public.studio_creativehub_auto_prices(
        variant_id,last_auto_eur,last_supplier_gbp,last_synced_at
      ) values(v_local.id,v_new_eur,v_source.gbp,now())
      on conflict(variant_id) do update set
        last_auto_eur=excluded.last_auto_eur,
        last_supplier_gbp=excluded.last_supplier_gbp,last_synced_at=now();
      v_prepared := v_prepared+1;
    end if;
  end loop;

  if v_art.published and v_art.prints_available then
    -- The artwork was already marked available. Bring its synchronized
    -- variants and associated product photos into the customer Shop.
    perform public.studio_activate_imported_prints(p_artwork_id);
    select count(*) into v_activated from public.print_variants pv
      where pv.artwork_id=p_artwork_id and pv.active=true
        and pv.creativehub_product_id::text=p_product_id::text
        and pv.price>0 and pv.currency='EUR';
    select count(*) into v_photo_count from public.studio_creativehub_product_photos
      where artwork_id=p_artwork_id and is_public=true;
  end if;

  return jsonb_build_object('pricesFilled',v_prepared,
    'shopOptions',v_activated,'publicPhotos',v_photo_count,
    'rate',p_rate,'referenceDate',p_reference_date,
    'printSellingEnabled',v_art.prints_available);
end;
$$;

-- The trigger is deliberately restricted to the artwork's existing
-- print availability / published switch. Importing alone does not publish.
create or replace function public.studio_imported_prints_availability_trigger()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if new.published is true and new.prints_available is true then
    perform public.studio_activate_imported_prints(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists letion_imported_prints_availability on public.artworks;
create trigger letion_imported_prints_availability
  after update of prints_available,published on public.artworks
  for each row when (new.prints_available is true and new.published is true)
  execute function public.studio_imported_prints_availability_trigger();

-- Atomic Studio action: activate this imported product's sale-ready variants.
-- A failed check rolls back the artwork switch rather than leaving an empty Shop.
create or replace function public.studio_make_imported_prints_available(p_product_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_artwork_id uuid; v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service-role only';
  end if;
  select linked_artwork_id into v_artwork_id
    from public.creativehub_draft_imports where product_id=p_product_id for update;
  if v_artwork_id is null then raise exception 'Import this Creativehub product first'; end if;
  if not exists(select 1 from public.artworks where id=v_artwork_id and published=true) then
    raise exception 'Publish this artwork in Studio before making its prints available';
  end if;
  if not exists(
    select 1 from public.print_variants pv,
      public.creativehub_draft_imports d,
      lateral jsonb_array_elements(d.variants_json) src
    where d.product_id=p_product_id and d.linked_artwork_id=v_artwork_id
      and pv.artwork_id=v_artwork_id
      and pv.creativehub_product_id::text=p_product_id::text
      and pv.creativehub_variant_id::text=src->>'id'
      and pv.creativehub_sku=src->>'sku'
      and pv.currency='EUR' and pv.price>0
  ) then
    raise exception 'No complete EUR-priced Creativehub variants. Sync latest and check pricing first';
  end if;
  update public.artworks set prints_available=true where id=v_artwork_id;
  select count(*) into v_count from public.print_variants pv
    where pv.artwork_id=v_artwork_id and pv.active=true
      and pv.creativehub_product_id::text=p_product_id::text
      and pv.currency='EUR' and pv.price>0;
  if v_count=0 then raise exception 'No print variants became active. Nothing was published'; end if;
  return jsonb_build_object('artworkId',v_artwork_id,'activeOptions',v_count);
end;
$$;

revoke all on function public.studio_make_imported_prints_available(uuid)
 from public,anon,authenticated;
grant execute on function public.studio_make_imported_prints_available(uuid) to service_role;

revoke all on function public.studio_prepare_imported_print_prices(uuid,uuid,numeric,date)
  from public,anon,authenticated;
grant execute on function public.studio_prepare_imported_print_prices(uuid,uuid,numeric,date)
  to service_role;
revoke all on function public.studio_activate_imported_prints(uuid)
  from public,anon,authenticated;
grant execute on function public.studio_activate_imported_prints(uuid) to service_role;
revoke all on function public.studio_imported_prints_availability_trigger()
  from public,anon,authenticated;

commit;

select to_regprocedure('public.studio_prepare_imported_print_prices(uuid,uuid,numeric,date)') as preparation_function,
 to_regprocedure('public.studio_activate_imported_prints(uuid)') as activation_function,
 to_regclass('public.studio_creativehub_import_fx') as exchange_rate_table,
 to_regclass('public.studio_creativehub_auto_prices') as auto_prices_table;
