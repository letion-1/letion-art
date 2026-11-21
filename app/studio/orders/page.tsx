import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  fulfilment_status: string;
  currency: string;

  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;

  customer_email:
    | string
    | null;

  customer_name:
    | string
    | null;

  created_at: string;

  paid_at:
    | string
    | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;

  artwork_title: string;

  artwork_slug:
    | string
    | null;

  artwork_image_url:
    | string
    | null;

  variant_name: string;

  size_label:
    | string
    | null;

  framed: boolean;

  frame_style:
    | string
    | null;

  quantity: number;
  unit_price: number;
  line_total: number;
  currency: string;
};

export default async function StudioOrdersPage() {
  const supabase =
    await createClient();

  const [
    ordersResult,
    itemsResult,
  ] =
    await Promise.all([
      supabase
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          fulfilment_status,
          currency,
          subtotal,
          shipping_amount,
          tax_amount,
          total_amount,
          customer_email,
          customer_name,
          created_at,
          paid_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        ),

      supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          artwork_title,
          artwork_slug,
          artwork_image_url,
          variant_name,
          size_label,
          framed,
          frame_style,
          quantity,
          unit_price,
          line_total,
          currency
        `)
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        ),
    ]);

  if (
    ordersResult.error
  ) {
    console.error(
      "Could not load orders:",
      ordersResult.error
    );
  }

  if (
    itemsResult.error
  ) {
    console.error(
      "Could not load order items:",
      itemsResult.error
    );
  }

  const orders =
    (ordersResult.data ??
      []) as OrderRow[];

  const items =
    (itemsResult.data ??
      []) as OrderItemRow[];

  const itemsByOrder =
    new Map<
      string,
      OrderItemRow[]
    >();

  for (
    const item of items
  ) {
    const current =
      itemsByOrder.get(
        item.order_id
      ) ?? [];

    current.push(
      item
    );

    itemsByOrder.set(
      item.order_id,
      current
    );
  }

  const paidOrders =
    orders.filter(
      (
        order
      ) =>
        order.status ===
        "paid"
    );

  // A paid, not-yet-submitted order is our safe local Creativehub draft.
  // The Escher API has no documented create-draft-order endpoint.
  const awaitingApprovalOrders = paidOrders.filter(
    (order) => !order.fulfilment_status || order.fulfilment_status === "not_submitted"
  );
  const otherPaidOrders = paidOrders.filter(
    (order) => order.fulfilment_status && order.fulfilment_status !== "not_submitted"
  );

  const pendingOrders =
    orders.filter(
      (
        order
      ) =>
        order.status ===
        "pending"
    );

  const failedOrders =
    orders.filter(
      (
        order
      ) =>
        order.status ===
          "payment_failed" ||
        order.status ===
          "cancelled"
    );

  const paidRevenue =
    paidOrders.reduce(
      (
        total,
        order
      ) =>
        total +
        Number(
          order.total_amount
        ),
      0
    );

  const currency =
    paidOrders[0]
      ?.currency ??
    orders[0]
      ?.currency ??
    "EUR";

  return (
    <main className="w-full overflow-x-hidden pb-20">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8">
        {/* TOP */}

        <section className="border-b border-black/10 pb-8 pt-2">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.28em] text-black/35">
                Studio commerce
              </p>

              <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Orders
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-black/45">
                Sales, payments
                and fulfilment
                from the print
                studio.
              </p>
            </div>

            <Link
              href="/shop"
              target="_blank"
              className="inline-flex w-fit items-center gap-3 border border-black/15 px-4 py-3 text-[9px] uppercase tracking-[0.18em] transition hover:bg-black hover:text-white"
            >
              Open shop
              <span>↗</span>
            </Link>
          </div>
        </section>

        {/* METRICS */}

        <section className="grid border-b border-black/10 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Revenue"
            value={formatMoney(
              paidRevenue,
              currency
            )}
            detail="Confirmed"
          />

          <Metric
            label="Paid"
            value={String(
              paidOrders.length
            )}
            detail="Completed"
          />

          <Metric
            label="Pending"
            value={String(
              pendingOrders.length
            )}
            detail="Awaiting payment"
          />

          <Metric
            label="Total"
            value={String(
              orders.length
            )}
            detail={
              failedOrders.length >
              0
                ? `${failedOrders.length} failed`
                : "No failed orders"
            }
          />
        </section>

        {/* APPROVAL QUEUE: paid orders stay local until manual approval. */}
        <section className="pt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-black/30">
                Creativehub-ready drafts
              </p>
              <h2 className="mt-2 text-2xl font-medium tracking-[-0.035em]">
                Awaiting your approval
              </h2>
              <p className="mt-2 max-w-xl text-xs leading-5 text-black/45">
                Paid customer orders are saved here automatically. They are not sent to Creativehub until you review and approve production.
              </p>
            </div>
            <p className="text-xs text-black/35">{awaitingApprovalOrders.length} pending</p>
          </div>
          <div className="grid gap-3">
            {awaitingApprovalOrders.length === 0 ? (
              <p className="border border-black/10 px-5 py-8 text-sm text-black/40">
                No paid orders waiting for approval.
              </p>
            ) : (
              awaitingApprovalOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  items={itemsByOrder.get(order.id) ?? []}
                />
              ))
            )}
          </div>
        </section>

        {/* PAID, ALREADY SUBMITTED OR UNDER REVIEW */}
        <section className="pt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-black/30">
                Confirmed
              </p>

              <h2 className="mt-2 text-2xl font-medium tracking-[-0.035em]">
                Other paid orders
              </h2>
            </div>

            <p className="text-xs text-black/35">
              {
                otherPaidOrders.length
              }{" "}
              order
              {otherPaidOrders.length ===
              1
                ? ""
                : "s"}
            </p>
          </div>

          <div className="grid gap-3">
            {otherPaidOrders.map(
              (
                order
              ) => (
                <OrderCard
                  key={
                    order.id
                  }
                  order={
                    order
                  }
                  items={
                    itemsByOrder.get(
                      order.id
                    ) ?? []
                  }
                />
              )
            )}
          </div>
        </section>

        {/* PENDING */}

        {pendingOrders.length >
          0 && (
          <section className="pt-14">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-black/30">
                  Unconfirmed
                </p>

                <h2 className="mt-2 text-2xl font-medium tracking-[-0.035em]">
                  Pending
                </h2>
              </div>

              <p className="text-xs text-black/30">
                {
                  pendingOrders.length
                }
              </p>
            </div>

            <div className="grid gap-3 opacity-60">
              {pendingOrders.map(
                (
                  order
                ) => (
                  <OrderCard
                    key={
                      order.id
                    }
                    order={
                      order
                    }
                    items={
                      itemsByOrder.get(
                        order.id
                      ) ?? []
                    }
                    muted
                  />
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function OrderCard({
  order,
  items,
  muted = false,
}: {
  order: OrderRow;
  items: OrderItemRow[];
  muted?: boolean;
}) {
  const firstItem =
    items[0];

  return (
    <Link
      href={`/studio/orders/${order.id}`}
      className={`group block w-full overflow-hidden border transition ${
        muted
          ? "border-black/10 bg-black/[0.015]"
          : "border-black/10 bg-white/30 hover:border-black/25 hover:bg-white/60"
      }`}
    >
      <div className="grid min-w-0 md:grid-cols-[110px_minmax(0,1fr)_180px]">
        {/* IMAGE */}

        <div className="h-[150px] bg-black/[0.04] md:h-full md:min-h-[150px]">
          {firstItem
            ?.artwork_image_url ? (
            <img
              src={
                firstItem.artwork_image_url
              }
              alt={
                firstItem.artwork_title
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-[8px] uppercase tracking-[0.18em] text-black/20">
                Artwork
              </span>
            </div>
          )}
        </div>

        {/* DETAILS */}

        <div className="min-w-0 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                order.status
              }
            />

            <span className="border border-black/10 px-2 py-1 text-[7px] uppercase tracking-[0.16em] text-black/35">
              {formatFulfilment(
                order.fulfilment_status
              )}
            </span>

            <span className="text-[8px] uppercase tracking-[0.16em] text-black/30">
              #
              {
                order.order_number
              }
            </span>
          </div>

          <h3 className="mt-4 truncate text-xl font-medium tracking-[-0.03em] md:text-2xl">
            {firstItem
              ?.artwork_title ??
              "Order"}
          </h3>

          {firstItem && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/45">
              <span>
                {
                  firstItem.variant_name
                }
              </span>

              {firstItem.size_label && (
                <span>
                  {
                    firstItem.size_label
                  }
                </span>
              )}

              <span>
                {firstItem.framed
                  ? firstItem.frame_style ||
                    "Framed"
                  : "Print only"}
              </span>

              <span>
                Qty{" "}
                {
                  firstItem.quantity
                }
              </span>
            </div>
          )}

          <div className="mt-5 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span className="truncate text-xs font-medium">
              {order.customer_name ??
                "Customer"}
            </span>

            <span className="truncate text-[11px] text-black/40">
              {order.customer_email ??
                "No email"}
            </span>
          </div>
        </div>

        {/* TOTAL */}

        <div className="flex flex-col justify-between border-t border-black/10 p-5 md:border-l md:border-t-0 md:p-6">
          <div>
            <p className="text-[8px] uppercase tracking-[0.18em] text-black/30">
              Total
            </p>

            <p className="mt-2 text-2xl font-medium tracking-[-0.045em]">
              {formatMoney(
                Number(
                  order.total_amount
                ),
                order.currency
              )}
            </p>

            <p className="mt-2 text-[10px] text-black/35">
              {formatDate(
                order.paid_at ??
                  order.created_at
              )}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4">
            <span className="text-[8px] uppercase tracking-[0.16em] text-black/35">
              Open
            </span>

            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-b border-black/10 py-6 sm:px-5 xl:border-b-0 xl:border-r xl:first:pl-0 xl:last:border-r-0">
      <p className="text-[8px] uppercase tracking-[0.2em] text-black/30">
        {label}
      </p>

      <p className="mt-2 text-3xl font-medium tracking-[-0.045em]">
        {value}
      </p>

      <p className="mt-2 text-[11px] text-black/35">
        {detail}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (
    status ===
    "paid"
  ) {
    return (
      <span className="bg-black px-2 py-1 text-[7px] uppercase tracking-[0.18em] text-white">
        Paid
      </span>
    );
  }

  return (
    <span className="border border-black/15 px-2 py-1 text-[7px] uppercase tracking-[0.18em] text-black/50">
      {status.replaceAll(
        "_",
        " "
      )}
    </span>
  );
}

function formatFulfilment(
  value: string
) {
  if (
    value ===
    "not_submitted"
  ) {
    return "Not fulfilled";
  }

  return value.replaceAll(
    "_",
    " "
  );
}

function formatMoney(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-IE",
      {
        style:
          "currency",

        currency:
          currency.toUpperCase(),

        maximumFractionDigits:
          2,
      }
    ).format(
      amount
    );
  } catch {
    return `${currency} ${amount.toFixed(
      2
    )}`;
  }
}

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return value;
  }
}