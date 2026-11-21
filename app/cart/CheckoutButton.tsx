"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useCart,
} from "@/app/components/CartProvider";

type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
};

type ShippingQuote = {
  quoteSuccessful:
    true;

  currency:
    string;

  subtotal:
    number;

  shippingAmount:
    number;

  totalBeforeCustomerTax:
    number;

  destinationCountry:
    string;

  creativehub: {
    currency:
      string;

    deliveryCost:
      number;
  };

  conversion: {
    from:
      string;

    to:
      string;

    rate:
      number;

    date:
      string | null;
  };
};

const COUNTRIES = [
  [
    "DE",
    "Germany",
  ],

  [
    "AT",
    "Austria",
  ],

  [
    "BE",
    "Belgium",
  ],

  [
    "DK",
    "Denmark",
  ],

  [
    "ES",
    "Spain",
  ],

  [
    "FI",
    "Finland",
  ],

  [
    "FR",
    "France",
  ],

  [
    "GB",
    "United Kingdom",
  ],

  [
    "IE",
    "Ireland",
  ],

  [
    "IT",
    "Italy",
  ],

  [
    "LU",
    "Luxembourg",
  ],

  [
    "NL",
    "Netherlands",
  ],

  [
    "NO",
    "Norway",
  ],

  [
    "PL",
    "Poland",
  ],

  [
    "PT",
    "Portugal",
  ],

  [
    "SE",
    "Sweden",
  ],

  [
    "CH",
    "Switzerland",
  ],

  [
    "US",
    "United States",
  ],

  [
    "CA",
    "Canada",
  ],

  [
    "AU",
    "Australia",
  ],

  [
    "NZ",
    "New Zealand",
  ],
] as const;

async function readJsonResponse(
  response:
    Response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    );
  } catch {
    throw new Error(
      text.includes(
        "<!DOCTYPE"
      )
        ? "The checkout API returned an HTML error page. Check the Next.js terminal."
        : "The checkout API returned an unexpected response."
    );
  }
}

