-- EMERGENCY rollback of Stage 2 MFA policy changes ONLY.
-- This restores the original membership policies seen in the user-provided
-- audit. It weakens security: use only to recover legitimate admin access.
-- Stage 1 payment privilege restrictions remain intact.
BEGIN;
CREATE OR REPLACE FUNCTION public.is_studio_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id = auth.uid());
$function$;

ALTER POLICY "Studio admins can view orders" ON public.orders TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can update orders" ON public.orders TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can view order items" ON public.order_items TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can view all print variants" ON public.print_variants TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can insert print variants" ON public.print_variants TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can update print variants" ON public.print_variants TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
ALTER POLICY "Studio admins can delete print variants" ON public.print_variants TO authenticated
USING (EXISTS (SELECT 1 FROM public.studio_admins WHERE user_id=auth.uid()));
COMMIT;
