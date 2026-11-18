import Link from "next/link";
import { createHmac, timingSafeEqual } from "node:crypto";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Order tracking | LETION ART",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

function verified(orderId: string, supplied: unknown): boolean {
  const secret = process.env.ORDER_TRACKING_SECRET;
  if (!secret || secret.length < 32 || typeof supplied !== "string") return false;
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^[0-9a-f]{64}$/i.test(supplied)) return false;

  const expected = createHmac("sha256", secret)
    .update(`letion-order-track:v1:${orderId}`)
    .digest();
  const received = Buffer.from(supplied, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function httpsLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function friendly(value: unknown): string {
  if (typeof value !== "string") return "Awaiting update";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function TrackingPage({ params, searchParams }: Props) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  if (!verified(id, token)) notFound();

  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("order_number,status,fulfilment_status,creativehub_status,carrier,tracking_number,tracking_url,shipped_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select("artwork_title,variant_name,quantity")
    .eq("order_id", id);

  const trackingUrl = httpsLink(order.tracking_url);
  const currentStatus =
    order.status !== "paid" ? "Payment processing" :
    order.fulfilment_status === "not_submitted" ? "Order confirmed" :
    order.fulfilment_status === "queued" ? "Preparing production" :
    order.fulfilment_status === "submitted" ? "Sent for printing" :
    order.fulfilment_status === "in_production" ? "In production" :
    order.fulfilment_status === "shipped" ? "Shipped" :
    order.fulfilment_status === "delivered" ? "Delivered" :
    order.fulfilment_status === "cancelled" ? "Cancelled" :
    "Contact the studio";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 text-[#111111] md:py-20">
      <Link href="/" className="text-xs font-semibold tracking-[0.24em]">
        LETION KETIENYA
      </Link>

      <div className="mt-16 border-b border-black/10 pb-10">
        <p className="text-xs uppercase tracking-[0.25em] text-black/40">Order tracking</p>
        <h1 className="mt-4 text-5xl tracking-[-0.05em]">Order #{order.order_number}</h1>
        <p className="mt-6 text-lg">{currentStatus}</p>
        <p className="mt-2 text-sm text-black/50">
          Refresh this page for the latest confirmed fulfilment information.
        </p>
      </div>

      <section className="mt-10 border border-black/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-black/40">Your artwork</p>
        <div className="mt-5 space-y-4">
          {(items ?? []).map((item, index) => (
            <div key={index} className="flex justify-between gap-6 border-b border-black/10 pb-4 text-sm">
              <span>{item.artwork_title} · {item.variant_name}</span>
              <span>Qty {item.quantity}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 border border-black/10 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-black/40">Delivery status</p>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-black/50">Stage</dt><dd>{currentStatus}</dd></div>
          {order.creativehub_status && (
            <div className="flex justify-between gap-4"><dt className="text-black/50">Print studio</dt><dd>{friendly(order.creativehub_status)}</dd></div>
          )}
          {order.carrier && (
            <div className="flex justify-between gap-4"><dt className="text-black/50">Courier</dt><dd>{order.carrier}</dd></div>
          )}
          {order.tracking_number && (
            <div className="flex flex-wrap justify-between gap-4"><dt className="text-black/50">Tracking number</dt><dd className="break-all">{order.tracking_number}</dd></div>
          )}
        </dl>
        {trackingUrl && (
          <a
            href={trackingUrl}
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            target="_blank"
            className="mt-7 inline-flex bg-black px-5 py-4 text-xs uppercase tracking-wider text-white"
          >
            Track with courier
          </a>
        )}
      </section>

      <p className="mt-8 text-sm text-black/50">
        This private link is intended for the buyer. Keep it out of public posts.
      </p>
    </main>
  );
}
