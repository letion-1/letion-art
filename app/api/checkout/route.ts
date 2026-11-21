import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  stripe,
} from "@/lib/stripe";

export const runtime =
  "nodejs";

type CheckoutRequestItem = {
  variantId?: unknown;
  quantity?: unknown;
};

type ShippingAddressInput = {
  name?: unknown;
  phone?: unknown;
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  postcode?: unknown;
  state?: unknown;
  country?: unknown;
};

type CheckoutBody = {
  items?: unknown;
  shippingAddress?: ShippingAddressInput;
};

type PrintVariantRow = {
  id: string;
  artwork_id: string;

  name: string;

  size_label:
    | string
    | null;

  price:
    | number
    | null;

  currency: string;

  paper:
    | string
    | null;

  finish:
    | string
    | null;

  framed: boolean;

  frame_style:
    | string
    | null;

  creativehub_sku:
    | string
    | null;

  creativehub_product_id:
    | string
    | null;

  creativehub_variant_id:
    | string
    | null;

  active: boolean;
};

type ArtworkRow = {
  id: string;
  slug: string;
  title: string;

  image_url:
    | string
    | null;

  published: boolean;
  prints_available: boolean;
};

type ValidatedItem = {
  variant:
    PrintVariantRow;

  artwork:
    ArtworkRow;

  quantity: number;
};

function cleanString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

async function readJson(
  response: Response
): Promise<
  Record<
    string,
    unknown
  >
> {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    ) as Record<
      string,
      unknown
    >;
  } catch {
    return {
      rawResponse:
        text.slice(
          0,
          500
        ),
    };
  }
}

