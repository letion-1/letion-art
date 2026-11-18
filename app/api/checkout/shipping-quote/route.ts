import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutRequestItem = {
  variantId?: unknown;
  quantity?: unknown;
};

type ShippingAddressInput = {
  name?: unknown;
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  postcode?: unknown;
  state?: unknown;
  country?: unknown;
};

type QuoteBody = {
  items?: unknown;
  shippingAddress?: ShippingAddressInput;
};

type PrintVariantRow = {
  id: string;
  artwork_id: string;
  name: string;
  price: number | null;
  currency: string;
  active: boolean;
  creativehub_variant_id: string | null;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function readJson(
  response: Response
): Promise<Record<string, unknown>> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      rawResponse: text.slice(0, 500),
    };
  }
}

async function getFxRate(
  from: string,
  to: string
) {
  const source = from.toUpperCase();
  const target = to.toUpperCase();

  if (source === target) {
    return {
      rate: 1,
      date: null as string | null,
    };
  }

  if (
    !/^[A-Z]{3}$/.test(source) ||
    !/^[A-Z]{3}$/.test(target)
  ) {
    throw new Error(
      "Invalid currency code."
    );
  }

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${source.toLowerCase()}/${target.toLowerCase()}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal:
        AbortSignal.timeout(10000),
    }
  );

  const result =
    await readJson(response);

  if (!response.ok) {
    throw new Error(
      "Could not convert the Creativehub shipping currency."
    );
  }

  const rate =
    Number(result.rate);

  if (
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error(
      "The exchange-rate service returned an invalid rate."
    );
  }

  return {
    rate,
    date:
      typeof result.date ===
      "string"
        ? result.date
        : null,
  };
}

