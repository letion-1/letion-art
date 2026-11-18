
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import FulfilmentClient from "./FulfilmentClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FulfilmentPage({
  params,
}: PageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/studio/login");
  }

  const db = createAdminClient();

  const { data: admin, error: adminError } = await db
    .from("studio_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    notFound();
  }

  // Select all fields so missing migration columns don't
  // accidentally masquerade as an ordinary page 404.
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    console.error("Fulfilment order query failed:", orderError);

    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Link
          href="/studio/orders"
          className="text-xs uppercase tracking-widest"
        >
          ← Orders
        </Link>

        <h1 className="mt-10 text-4xl">
          Could not load fulfilment
        </h1>

        <p className="mt-5 text-sm text-red-700">
          Database error: {orderError.message}
        </p>

        <p className="mt-5 text-sm text-black/50">
          Check the Creativehub Supabase migration and
          the Vercel function logs.
        </p>
      </main>
    );
  }

  if (!order) {
    notFound();
  }

  const requiredColumns = [
    "creativehub_status",
    "creativehub_quote_snapshot",
    "fulfilment_last_error",
  ];

  const missingColumns = requiredColumns.filter(
    (column) => !(column in order)
  );

  if (missingColumns.length > 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Link
          href="/studio/orders"
          className="text-xs uppercase tracking-widest"
        >
          ← Orders
        </Link>

        <p className="mt-10 text-xs uppercase tracking-widest text-black/40">
          LETION / STUDIO
        </p>

        <h1 className="mt-4 text-4xl">
          Database migration required
        </h1>

        <p className="mt-5 text-sm leading-7 text-black/60">
          Order #{order.order_number} exists, but the
          Creativehub fulfilment database migration
          has not been fully applied.
        </p>

        <p className="mt-5 text-sm text-red-700">
          Missing fields: {missingColumns.join(", ")}
        </p>

        <p className="mt-5 text-sm text-black/50">
          Run LETION_CREATIVEHUB_FULFILMENT.sql
          in your Supabase SQL Editor.
        </p>
      </main>
    );
  }

  const productionUnlocked =
    process.env.ALLOW_CREATIVEHUB_LIVE_FULFILMENT ===
      "true" &&
    process.env.STRIPE_SECRET_KEY?.startsWith(
      "sk_live_"
    ) === true;

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
        Creativehub production, quotation and shipment
        tracking
      </p>

      <FulfilmentClient
        orderId={order.id}
        orderNumber={Number(order.order_number)}
        status={order.status}
        fulfilmentStatus={
          order.fulfilment_status ?? "not_submitted"
        }
        providerOrderId={
          order.creativehub_order_id ?? null
        }
        providerStatus={
          order.creativehub_status ?? null
        }
        total={Number(order.total_amount ?? 0)}
        shipping={Number(order.shipping_amount ?? 0)}
        currency={order.currency ?? "EUR"}
        initialQuote={
          order.creativehub_quote_snapshot ?? null
        }
        lastError={
          order.fulfilment_last_error ?? null
        }
        productionUnlocked={productionUnlocked}
      />
    </main>
  );
}
