"use client";

import Link from "next/link";

import {
  useCart,
} from "./CartProvider";

export default function CartLink({
  light = false,
}: {
  light?: boolean;
}) {
  const {
    itemCount,
  } = useCart();

  return (
    <Link
      href="/cart"
      className={`text-[10px] uppercase tracking-[0.18em] transition ${
        light
          ? "text-white hover:text-white/60"
          : "text-black hover:text-black/50"
      }`}
    >
      Cart
      {itemCount >
        0 && (
        <>
          {" "}
          ({itemCount})
        </>
      )}
    </Link>
  );
}