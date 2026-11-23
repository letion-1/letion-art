-- LETION ART SECURITY / Stage 2: AAL2 MFA required for Studio reads and writes.
-- DO NOT RUN until:
--   1. Studio MFA enrollment UI is deployed,
--   2. You can enroll and verify at https://www.letionketienya.com/studio-security,
--   3. You can sign out, sign back in and verify a code,
--   4. Vercel STUDIO_REQUIRE_MFA=true is ALREADY deployed and tested.
BEGIN;

DO $$
DECLARE expected integer;
BEGIN
  SELECT count(*) INTO expected FROM pg_policies
  WHERE schemaname='public' AND (
     (tablename='orders' AND policyname IN ('Studio admins can view orders','Studio admins can update orders')) OR
     (tablename='order_items' AND policyname='Studio admins can view order items') OR
     (tablename='print_variants' AND policyname IN (
        'Studio admins can view all print variants',
        'Studio admins can insert print variants',
        'Studio admins can update print variants',
        'Studio admins can delete print variants'
     ))
  );
  IF expected <> 7 THEN
    RAISE EXCEPTION 'Expected 7 known admin policies, found %. No changes committed.', expected;
  END IF;
END $$;

-- Updating this SECURITY DEFINER check closes the old "Admins can ..."
-- paths on artworks/print_variants without changing public published reads.
CREATE OR REPLACE FUNCTION public.is_studio_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
    AND EXISTS (
      SELECT 1 FROM public.studio_admins
      WHERE user_id = auth.uid()
    );
$function$;

-- RLS permissive policies combine with OR. Update all duplicate admin paths.
ALTER POLICY "Studio admins can view orders" ON public.orders TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can update orders" ON public.orders TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()))
WITH CHECK (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can view order items" ON public.order_items TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can view all print variants" ON public.print_variants TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can insert print variants" ON public.print_variants TO authenticated
WITH CHECK (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can update print variants" ON public.print_variants TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()))
WITH CHECK (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

ALTER POLICY "Studio admins can delete print variants" ON public.print_variants TO authenticated
USING (COALESCE((auth.jwt() ->> 'aal') = 'aal2', FALSE)
  AND EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));

COMMIT;

-- Vercel Production STUDIO_REQUIRE_MFA=true should ALREADY be deployed.
-- Keep the auth enrolment route available for AAL1 users.
