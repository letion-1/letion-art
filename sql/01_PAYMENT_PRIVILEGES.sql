-- LETION ART SECURITY / Stage 1: payment field lockdown.
-- Run only after deploying and testing the included application code.
-- Does not modify any orders, payments or artworks.
-- The checkout and webhook source provided for this release writes via
-- SUPABASE_SERVICE_ROLE_KEY. Browser sessions must never mutate these records.
BEGIN;

DO $$
BEGIN
  IF NOT (has_table_privilege('service_role','public.orders','UPDATE')
       AND has_table_privilege('service_role','public.orders','INSERT')
       AND has_table_privilege('service_role','public.order_items','INSERT')
       AND has_table_privilege('service_role','public.studio_admins','SELECT')) THEN
    RAISE EXCEPTION 'STOP: service_role privileges are missing. No changes have been committed.';
  END IF;
END $$;

-- Only server-side service-role operations may write payment/order rows or
-- change the administrator membership table.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.orders, public.order_items, public.studio_admins
  FROM PUBLIC, anon, authenticated;

-- Remove any additional column-specific INSERT/UPDATE grants too.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN ('orders','order_items','studio_admins')
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      r.column_name, r.column_name, r.table_name);
  END LOOP;
END $$;

-- Public browser reads should include only active, priced, published prints.
-- Admins retain their separate RLS SELECT policies; service_role bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='print_variants'
      AND policyname='Public can view print variants for published artworks'
  ) THEN
    RAISE EXCEPTION 'Expected print variant RLS policy was not found. No changes committed.';
  END IF;
END $$;

ALTER POLICY "Public can view print variants for published artworks"
ON public.print_variants TO anon, authenticated
USING (
  active IS TRUE AND price > 0 AND currency = 'EUR'
  AND EXISTS (
    SELECT 1 FROM public.artworks a
    WHERE a.id = print_variants.artwork_id
      AND a.published IS TRUE AND a.prints_available IS TRUE
  )
);

DO $$
BEGIN
  IF has_table_privilege('anon','public.orders','UPDATE')
     OR has_table_privilege('authenticated','public.orders','UPDATE')
     OR has_column_privilege('authenticated','public.orders','status','UPDATE')
     OR has_column_privilege('authenticated','public.orders','paid_at','UPDATE')
     OR has_table_privilege('authenticated','public.order_items','UPDATE')
     OR has_table_privilege('authenticated','public.studio_admins','UPDATE')
     OR NOT has_table_privilege('service_role','public.orders','UPDATE')
     OR NOT has_table_privilege('service_role','public.order_items','INSERT') THEN
    RAISE EXCEPTION 'Privilege verification failed; entire migration rolled back.';
  END IF;
END $$;
COMMIT;

-- Optional read-only verification:
SELECT 'orders' AS table_name, has_table_privilege('anon','public.orders','UPDATE') AS anon_update,
  has_table_privilege('authenticated','public.orders','UPDATE') AS authenticated_update,
  has_table_privilege('service_role','public.orders','UPDATE') AS service_role_update
UNION ALL
SELECT 'order_items',has_table_privilege('anon','public.order_items','UPDATE'),
  has_table_privilege('authenticated','public.order_items','UPDATE'),
  has_table_privilege('service_role','public.order_items','UPDATE')
UNION ALL
SELECT 'studio_admins',has_table_privilege('anon','public.studio_admins','UPDATE'),
  has_table_privilege('authenticated','public.studio_admins','UPDATE'),
  has_table_privilege('service_role','public.studio_admins','UPDATE');
