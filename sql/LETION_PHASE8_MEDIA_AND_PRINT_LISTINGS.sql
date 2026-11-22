
-- ============================================================
-- LETION ART
-- PHASE 8: CREATIVEHUB PRODUCT PHOTOS & PRINT MANAGEMENT
-- ============================================================
-- SAFE, RE-RUNNABLE MIGRATION
--
-- This migration DOES NOT:
-- - Delete artwork records
-- - Delete original artwork files
-- - Delete WebP previews
-- - Delete Creativehub products
-- - Delete print variants or supplier mappings
-- - Modify previous customer orders
-- - Submit orders to production
--
-- ============================================================


-- ============================================================
-- 1. HIDDEN PRINT LISTINGS
-- ============================================================
-- Tracks artworks removed from Manage Prints.
-- The actual artwork remains in the portfolio.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_print_catalog_hidden (
    artwork_id UUID PRIMARY KEY
        REFERENCES public.artworks(id)
        ON DELETE CASCADE,

    hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.studio_print_catalog_hidden
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.studio_print_catalog_hidden
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 2. CREATIVEHUB PRODUCT PHOTO GALLERY
-- ============================================================
-- Stores available Creativehub product image references.
-- Images are not copied into Supabase Storage.
--
-- Supports:
-- - Artwork previews
-- - Supplier mockups
-- - Variant-specific product photos
-- - Public image selection
-- - Image ordering
-- - Image captions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.studio_creativehub_product_photos (
    artwork_id UUID NOT NULL
        REFERENCES public.artworks(id)
        ON DELETE CASCADE,

    product_id UUID NOT NULL,

    photo_key TEXT NOT NULL
        CHECK (
            LENGTH(photo_key) BETWEEN 1 AND 128
        ),

    photo_type TEXT NOT NULL
        CHECK (
            photo_type IN (
                'artwork_preview',
                'supplier_mockup'
            )
        ),

    supplier_variant_id UUID,

    image_url TEXT NOT NULL
        CHECK (
            image_url ~* '^https://'
        ),

    caption TEXT NOT NULL DEFAULT '',

    is_public BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order INTEGER NOT NULL DEFAULT 999,

    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        artwork_id,
        photo_key
    )
);


-- ============================================================
-- 3. PRODUCT PHOTO INDEX
-- ============================================================
-- Speeds up public gallery image retrieval.
-- ============================================================

CREATE INDEX IF NOT EXISTS
    letion_print_photos_published_idx
ON public.studio_creativehub_product_photos (
    artwork_id,
    is_public,
    sort_order
);


-- ============================================================
-- 4. PRODUCT PHOTO SECURITY
-- ============================================================
-- Direct public access is disabled.
-- Approved server routes control image access.
-- ============================================================

ALTER TABLE public.studio_creativehub_product_photos
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON public.studio_creativehub_product_photos
FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 5. REMOVE ARTWORK FROM MANAGE PRINTS
-- ============================================================
-- IMPORTANT:
-- This does NOT delete the actual artwork.
--
-- It will:
-- 1. Disable print availability
-- 2. Deactivate associated print variants
-- 3. Hide the artwork from Manage Prints
--
-- It preserves:
-- - Original artwork record
-- - Website gallery images
-- - Collections and portfolio entries
-- - Print variant records
-- - Creativehub product IDs
-- - Creativehub SKUs
-- - Customer orders
-- - Supplier product data
-- ============================================================