function money(
  amount:
    number,

  currency:
    string
) {
  try {
    return new Intl.NumberFormat(
      "en-DE",
      {
        style:
          "currency",

        currency:
          currency.toUpperCase(),
      }
    ).format(
      amount
    );
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(
      2
    )}`;
  }
}

export default function CheckoutButton() {
  const {
    items,
  } = useCart();

  const [
    address,
    setAddress,
  ] =
    useState<ShippingAddress>({
      name:
        "",

      phone:
        "",

      line1:
        "",

      line2:
        "",

      city:
        "",

      postcode:
        "",

      state:
        "",

      country:
        "DE",
    });

  const [
    shippingQuote,
    setShippingQuote,
  ] =
    useState<
      ShippingQuote | null
    >(null);

  const [
    quoting,
    setQuoting,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const cartPayload =
    useMemo(
      () =>
        items.map(
          (
            item
          ) => ({
            variantId:
              item.variantId,

            quantity:
              item.quantity,
          })
        ),

      [
        items,
      ]
    );

  function updateAddress(
    field:
      keyof ShippingAddress,

    value:
      string
  ) {
    setAddress(
      (
        current
      ) => ({
        ...current,

        [field]:
          value,
      })
    );

    setShippingQuote(
      null
    );

    setError(
      null
    );
  }

  function validateAddress() {
    if (
      !address.name.trim() ||
      !address.line1.trim() ||
      !address.city.trim() ||
      !address.postcode.trim() ||
      !address.country
    ) {
      setError(
        "Complete your delivery name, address, city, postcode and country."
      );

      return false;
    }

    return true;
  }

  async function calculateShipping() {
    if (
      items.length ===
        0 ||
      quoting ||
      loading
    ) {
      return;
    }

    if (
      !validateAddress()
    ) {
      return;
    }

    setQuoting(
      true
    );

    setError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/checkout/shipping-quote",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                items:
                  cartPayload,

                shippingAddress:
                  address,
              }),
          }
        );

      const result =
        await readJsonResponse(
          response
        );

      if (
        !response.ok ||
        !result.quoteSuccessful
      ) {
        throw new Error(
          result.error ??
            "Could not calculate shipping."
        );
      }

      setShippingQuote(
        result as ShippingQuote
      );
    } catch (
      error
    ) {
      setShippingQuote(
        null
      );

      setError(
        error instanceof
          Error
          ? error.message
          : "Could not calculate shipping."
      );
    } finally {
      setQuoting(
        false
      );
    }
  }

  async function checkout() {
    if (
      items.length ===
        0 ||
      loading ||
      quoting
    ) {
      return;
    }

    if (
      !validateAddress()
    ) {
      return;
    }

    if (
      !shippingQuote
    ) {
      setError(
        "Calculate shipping before continuing to payment."
      );

      return;
    }

    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/checkout",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                items:
                  cartPayload,

                shippingAddress:
                  address,
              }),
          }
        );

      const result =
        await readJsonResponse(
          response
        );

      if (
        !response.ok
      ) {
        throw new Error(
          result.error ??
            "Could not start checkout."
        );
      }

      if (
        !result.url
      ) {
        throw new Error(
          "Checkout URL was not returned."
        );
      }

      window.location.href =
        result.url;
    } catch (
      error
    ) {
      setError(
        error instanceof
          Error
          ? error.message
          : "Could not start checkout."
      );

      setLoading(
        false
      );
    }
  }

  return (
    <div className="border-t border-black/10 pt-8">
      <div>
        <p className="text-[9px] uppercase tracking-[0.22em] text-black/35">
          Delivery
        </p>

        <h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">
          Shipping address
        </h2>

        <p className="mt-3 max-w-lg text-xs leading-6 text-black/45">
          Enter your delivery address to calculate shipping from theprintspace before payment.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field
          label=
            "Full name"

          value={
            address.name
          }

          onChange={(
            value
          ) =>
            updateAddress(
              "name",
              value
            )
          }

          placeholder=
            "Full name"
        />

        <Field
          label="Phone number (optional)"
          value={address.phone}
          onChange={(value) => updateAddress("phone", value)}
          placeholder="+49 ..."
        />

        <div>
          <Label>
            Country
          </Label>

          <select
            value={
              address.country
            }

            onChange={(
              event
            ) =>
              updateAddress(
                "country",
                event.target.value
              )
            }

            className="mt-2 w-full border border-black/15 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
          >
            {COUNTRIES.map(
              (
                [
                  code,
                  name,
                ]
              ) => (
                <option
                  key={
                    code
                  }

                  value={
                    code
                  }
                >
                  {
                    name
                  }
                </option>
              )
            )}
          </select>
        </div>

        <div className="sm:col-span-2">
          <Field
            label=
              "Address line 1"

            value={
              address.line1
            }

            onChange={(
              value
            ) =>
              updateAddress(
                "line1",
                value
              )
            }

            placeholder=
              "Street and house number"
          />
        </div>

        <div className="sm:col-span-2">
          <Field
            label=
              "Address line 2"

            value={
              address.line2
            }

            onChange={(
              value
            ) =>
              updateAddress(
                "line2",
                value
              )
            }

            placeholder=
              "Apartment, suite, building, etc. (optional)"
          />
        </div>

        <Field
          label=
            "City"

          value={
            address.city
          }

          onChange={(
            value
          ) =>
            updateAddress(
              "city",
              value
            )
          }

          placeholder=
            "City"
        />

        <Field
          label=
            "Postcode / ZIP"

          value={
            address.postcode
          }

          onChange={(
            value
          ) =>
            updateAddress(
              "postcode",
              value
            )
          }

          placeholder=
            "Postcode"
        />

        <div className="sm:col-span-2">
          <Field
            label=
              "State / county / province"

            value={
              address.state
            }

            onChange={(
              value
            ) =>
              updateAddress(
                "state",
                value
              )
            }

            placeholder=
              "Optional"
          />
        </div>
      </div>

      <button
        type="button"

        onClick={
          calculateShipping
        }

        disabled={
          quoting ||
          loading ||
          items.length ===
            0
        }

        className="mt-6 flex w-full items-center justify-between border border-black px-6 py-5 text-xs uppercase tracking-[0.2em] transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>
          {quoting
            ? "Calculating shipping..."
            : shippingQuote
              ? "Recalculate shipping"
              : "Calculate shipping"}
        </span>

        <span>
          →
        </span>
      </button>

      {shippingQuote && (
        <div className="mt-5 border border-black/10 p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-black/45">
              Artwork subtotal
            </span>

            <strong className="text-sm">
              {money(
                shippingQuote.subtotal,
                shippingQuote.currency
              )}
            </strong>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-xs text-black/45">
              Shipping
            </span>

            <strong className="text-sm">
              {money(
                shippingQuote.shippingAmount,
                shippingQuote.currency
              )}
            </strong>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 border-t border-black/10 pt-4">
            <span className="text-xs font-medium">
              Before customer tax
            </span>

            <strong className="text-lg">
              {money(
                shippingQuote.totalBeforeCustomerTax,
                shippingQuote.currency
              )}
            </strong>
          </div>

          <p className="mt-4 text-[10px] leading-5 text-black/40">
            Shipping was quoted by Creativehub / theprintspace for{" "}
            {
              shippingQuote.destinationCountry
            }.

            {shippingQuote.creativehub.currency !==
              shippingQuote.currency &&
              ` Supplier delivery ${money(
                shippingQuote.creativehub.deliveryCost,
                shippingQuote.creativehub.currency
              )} converted at ${shippingQuote.conversion.rate.toFixed(
                6
              )} ${shippingQuote.conversion.to} per ${shippingQuote.conversion.from}.`}
          </p>
        </div>
      )}

      <button
        type="button"

        onClick={
          checkout
        }

        disabled={
          loading ||
          quoting ||
          items.length ===
            0 ||
          !shippingQuote
        }

        className="mt-5 flex w-full items-center justify-between bg-black px-6 py-5 text-xs uppercase tracking-[0.2em] text-white transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span>
          {loading
            ? "Opening secure payment..."
            : "Continue to secure payment"}
        </span>

        <span>
          →
        </span>
      </button>

      {!shippingQuote && (
        <p className="mt-3 text-[10px] leading-5 text-black/40">
          Calculate shipping before continuing to payment.
        </p>
      )}

      {error && (
        <p
          role=
            "alert"

          className="mt-4 text-xs leading-5 text-red-700"
        >
          {
            error
          }
        </p>
      )}
    </div>
  );
}

function Label({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <label className="text-[9px] uppercase tracking-[0.18em] text-black/40">
      {
        children
      }
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label:
    string;

  value:
    string;

  onChange: (
    value:
      string
  ) => void;

  placeholder?:
    string;
}) {
  return (
    <div>
      <Label>
        {
          label
        }
      </Label>

      <input
        value={
          value
        }

        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }

        placeholder={
          placeholder
        }

        className="mt-2 w-full border border-black/15 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
      />
    </div>
  );
}