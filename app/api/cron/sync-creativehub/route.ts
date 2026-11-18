import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ProviderData = Record<string, unknown>;

type TrackedOrder = {
  id: string;
  order_number: number;
  fulfilment_status: string;
  creativehub_order_id: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): ProviderData {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ProviderData)
    : {};
}

function firstShipment(data: ProviderData): ProviderData {
  const list = Array.isArray(data.shipments) ? data.shipments : [];
  return list.length ? asRecord(list[0]) : {};
}

function validHttps(value: unknown): string | null {
  const raw = asText(value);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validDate(value: unknown): string | null {
  const raw = asText(value);
  return raw && Number.isFinite(Date.parse(raw))
    ? new Date(raw).toISOString()
    : null;
}

function normalizeStatus(status: string, current: string): string {
  const s = status.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (s === "delivered") return "delivered";
  if (["dispatched", "shipped", "partially_dispatched", "partially_shipped"].includes(s)) {
    return "shipped";
  }
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (["failed", "production_failed"].includes(s)) return "failed";
  if (
    s.includes("product") ||
    s.includes("print") ||
    s.includes("process") ||
    s.includes("production")
  ) {
    // Never regress a shipped parcel to in-production.
    return current === "shipped" ? current : "in_production";
  }
  return current;
}

async function fetchOrder(providerId: string): Promise<ProviderData> {
  const token = process.env.ESCHER_API_TOKEN;
  if (!token) throw new Error("Creativehub token is missing.");

  const base = (
    process.env.ESCHER_API_BASE_URL ||
    "https://escher-v2.creativehub.io/v1"
  ).replace(/\/$/, "");

  const response = await fetch(
    `${base}/orders/${encodeURIComponent(providerId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!response.ok) {
    throw new Error(`Creativehub returned HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  const data = asRecord(body);

  const returnedId = asText(data.order_id) || asText(data.id);
  if (returnedId && returnedId !== providerId) {
    throw new Error("Creativehub order ID mismatch.");
  }

  return data;
}

async function syncOne(order: TrackedOrder): Promise<boolean> {
  const data = await fetchOrder(order.creativehub_order_id);
  const supplierStatus = asText(data.status);
  if (!supplierStatus) {
    throw new Error("Creativehub response contained no order status.");
  }

  const tracking = asRecord(data.tracking);
  const parcel = firstShipment(data);
  const parcelTracking = asRecord(parcel.tracking);
  const status = normalizeStatus(
    supplierStatus,
    order.fulfilment_status
  );

  const carrier =
    asText(tracking.carrier) ||
    asText(parcel.tracking_carrier) ||
    asText(parcel.carrier) ||
    asText(parcelTracking.carrier);

  const number =
    asText(tracking.tracking_number) ||
    asText(parcel.tracking_number) ||
    asText(parcelTracking.tracking_number);

  const url =
    validHttps(tracking.tracking_url) ||
    validHttps(parcel.tracking_url) ||
    validHttps(parcelTracking.tracking_url);

  const update: ProviderData = {
    creativehub_status: supplierStatus,
    creativehub_snapshot: data,
    fulfilment_status: status,
  };

  if (carrier) update.carrier = carrier;
  if (number) update.tracking_number = number;
  if (url) update.tracking_url = url;

  if ((status === "shipped" || status === "delivered") && !order.shipped_at) {
    update.shipped_at =
      validDate(data.dispatched_at) ||
      validDate(parcel.dispatched_at) ||
      new Date().toISOString();
  }
  if (status === "delivered" && !order.delivered_at) {
    update.delivered_at =
      validDate(data.delivered_at) || new Date().toISOString();
  }

  const db = createAdminClient();
  const { data: saved, error } = await db
    .from("orders")
    .update(update)
    .eq("id", order.id)
    .eq("creativehub_order_id", order.creativehub_order_id)
    .eq("fulfilment_status", order.fulfilment_status)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return !!saved;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("orders")
    .select("id,order_number,fulfilment_status,creativehub_order_id,shipped_at,delivered_at")
    .in("fulfilment_status", ["submitted", "in_production", "shipped"])
    .not("creativehub_order_id", "is", null)
    .order("submitted_for_fulfilment_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Creativehub sync query failed:", error);
    return NextResponse.json({ error: "Database lookup failed." }, { status: 500 });
  }

  const orders = (data || []) as TrackedOrder[];
  let synced = 0;
  const failed: number[] = [];

  // Small batches avoid exhausting Vercel function runtime or provider rate limits.
  for (let start = 0; start < orders.length; start += 4) {
    const batch = orders.slice(start, start + 4);
    const outcomes = await Promise.allSettled(batch.map(syncOne));

    outcomes.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        synced++;
      } else if (result.status === "rejected") {
        const number = batch[index].order_number;
        console.error(`Creativehub tracking sync failed for order #${number}:`, result.reason);
        failed.push(number);
      }
    });
  }

  return NextResponse.json({
    success: failed.length === 0,
    checked: orders.length,
    synced,
    failedOrderNumbers: failed,
  }, { status: failed.length ? 207 : 200 });
}
