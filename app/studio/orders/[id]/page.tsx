import Link from "next/link";
import { createHmac } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Address = Record<string, unknown> | null;
type Order = {
  id: string;
  order_number: number;
  status: string;
  fulfilment_status: string;
  currency: string;
  subtotal: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_email: string | null;
  customer_name: string | null;
  shipping_address: Address;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  creativehub_order_id: string | null;
  creativehub_status: string | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  paid_at: string | null;
  submitted_for_fulfilment_at: string | null;
  shipped_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItem = {
  id: string;
  artwork_title: string;
  artwork_image_url: string | null;
  variant_name: string;
  size_label: string | null;
  framed: boolean;
  frame_style: string | null;
  paper: string | null;
  finish: string | null;
  creativehub_sku: string | null;
  creativehub_product_id: string | null;
  creativehub_variant_id: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  currency: string;
};

type Props = { params: Promise<{ id: string }> };

export default async function StudioOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // The /studio layout already checks administrator permissions.
  // These queries continue to use the signed-in user's RLS policies.
  const [orderResult, itemsResult] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (orderResult.error) {
    console.error("Studio order lookup failed:", orderResult.error);
    throw new Error("Unable to load order. Check the server logs.");
  }
  if (!orderResult.data) notFound();
  if (itemsResult.error) {
    console.error("Studio order items failed:", itemsResult.error);
    throw new Error("Unable to load order items. Check the server logs.");
  }

  const order = orderResult.data as Order;
  const items = (itemsResult.data ?? []) as OrderItem[];
  const trackingUrl = validHttps(order.tracking_url);
  const trackingSecret = process.env.ORDER_TRACKING_SECRET;
  const customerTrackingUrl = trackingSecret && trackingSecret.length >= 32
    ? `/track/${encodeURIComponent(order.id)}?token=${createHmac("sha256", trackingSecret)
        .update(`letion-order-track:v1:${order.id}`)
        .digest("hex")}`
    : null;
  const needsAttention =
    order.status === "paid" &&
    ["not_submitted", "queued", "failed"].includes(order.fulfilment_status);

  return (
    <main className="w-full overflow-x-hidden pb-24">
      <div className="mx-auto w-full max-w-[1400px] px-5 md:px-8">
        <div className="pt-2">
          <Link
            href="/studio/orders"
            className="inline-flex items-center text-[9px] uppercase tracking-[0.18em] text-black/40 hover:text-black"
          >
            ← Orders
          </Link>
        </div>

        <section className="border-b border-black/10 pb-8 pt-6">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatus status={order.status} />
                <FulfilmentStatus status={order.fulfilment_status} />
              </div>
              <p className="mt-6 text-[9px] uppercase tracking-[0.22em] text-black/30">
                Order
              </p>
              <h1 className="mt-2 text-5xl font-medium tracking-[-0.055em] md:text-7xl">
                #{order.order_number}
              </h1>
              <p className="mt-4 text-sm text-black/40">
                Created {formatDateTime(order.created_at)}
              </p>
            </div>
            <div className="text-left xl:text-right">
              <p className="text-[9px] uppercase tracking-[0.2em] text-black/30">
                Order total
              </p>
              <p className="mt-2 text-4xl font-medium tracking-[-0.05em] md:text-5xl">
                {formatMoney(Number(order.total_amount), order.currency)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-8 pt-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            <Panel
              title="Items"
              description={`${items.length} item${items.length === 1 ? "" : "s"}`}
            >
              <div className="divide-y divide-black/10">
                {items.length === 0 ? (
                  <p className="py-8 text-sm text-black/35">No order items found.</p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-5 py-6 sm:grid-cols-[110px_minmax(0,1fr)_120px]"
                    >
                      <div className="h-[135px] overflow-hidden bg-black/[0.04]">
                        {item.artwork_image_url ? (
                          // Artwork URLs are saved with the order at checkout.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.artwork_image_url}
                            alt={item.artwork_title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[8px] uppercase tracking-widest text-black/20">
                            Artwork
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <SectionLabel>Artwork</SectionLabel>
                        <h3 className="mt-2 text-2xl font-medium tracking-[-0.035em]">
                          {item.artwork_title}
                        </h3>
                        <div className="mt-4 grid gap-2 text-xs text-black/45 sm:grid-cols-2">
                          <DetailLine label="Variant" value={item.variant_name} />
                          <DetailLine label="Size" value={item.size_label || "Not specified"} />
                          <DetailLine
                            label="Presentation"
                            value={item.framed ? item.frame_style || "Framed" : "Print only"}
                          />
                          <DetailLine label="Quantity" value={String(item.quantity)} />
                          <DetailLine label="Paper" value={item.paper || "Not specified"} />
                          <DetailLine label="Finish" value={item.finish || "Not specified"} />
                        </div>
                        {(item.creativehub_sku ||
                          item.creativehub_product_id ||
                          item.creativehub_variant_id) && (
                          <div className="mt-5 border-t border-black/10 pt-4">
                            <SectionLabel>Creativehub</SectionLabel>
                            {item.creativehub_sku && (
                              <p className="mt-2 text-xs text-black/45">
                                SKU: {item.creativehub_sku}
                              </p>
                            )}
                            {item.creativehub_product_id && (
                              <p className="mt-1 break-all text-xs text-black/45">
                                Product: {item.creativehub_product_id}
                              </p>
                            )}
                            {item.creativehub_variant_id && (
                              <p className="mt-1 break-all text-xs text-black/45">
                                Variant ID: {item.creativehub_variant_id}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="sm:text-right">
                        <SectionLabel>Line total</SectionLabel>
                        <p className="mt-2 text-xl font-medium">
                          {formatMoney(Number(item.line_total), item.currency)}
                        </p>
                        <p className="mt-2 text-[10px] text-black/35">
                          {formatMoney(Number(item.unit_price), item.currency)} each
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Customer" description="Buyer and delivery details">
              <div className="grid gap-8 py-2 md:grid-cols-2">
                <div>
                  <SectionLabel>Contact</SectionLabel>
                  <p className="mt-4 text-sm font-medium">
                    {order.customer_name || "No customer name"}
                  </p>
                  <p className="mt-2 break-all text-sm text-black/45">
                    {order.customer_email || "No email recorded"}
                  </p>
                </div>
                <div>
                  <SectionLabel>Shipping address</SectionLabel>
                  <AddressBlock address={order.shipping_address} />
                </div>
              </div>
            </Panel>

            <Panel title="Payment" description="Stripe payment record">
              <div className="grid gap-7 py-2 md:grid-cols-2">
                <InfoBlock label="Payment status" value={order.status} />
                <InfoBlock
                  label="Paid at"
                  value={order.paid_at ? formatDateTime(order.paid_at) : "Not paid"}
                />
                <InfoBlock
                  label="Payment Intent"
                  value={order.stripe_payment_intent_id || "Not available"}
                  mono
                />
                <InfoBlock
                  label="Checkout Session"
                  value={order.stripe_checkout_session_id || "Not available"}
                  mono
                />
              </div>
            </Panel>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <div className="border border-black/10 p-6">
              <SectionLabel>Summary</SectionLabel>
              <div className="mt-6 space-y-4">
                <SummaryRow
                  label="Subtotal"
                  value={formatMoney(Number(order.subtotal), order.currency)}
                />
                <SummaryRow
                  label="Shipping"
                  value={formatMoney(Number(order.shipping_amount), order.currency)}
                />
                <SummaryRow
                  label="Tax"
                  value={formatMoney(Number(order.tax_amount), order.currency)}
                />
              </div>
              <div className="mt-6 border-t border-black/10 pt-6">
                <div className="flex items-end justify-between gap-5">
                  <span className="text-[9px] uppercase tracking-[0.18em] text-black/40">
                    Total
                  </span>
                  <span className="text-3xl font-medium tracking-[-0.045em]">
                    {formatMoney(Number(order.total_amount), order.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-black/10 p-6">
              <SectionLabel>Fulfilment</SectionLabel>
              <div className="mt-5">
                <FulfilmentStatus status={order.fulfilment_status} />
              </div>
              <div className="mt-6 space-y-5">
                <InfoBlock
                  label="Creativehub order"
                  value={order.creativehub_order_id || "Not submitted"}
                  mono
                />
                <InfoBlock
                  label="Supplier status"
                  value={order.creativehub_status || "Awaiting production"}
                />
                <InfoBlock
                  label="Submitted"
                  value={order.submitted_for_fulfilment_at
                    ? formatDateTime(order.submitted_for_fulfilment_at)
                    : "Not yet"}
                />
                <InfoBlock
                  label="Shipped"
                  value={order.shipped_at ? formatDateTime(order.shipped_at) : "Not yet"}
                />
                <InfoBlock label="Carrier" value={order.carrier || "Not assigned"} />
                <InfoBlock
                  label="Tracking number"
                  value={order.tracking_number || "Not available"}
                  mono
                />
                {trackingUrl && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs underline underline-offset-4"
                  >
                    Open courier tracking
                  </a>
                )}
              </div>

              <Link
                href={`/studio/orders/${encodeURIComponent(order.id)}/fulfilment`}
                className="mt-7 flex w-full items-center justify-between gap-4 bg-black px-5 py-4 text-[10px] uppercase tracking-[0.15em] text-white transition hover:opacity-75"
              >
                <span>Manage Creativehub fulfilment</span>
                <span aria-hidden>↗</span>
              </Link>
              {customerTrackingUrl && (
                <Link
                  href={customerTrackingUrl}
                  prefetch={false}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-between gap-4 border border-black/20 px-5 py-4 text-[10px] uppercase tracking-[0.15em] text-black hover:border-black"
                >
                  <span>Customer tracking page</span>
                  <span aria-hidden>↗</span>
                </Link>
              )}
              {needsAttention && (
                <p className="mt-3 text-xs leading-5 text-amber-800">
                  Paid order requiring fulfilment attention.
                </p>
              )}
              <p className="mt-3 text-[10px] leading-5 text-black/40">
                Supplier quotes are safe in test mode. Real production stays locked.
              </p>
            </div>

            <div className="border border-black/10 p-6">
              <SectionLabel>Record</SectionLabel>
              <div className="mt-5 space-y-5">
                <InfoBlock label="Order ID" value={order.id} mono />
                <InfoBlock label="Created" value={formatDateTime(order.created_at)} />
                <InfoBlock label="Last updated" value={formatDateTime(order.updated_at)} />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-black/10 p-5 md:p-7">
      <div className="flex flex-col gap-1 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-medium tracking-[-0.03em]">{title}</h2>
        {description && <p className="text-[10px] text-black/35">{description}</p>}
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.22em] text-black/30">
      {children}
    </p>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-black/30">{label}:</span> <span>{value}</span>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] uppercase tracking-[0.18em] text-black/30">
        {label}
      </p>
      <p className={`mt-2 break-all text-xs leading-5 text-black/55 ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 text-sm">
      <span className="text-black/45">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function OrderStatus({ status }: { status: string }) {
  return status === "paid" ? (
    <span className="bg-black px-3 py-1.5 text-[8px] uppercase tracking-[0.18em] text-white">
      Paid
    </span>
  ) : (
    <span className="border border-black/15 px-3 py-1.5 text-[8px] uppercase tracking-[0.18em] text-black/50">
      {status.replaceAll("_", " ")}
    </span>
  );
}

function FulfilmentStatus({ status }: { status: string }) {
  const label = status === "not_submitted" ? "Not fulfilled" : status.replaceAll("_", " ");
  return (
    <span className="inline-flex border border-black/10 px-3 py-1.5 text-[8px] uppercase tracking-[0.18em] text-black/40">
      {label}
    </span>
  );
}

function AddressBlock({ address }: { address: Address }) {
  if (!address) {
    return <p className="mt-4 text-sm text-black/35">No shipping address recorded.</p>;
  }
  const text = (key: string) => {
    const value = address[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const postcode = text("postcode") || text("postal_code");
  const lines = [
    text("line1"),
    text("line2"),
    [postcode, text("city")].filter(Boolean).join(" "),
    text("state"),
    text("country"),
  ].filter(Boolean);

  return lines.length ? (
    <div className="mt-4 text-sm leading-7 text-black/55">
      {lines.map((line, i) => <p key={`${line}-${i}`}>{line}</p>)}
    </div>
  ) : (
    <p className="mt-4 text-sm text-black/35">No displayable shipping address.</p>
  );
}

function validHttps(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
