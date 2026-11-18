
-- Apply once in the Supabase SQL Editor.
-- No data is deleted. Existing order statuses are preserved.

alter table public.orders
  add column if not exists creativehub_status text,
  add column if not exists creativehub_snapshot jsonb,
  add column if not exists creativehub_quote_snapshot jsonb,
  add column if not exists fulfilment_claimed_at timestamptz,
  add column if not exists fulfilment_last_error text,
  add column if not exists fulfilment_cost numeric,
  add column if not exists fulfilment_currency text,
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists delivered_at timestamptz;

alter table public.order_items
  add column if not exists creativehub_variant_id uuid;

create unique index if not exists orders_creativehub_id_unique
  on public.orders (creativehub_order_id)
  where creativehub_order_id is not null;
