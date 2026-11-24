import { requireStudioMfa } from "@/lib/studio/requireStudioMfa";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuoteBody = {
  studioVariantId?: unknown;
  quantity?: unknown;
  country?: unknown;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function safeJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse: text.slice(0, 500),
    };
  }
}

export async function POST(request: Request) {
  const __letionMfa = await requireStudioMfa();
  if (!__letionMfa.ok) {
    return NextResponse.json(
      { error: __letionMfa.error },
      { status: __letionMfa.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    /*
     * -----------------------------------------
     * Authenticate Studio administrator
     * -----------------------------------------
     */

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } =
      await supabase
        .from("studio_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Studio administrator access required.",
        },
        { status: 403 }
      );
    }

    /*
     * -----------------------------------------
     * Parse request
     * -----------------------------------------
     */

    let body: QuoteBody;

    try {
      body = (await request.json()) as QuoteBody;
    } catch {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const studioVariantId =
      typeof body.studioVariantId === "string"
        ? body.studioVariantId.trim()
        : "";

    const quantity = Number(body.quantity);

    const country =
      typeof body.country === "string"
        ? body.country.trim().toUpperCase()
        : "";

    if (!UUID.test(studioVariantId)) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Invalid Studio variant.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Quantity must be between 1 and 50.",
        },
        { status: 400 }
      );
    }

    if (!/^[A-Z]{2}$/.test(country)) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Invalid destination country.",
        },
        { status: 400 }
      );
    }

    /*
     * -----------------------------------------
     * Get real mapped variant from Supabase
     * -----------------------------------------
     */

    const { data: variant, error: variantError } =
      await supabase
        .from("print_variants")
        .select(`
          id,
          artwork_id,
          name,
          paper,
          framed,
          frame_style,
          size_label,
          width_mm,
          height_mm,
          price,
          currency,
          active,
          creativehub_sku,
          creativehub_product_id,
          creativehub_variant_id
        `)
        .eq("id", studioVariantId)
        .single();

    if (variantError || !variant) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error: "Print variant not found.",
        },
        { status: 404 }
      );
    }

    // Admin-only quote previews must work for draft variants.
    // Catalog sync deliberately leaves mapped variants inactive until reviewed.

    if (!variant.creativehub_variant_id) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error:
            "This print variant has no Creativehub variant ID.",
        },
        { status: 400 }
      );
    }

    /*
     * -----------------------------------------
     * Artwork
     * -----------------------------------------
     */

    const { data: artwork } =
      await supabase
        .from("artworks")
        .select("id, title")
        .eq("id", variant.artwork_id)
        .single();

    /*
     * -----------------------------------------
     * Creativehub credentials
     * -----------------------------------------
     */

    const token =
      process.env.ESCHER_API_TOKEN;

    const baseUrl = (
      process.env.ESCHER_API_BASE_URL ||
      "https://escher-v2.creativehub.io/v1"
    ).replace(/\/$/, "");

    if (!token) {
      return NextResponse.json(
        {
          quoteSuccessful: false,
          error:
            "ESCHER_API_TOKEN is missing.",
        },
        { status: 500 }
      );
    }

    /*
     * -----------------------------------------
     * Creativehub quote
     * -----------------------------------------
     */

    const response = await fetch(
      `${baseUrl}/orders/quote`,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          items: [
            {
              variant_id:
                variant.creativehub_variant_id,
              quantity,
            },
          ],

          delivery_country_code:
            country,
        }),

        cache: "no-store",

        signal:
          AbortSignal.timeout(20000),
      }
    );

    const result =
      await safeJson(response);

    if (!response.ok) {
      console.error(
        "Creativehub quote error:",
        response.status,
        result
      );

      return NextResponse.json(
        {
          quoteSuccessful: false,

          apiStatus:
            response.status,

          error:
            response.status === 409
              ? "Creativehub cannot automatically quote delivery to this destination."
              : response.status === 429
                ? "Creativehub rate limit reached. Try again shortly."
                : `Creativehub quote failed with HTTP ${response.status}.`,

          details: result,
        },
        {
          status:
            response.status,
        }
      );
    }

    /*
     * -----------------------------------------
     * Return JSON only
     * -----------------------------------------
     */

    return NextResponse.json({
      quoteSuccessful: true,

      artwork: {
        id:
          artwork?.id ??
          variant.artwork_id,

        title:
          artwork?.title ??
          "Artwork",
      },

      variant: {
        studioVariantId:
          variant.id,

        creativehubProductId:
          variant.creativehub_product_id,

        creativehubVariantId:
          variant.creativehub_variant_id,

        sku:
          variant.creativehub_sku,

        name:
          variant.name,

        paper: variant.paper,
        framed: variant.framed,
        frameStyle: variant.frame_style,
        active: variant.active,

        size:
          variant.size_label,

        widthCm:
          variant.width_mm !== null
            ? Number(
                (
                  variant.width_mm /
                  10
                ).toFixed(1)
              )
            : null,

        heightCm:
          variant.height_mm !== null
            ? Number(
                (
                  variant.height_mm /
                  10
                ).toFixed(1)
              )
            : null,
      },

      request: {
        quantity,
        country,
      },

      website: {
        unitRetailPrice:
          variant.price !== null
            ? Number(
                variant.price
              )
            : null,

        currency:
          variant.currency,
      },

      creativehub: {
        currency:
          result.currency ??
          null,

        productionCost:
          result.production_cost ??
          null,

        deliveryCost:
          result.delivery_cost ??
          null,

        addonCost:
          result.addon_cost ??
          null,

        vat:
          result.total_vat ??
          null,

        totalExcludingVat:
          result.total_excl_vat ??
          null,

        totalIncludingVat:
          result.total_incl_vat ??
          null,

        ddpTotal:
          result.ddp_total ??
          null,
      },

      message:
        "Quotation calculated successfully. No production order was placed.",
    });
  } catch (error) {
    console.error(
      "Creativehub quote endpoint:",
      error
    );

    return NextResponse.json(
      {
        quoteSuccessful: false,

        error:
          "Creativehub quotation failed. Check the Next.js server console.",
      },
      {
        status: 500,
      }
    );
  }
}