CREATE OR REPLACE FUNCTION
public.studio_hide_print_listing(
    p_artwork_id UUID,
    p_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_title TEXT;
BEGIN

    -- Only the backend service role may execute this.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Service-role only';
    END IF;

    -- Lock and verify the artwork.
    SELECT title
    INTO v_title
    FROM public.artworks
    WHERE id = p_artwork_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artwork not found';
    END IF;

    -- Prevent accidental removal of the wrong listing.
    IF p_title IS DISTINCT FROM v_title THEN
        RAISE EXCEPTION
            'Artwork title confirmation mismatch';
    END IF;

    -- Disable print selling for this artwork.
    UPDATE public.artworks
    SET prints_available = FALSE
    WHERE id = p_artwork_id;

    -- Deactivate print variants without deleting them.
    UPDATE public.print_variants
    SET active = FALSE
    WHERE artwork_id = p_artwork_id;

    -- Hide from Manage Prints.
    INSERT INTO public.studio_print_catalog_hidden (
        artwork_id,
        hidden_at
    )
    VALUES (
        p_artwork_id,
        NOW()
    )
    ON CONFLICT (artwork_id)
    DO UPDATE SET
        hidden_at = NOW();

    RETURN TRUE;

END;
$$;

REVOKE ALL
ON FUNCTION public.studio_hide_print_listing(
    UUID,
    TEXT
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.studio_hide_print_listing(
    UUID,
    TEXT
)
TO service_role;


-- ============================================================
-- 6. RESTORE ARTWORK TO MANAGE PRINTS
-- ============================================================
-- Restores print-management visibility.
--
-- IMPORTANT:
-- Does NOT automatically reactivate print selling.
-- Print variants remain disabled until reviewed.
-- ============================================================

CREATE OR REPLACE FUNCTION
public.studio_restore_print_listing(
    p_artwork_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN

    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Service-role only';
    END IF;

    -- Verify and lock artwork.
    PERFORM 1
    FROM public.artworks
    WHERE id = p_artwork_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Artwork not found';
    END IF;

    -- Restore visibility only.
    DELETE
    FROM public.studio_print_catalog_hidden
    WHERE artwork_id = p_artwork_id;

    RETURN TRUE;

END;
$$;

REVOKE ALL
ON FUNCTION public.studio_restore_print_listing(
    UUID
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.studio_restore_print_listing(
    UUID
)
TO service_role;


-- ============================================================
-- 7. SELECT AND ORDER CREATIVEHUB PRODUCT PHOTOS
-- ============================================================
-- Saves which supplier images appear on the website.
--
-- Features:
-- - Rejects invalid selections
-- - Rejects duplicate photo keys
-- - Rejects unknown images
-- - Preserves selected image order
-- - Hides unselected photos
-- - Does not modify Creativehub products
-- - Does not change print masters
-- ============================================================

CREATE OR REPLACE FUNCTION
public.studio_set_print_photo_selection(
    p_artwork_id UUID,
    p_keys TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN

    -- Restrict to backend service role.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Service-role only';
    END IF;

    -- Validate selection count.
    IF p_keys IS NULL
       OR CARDINALITY(p_keys) > 60
    THEN
        RAISE EXCEPTION 'Invalid photo selection';
    END IF;

    -- Reject duplicate photo keys.
    IF (
        SELECT COUNT(DISTINCT k.photo_key)
        FROM UNNEST(p_keys) AS k(photo_key)
    ) <> CARDINALITY(p_keys)
    THEN
        RAISE EXCEPTION 'Duplicate photo keys';
    END IF;

    -- Reject image keys that do not belong to this artwork.
    IF EXISTS (
        SELECT 1
        FROM UNNEST(p_keys) AS k(photo_key)
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.studio_creativehub_product_photos AS p
            WHERE p.artwork_id = p_artwork_id
              AND p.photo_key = k.photo_key
        )
    )
    THEN
        RAISE EXCEPTION
            'Photo selection contains an unknown image';
    END IF;

    -- Update public visibility and ordering.
    UPDATE public.studio_creativehub_product_photos AS p
    SET
        is_public = (
            p.photo_key = ANY(p_keys)
        ),

        sort_order = COALESCE(
            ARRAY_POSITION(p_keys, p.photo_key),
            999
        )

    WHERE p.artwork_id = p_artwork_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;

END;
$$;

REVOKE ALL
ON FUNCTION public.studio_set_print_photo_selection(
    UUID,
    TEXT[]
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.studio_set_print_photo_selection(
    UUID,
    TEXT[]
)
TO service_role;


-- ============================================================
-- 8. LEGACY DELETE PROTECTION
-- ============================================================
-- Phase 7 contained an artwork-deletion API.
--
-- Phase 8 replaces that HTTP endpoint with HTTP 410 Gone.
--
-- The older SQL deletion function is intentionally retained
-- until all other callers have been audited.
--
-- Do not execute the legacy deletion function from
-- the Manage Prints interface.
-- ============================================================


-- ============================================================
-- 9. VERIFY DATABASE OBJECTS
-- ============================================================

SELECT
    to_regclass(
        'public.studio_print_catalog_hidden'
    ) AS hidden_listings,

    to_regclass(
        'public.studio_creativehub_product_photos'
    ) AS product_photos,

    to_regprocedure(
        'public.studio_hide_print_listing(uuid,text)'
    ) AS hide_function,

    to_regprocedure(
        'public.studio_restore_print_listing(uuid)'
    ) AS restore_function,

    to_regprocedure(
        'public.studio_set_print_photo_selection(uuid,text[])'
    ) AS photo_selection_function;


-- ============================================================
-- END OF LETION ART PHASE 8 MIGRATION
-- ============================================================