export async function POST(
  request: Request
) {
  try {
    let body: QuoteBody;

    try {
      body =
        (await request.json()) as QuoteBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(
        body.items
      ) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Your cart is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      body.items.length > 20
    ) {
      return NextResponse.json(
        {
          error:
            "Too many items in cart.",
        },
        {
          status: 400,
        }
      );
    }

    const requestedItems =
      (
        body.items as CheckoutRequestItem[]
      ).map((item) => ({
        variantId:
          cleanString(
            item.variantId
          ),

        quantity:
          typeof item.quantity ===
          "number"
            ? item.quantity
            : Number(
                item.quantity
              ),
      }));

    const address = {
      name:
        cleanString(
          body.shippingAddress
            ?.name
        ),

      line1:
        cleanString(
          body.shippingAddress
            ?.line1
        ),

      line2:
        cleanString(
          body.shippingAddress
            ?.line2
        ),

      city:
        cleanString(
          body.shippingAddress
            ?.city
        ),

      postcode:
        cleanString(
          body.shippingAddress
            ?.postcode
        ),

      state:
        cleanString(
          body.shippingAddress
            ?.state
        ),

      country:
        cleanString(
          body.shippingAddress
            ?.country
        ).toUpperCase(),
    };

    if (
      !address.name ||
      !address.line1 ||
      !address.city ||
      !address.postcode
    ) {
      return NextResponse.json(
        {
          error:
            "Complete the delivery name, address, city and postcode.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !/^[A-Z]{2}$/.test(
        address.country
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a valid delivery country.",
        },
        {
          status: 400,
        }
      );
    }

    const quantities =
      new Map<
        string,
        number
      >();

    for (
      const item of requestedItems
    ) {
      if (
        !item.variantId
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid print variant.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !Number.isInteger(
          item.quantity
        ) ||
        item.quantity < 1 ||
        item.quantity > 10
      ) {
        return NextResponse.json(
          {
            error:
              "Quantity must be between 1 and 10.",
          },
          {
            status: 400,
          }
        );
      }

      const next =
        (
          quantities.get(
            item.variantId
          ) ?? 0
        ) +
        item.quantity;

      if (
        next > 10
      ) {
        return NextResponse.json(
          {
            error:
              "Maximum quantity is 10 per print option.",
          },
          {
            status: 400,
          }
        );
      }

      quantities.set(
        item.variantId,
        next
      );
    }

    const variantIds =
      Array.from(
        quantities.keys()
      );

    const supabase =
      createAdminClient();

    const {
      data:
        variantData,

      error:
        variantError,
    } = await supabase
      .from(
        "print_variants"
      )
      .select(`
        id,
        artwork_id,
        name,
        price,
        currency,
        active,
        creativehub_variant_id
      `)
      .in(
        "id",
        variantIds
      );

    if (
      variantError
    ) {
      throw variantError;
    }

    const variants =
      (
        variantData ??
        []
      ) as PrintVariantRow[];

    if (
      variants.length !==
      variantIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "One or more print options no longer exist.",
        },
        {
          status: 400,
        }
      );
    }

    const currencies =
      new Set<string>();

    let subtotal = 0;

    const creativehubItems:
      Array<{
        variant_id: string;
        quantity: number;
      }> = [];

    for (
      const variant of variants
    ) {
      const quantity =
        quantities.get(
          variant.id
        );

      if (
        !quantity
      ) {
        continue;
      }

      if (
        !variant.active
      ) {
        return NextResponse.json(
          {
            error:
              `${variant.name} is no longer available.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        variant.price ===
          null ||
        !Number.isFinite(
          Number(
            variant.price
          )
        ) ||
        Number(
          variant.price
        ) <= 0
      ) {
        return NextResponse.json(
          {
            error:
              `${variant.name} does not have a valid retail price.`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        !variant
          .creativehub_variant_id
      ) {
        return NextResponse.json(
          {
            error:
              `${variant.name} is not connected to a Creativehub variant yet.`,
          },
          {
            status: 400,
          }
        );
      }

      currencies.add(
        variant.currency.toUpperCase()
      );

      subtotal +=
        Number(
          variant.price
        ) *
        quantity;

      creativehubItems.push({
        variant_id:
          variant
            .creativehub_variant_id,

        quantity,
      });
    }

    if (
      currencies.size !==
      1
    ) {
      return NextResponse.json(
        {
          error:
            "All cart items must use the same currency.",
        },
        {
          status: 400,
        }
      );
    }

    const storeCurrency =
      Array.from(
        currencies
      )[0];

    subtotal =
      roundMoney(
        subtotal
      );

    const token =
      process.env
        .ESCHER_API_TOKEN;

    const baseUrl = (
      process.env
        .ESCHER_API_BASE_URL ||
      "https://escher-v2.creativehub.io/v1"
    ).replace(
      /\/$/,
      ""
    );

    if (
      !token
    ) {
      return NextResponse.json(
        {
          error:
            "Creativehub API is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const quoteResponse =
      await fetch(
        `${baseUrl}/orders/quote`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              items:
                creativehubItems,

              delivery_country_code:
                address.country,
            }),

          cache:
            "no-store",

          signal:
            AbortSignal.timeout(
              20000
            ),
        }
      );

    const quote =
      await readJson(
        quoteResponse
      );

    if (
      !quoteResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            quoteResponse.status ===
            409
              ? "Creativehub cannot automatically quote delivery to this country."
              : quoteResponse.status ===
                  429
                ? "Creativehub is temporarily rate-limiting quotes. Try again shortly."
                : "Creativehub could not calculate delivery.",

          details:
            quote,
        },
        {
          status:
            quoteResponse.status ===
            409
              ? 409
              : 502,
        }
      );
    }

    const supplierCurrency =
      typeof quote.currency ===
      "string"
        ? quote.currency.toUpperCase()
        : "";

    const supplierDeliveryCost =
      Number(
        quote.delivery_cost
      );

    if (
      !supplierCurrency ||
      !Number.isFinite(
        supplierDeliveryCost
      ) ||
      supplierDeliveryCost <
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Creativehub returned an invalid delivery quote.",
        },
        {
          status: 502,
        }
      );
    }

    const fx =
      await getFxRate(
        supplierCurrency,
        storeCurrency
      );

    const shippingAmount =
      roundMoney(
        supplierDeliveryCost *
          fx.rate
      );

    const totalBeforeCustomerTax =
      roundMoney(
        subtotal +
          shippingAmount
      );

    return NextResponse.json({
      quoteSuccessful:
        true,

      currency:
        storeCurrency,

      subtotal,

      shippingAmount,

      totalBeforeCustomerTax,

      destinationCountry:
        address.country,

      creativehub: {
        currency:
          supplierCurrency,

        deliveryCost:
          supplierDeliveryCost,

        productionCost:
          quote.production_cost ==
          null
            ? null
            : Number(
                quote.production_cost
              ),

        vat:
          quote.total_vat ==
          null
            ? null
            : Number(
                quote.total_vat
              ),

        totalIncludingVat:
          quote.total_incl_vat ==
          null
            ? null
            : Number(
                quote.total_incl_vat
              ),
      },

      conversion: {
        from:
          supplierCurrency,

        to:
          storeCurrency,

        rate:
          fx.rate,

        date:
          fx.date,
      },

      note:
        "Shipping is calculated from Creativehub's cart quote for the selected destination country. No production order was placed.",
    });
  } catch (
    error
  ) {
    console.error(
      "Shipping quote error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Could not calculate shipping.",
      },
      {
        status: 500,
      }
    );
  }
}