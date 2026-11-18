
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Selfie's confirmed Creativehub product ID.
const SELFIE_PRODUCT_ID =
  "77c09985-c75e-403d-bd37-7d97e59760b3";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonObject;
  }

  return {};
}

function previewVariant(value: unknown) {
  const variant = asObject(value);

  return {
    id: variant.id ?? null,
    sku: variant.sku ?? null,

    type: variant.type ?? null,
    size: variant.size ?? null,

    width_mm: variant.print_width_mm ?? null,
    height_mm: variant.print_height_mm ?? null,

    paper_id: variant.paper_id ?? null,

    framed: variant.is_framed ?? false,
    frame_color: variant.frame_color ?? null,
    frame_type: variant.frame_type ?? null,

    mount_board_size:
      variant.mount_board_size ?? null,

    retail_price:
      variant.retail_price ?? null,

    currency:
      variant.price_currency ?? null,

    delivery_price_uk:
      variant.delivery_price_uk ?? null,

    delivery_price_eu_na:
      variant.delivery_price_eu_na ?? null,

    delivery_price_row:
      variant.delivery_price_row ?? null,

    edition_size:
      variant.edition_size ?? null,

    availableFields: Object.keys(variant),
  };
}

export async function GET() {
  try {
    // ----------------------------------
    // 1. Authenticate the Studio user
    // ----------------------------------

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          connected: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------
    // 2. Check Studio admin access
    // ----------------------------------

    const {
      data: admin,
      error: adminError,
    } = await supabase
      .from("studio_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        {
          connected: false,
          error: "Studio admin access required.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------
    // 3. Read API configuration
    // ----------------------------------

    const token = process.env.ESCHER_API_TOKEN;

    const baseUrl = (
      process.env.ESCHER_API_BASE_URL ||
      "https://escher-v2.creativehub.io/v1"
    ).replace(/\/$/, "");

    if (!token) {
      return NextResponse.json(
        {
          connected: false,
          error: "ESCHER_API_TOKEN is missing.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------
    // 4. Fetch Selfie's variants
    // ----------------------------------

    const url =
      `${baseUrl}/products/` +
      `${SELFIE_PRODUCT_ID}/variants`;

    const response = await fetch(url, {
      method: "GET",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },

      cache: "no-store",

      signal: AbortSignal.timeout(15000),
    });

    // ----------------------------------
    // 5. Handle API errors
    // ----------------------------------

    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,

          apiStatus: response.status,

          message:
            response.status === 401
              ? "Creativehub rejected the API token."
              : response.status === 403
                ? "Your token does not have the required access."
                : response.status === 404
                  ? "Selfie was not found in your Creativehub catalogue."
                  : `Creativehub returned HTTP ${response.status}.`,
        },
        { status: response.status }
      );
    }

    // ----------------------------------
    // 6. Read the variant response
    // ----------------------------------

    const result: JsonObject =
      await response.json();

    const variants = Array.isArray(result.variants)
      ? result.variants
      : [];

    // ----------------------------------
    // 7. Return the variant details
    // ----------------------------------

    return NextResponse.json({
      connected: true,

      message:
        "Selfie variants retrieved successfully.",

      product: {
        id:
          result.product_id ??
          SELFIE_PRODUCT_ID,

        name: "Selfie",
      },

      variantCount: variants.length,

      variants: variants.map(previewVariant),
    });
  } catch (error) {
    console.error(
      "Creativehub variant lookup failed:",
      error
    );

    return NextResponse.json(
      {
        connected: false,

        error:
          "Could not retrieve Selfie variants. Check the Next.js terminal.",
      },
      { status: 500 }
    );
  }
}
