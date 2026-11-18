
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import FulfilmentClient from "./FulfilmentClient";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ id: string }>;
};

export default async function FulfilmentPage({
  params,
}: Context) {
  const { id } = await params;

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) redirect("/studio/login");

  const db = createAdminClient();

  const { data: admin } = await db
    .from("studio_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) notFound();

  const { data: order } = await db
    .from("orders")
    .select(`
      id,order_number,status,fulfilment_status,currency,total_amount,
      shipping_amount,creativehub_order_id,creativehub_status,
      creativehub_quote_snapshot,fulfilment_last_error
    `)
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const productionUnlocked =
    process.env.ALLOW_CREATIVEHUB_LIVE_FULFILMENT === "true" &&
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14 text-black md:px-10">
      <Link
        href={`/studio/orders/${id}`}
        className="text-xs uppercase tracking-[0.18em] text-black/50 hover:text-black"
      >
        ← Back to order
      </Link>

      <p className="mt-12 text-[10px] uppercase tracking-[0.24em] text-black/40">
        LETION / STUDIO COMMERCE
      </p>

      <h1 className="mt-3 text-4xl tracking-[-0.04em] md:text-6xl">
        Order #{order.order_number}
      </h1>

      <p className="mt-3 text-sm text-black/50">
        Creativehub production, quotation and shipment tracking
      </p>

      <FulfilmentClient
        orderId={order.id}
        orderNumber={order.order_number}
        status={order.status}
        fulfilmentStatus={order.fulfilment_status}
        providerOrderId={order.creativehub_order_id}
        providerStatus={order.creativehub_status}
        total={Number(order.total_amount)}
        shipping={Number(order.shipping_amount)}
        currency={order.currency}
        initialQuote={order.creativehub_quote_snapshot}
        lastError={order.fulfilment_last_error}
        productionUnlocked={productionUnlocked}
      />
    </main>
  );
}