async function getFxRate(
  from: string,
  to: string
) {
  const source =
    from.toUpperCase();

  const target =
    to.toUpperCase();

  if (
    source === target
  ) {
    return {
      rate: 1,

      date:
        null as
          | string
          | null,
    };
  }

  const response =
    await fetch(
      `https://api.frankfurter.dev/v2/rate/${source.toLowerCase()}/${target.toLowerCase()}`,
      {
        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",

        signal:
          AbortSignal.timeout(
            10000
          ),
      }
    );

  const result =
    await readJson(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      "Could not convert Creativehub shipping into the store currency."
    );
  }

  const rate =
    Number(
      result.rate
    );

  if (
    !Number.isFinite(
      rate
    ) ||
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
  let orderId:
    | string
    | null =
    null;

  try {
    let body:
      CheckoutBody;

    try {
      body =
        (await request.json()) as CheckoutBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid checkout request.",
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
      body.items.length ===
        0
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
      body.items.length >
      20
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
      ).map(
        (
          item
        ) => ({
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
        })
      );

    const shippingAddress = {
      name:
        cleanString(
          body.shippingAddress
            ?.name
        ),

      phone:
        cleanString(body.shippingAddress?.phone).slice(0, 40),

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
      !shippingAddress.name ||
      !shippingAddress.line1 ||
      !shippingAddress.city ||
      !shippingAddress.postcode
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
        shippingAddress.country
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
        item.quantity <
          1 ||
        item.quantity >
          10
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
    } =
      await supabase
        .from(
          "print_variants"
        )
        .select(`
          id,
          artwork_id,
          name,
          size_label,
          price,
          currency,
          paper,
          finish,
          framed,
          frame_style,
          creativehub_sku,
          creativehub_product_id,
          creativehub_variant_id,
          active
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

    const artworkIds =
      Array.from(
        new Set(
          variants.map(
            (
              variant
            ) =>
              variant.artwork_id
          )
        )
      );

    const {
      data:
        artworkData,

      error:
        artworkError,
    } =
      await supabase
        .from(
          "artworks"
        )
        .select(`
          id,
          slug,
          title,
          image_url,
          published,
          prints_available
        `)
        .in(
          "id",
          artworkIds
        );

    if (
      artworkError
    ) {
      throw artworkError;
    }

    const artworks =
      (
        artworkData ??
        []
      ) as ArtworkRow[];

    const artworkMap =
      new Map(
        artworks.map(
          (
            artwork
          ) => [
            artwork.id,
            artwork,
          ]
        )
      );

    const validatedItems:
      ValidatedItem[] =
      [];

    for (
      const variant of variants
    ) {
      const artwork =
        artworkMap.get(
          variant.artwork_id
        );

      if (
        !artwork
      ) {
        return NextResponse.json(
          {
            error:
              "An artwork in your cart no longer exists.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !artwork.published ||
        !artwork.prints_available
      ) {
        return NextResponse.json(
          {
            error:
              `${artwork.title} is no longer available as a print.`,
          },
          {
            status: 400,
          }
        );
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
              `${variant.name} does not have a valid price.`,
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
              `${variant.name} is not connected to Creativehub yet.`,
          },
          {
            status: 400,
          }
        );
      }

      const quantity =
        quantities.get(
          variant.id
        );

      if (
        !quantity
      ) {
        continue;
      }

      validatedItems.push({
        variant: {
          ...variant,

          price:
            Number(
              variant.price
            ),
        },

        artwork,

        quantity,
      });
    }

    const currencies =
      Array.from(
        new Set(
          validatedItems.map(
            (
              item
            ) =>
              item.variant.currency.toUpperCase()
          )
        )
      );

    if (
      currencies.length !==
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

    const currency =
      currencies[0];

    const subtotal =
      roundMoney(
        validatedItems.reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.variant.price
            ) *
              item.quantity,
          0
        )
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

    const creativehubItems =
      validatedItems.map(
        (
          item
        ) => ({
          variant_id:
            item.variant
              .creativehub_variant_id as string,

          quantity:
            item.quantity,
        })
      );

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
                shippingAddress.country,
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
                : "Creativehub could not calculate shipping.",

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
            "Creativehub returned an invalid shipping quote.",
        },
        {
          status: 502,
        }
      );
    }

    const fx =
      await getFxRate(
        supplierCurrency,
        currency
      );

    const shippingAmount =
      roundMoney(
        supplierDeliveryCost *
          fx.rate
      );

    const taxAmount =
      0;

    const totalAmount =
      roundMoney(
        subtotal +
          shippingAmount +
          taxAmount
      );

    const {
      data:
        order,

      error:
        orderError,
    } =
      await supabase
        .from(
          "orders"
        )
        .insert({
          status:
            "pending",

          fulfilment_status:
            "not_submitted",

          currency,

          subtotal,

          shipping_amount:
            shippingAmount,

          tax_amount:
            taxAmount,

          total_amount:
            totalAmount,

          shipping_address: {
            name:
              shippingAddress.name,

            phone:
              shippingAddress.phone || null,

            line1:
              shippingAddress.line1,

            line2:
              shippingAddress.line2 ||
              null,

            city:
              shippingAddress.city,

            postcode:
              shippingAddress.postcode,

            state:
              shippingAddress.state ||
              null,

            country:
              shippingAddress.country,
          },
        })
        .select(
          "id, order_number"
        )
        .single();

    if (
      orderError ||
      !order
    ) {
      throw (
        orderError ??
        new Error(
          "Could not create order."
        )
      );
    }

    orderId =
      order.id;

    const orderItems =
      validatedItems.map(
        (
          item
        ) => ({
          order_id:
            order.id,

          artwork_id:
            item.artwork.id,

          print_variant_id:
            item.variant.id,

          artwork_title:
            item.artwork.title,

          artwork_slug:
            item.artwork.slug,

          artwork_image_url:
            item.artwork.image_url,

          variant_name:
            item.variant.name,

          size_label:
            item.variant.size_label,

          framed:
            item.variant.framed,

          frame_style:
            item.variant.frame_style,

          paper:
            item.variant.paper,

          finish:
            item.variant.finish,

          creativehub_sku:
            item.variant.creativehub_sku,

          creativehub_product_id:
            item.variant
              .creativehub_product_id,

          creativehub_variant_id:
            item.variant
              .creativehub_variant_id,

          unit_price:
            item.variant.price,

          quantity:
            item.quantity,

          line_total:
            roundMoney(
              Number(
                item.variant.price
              ) *
                item.quantity
            ),

          currency:
            item.variant.currency,
        })
      );

    const {
      error:
        itemsError,
    } =
      await supabase
        .from(
          "order_items"
        )
        .insert(
          orderItems
        );

    if (
      itemsError
    ) {
      throw itemsError;
    }

    const lineItems =
      validatedItems.map(
        (
          item
        ) => ({
          quantity:
            item.quantity,

          price_data: {
            currency:
              item.variant.currency.toLowerCase(),

            unit_amount:
              toMinorUnits(
                Number(
                  item.variant.price
                )
              ),

            product_data: {
              name:
                item.artwork.title,

              description:
                buildDescription(
                  item.variant
                ),

              ...(item.artwork
                .image_url
                ? {
                    images: [
                      item.artwork
                        .image_url,
                    ],
                  }
                : {}),
            },
          },
        })
      );

    const origin =
      new URL(
        request.url
      ).origin;

    const session =
      await stripe.checkout.sessions.create({
        mode:
          "payment",

        line_items:
          lineItems,

        success_url:
          `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${origin}/cart`,

        customer_creation:
          "always",

        billing_address_collection:
          "auto",

        shipping_options: [
          {
            shipping_rate_data: {
              type:
                "fixed_amount",

              fixed_amount: {
                amount:
                  toMinorUnits(
                    shippingAmount
                  ),

                currency:
                  currency.toLowerCase(),
              },

              display_name:
                "Shipping",

              metadata: {
                source:
                  "creativehub",

                creativehub_currency:
                  supplierCurrency,

                creativehub_delivery_cost:
                  String(
                    supplierDeliveryCost
                  ),

                fx_rate:
                  String(
                    fx.rate
                  ),
              },
            },
          },
        ],

        metadata: {
          order_id:
            order.id,

          order_number:
            String(
              order.order_number
            ),

          delivery_country:
            shippingAddress.country,

          shipping_source:
            "creativehub",
        },

        payment_intent_data: {
          shipping: {
            name:
              shippingAddress.name,

            address: {
              line1:
                shippingAddress.line1,

              ...(shippingAddress
                .line2
                ? {
                    line2:
                      shippingAddress.line2,
                  }
                : {}),

              city:
                shippingAddress.city,

              postal_code:
                shippingAddress.postcode,

              ...(shippingAddress
                .state
                ? {
                    state:
                      shippingAddress.state,
                  }
                : {}),

              country:
                shippingAddress.country,
            },
          },

          metadata: {
            order_id:
              order.id,

            order_number:
              String(
                order.order_number
              ),
          },
        },
      });

    if (
      !session.url
    ) {
      throw new Error(
        "Stripe did not return a checkout URL."
      );
    }

    const {
      error:
        sessionSaveError,
    } =
      await supabase
        .from(
          "orders"
        )
        .update({
          stripe_checkout_session_id:
            session.id,
        })
        .eq(
          "id",
          order.id
        );

    if (
      sessionSaveError
    ) {
      throw sessionSaveError;
    }

    return NextResponse.json({
      url:
        session.url,

      orderId:
        order.id,

      shippingAmount,

      currency,
    });
  } catch (
    error
  ) {
    console.error(
      "Checkout error:",
      error
    );

    if (
      orderId
    ) {
      try {
        const supabase =
          createAdminClient();

        await supabase
          .from(
            "orders"
          )
          .delete()
          .eq(
            "id",
            orderId
          )
          .eq(
            "status",
            "pending"
          );
      } catch (
        cleanupError
      ) {
        console.error(
          "Checkout cleanup failed:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Checkout could not be started.",
      },
      {
        status: 500,
      }
    );
  }
}

function buildDescription(
  variant:
    PrintVariantRow
) {
  return [
    variant.size_label,

    variant.framed
      ? variant.frame_style ||
        "Framed"
      : "Print only",

    variant.paper,

    variant.finish,
  ]
    .filter(
      Boolean
    )
    .join(" · ");
}

function toMinorUnits(
  amount: number
) {
  return Math.round(
    amount * 100
  );
}

function roundMoney(
  amount: number
) {
  return (
    Math.round(
      (
        amount +
        Number.EPSILON
      ) *
        100
    ) / 100
  );
}