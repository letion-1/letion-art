"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  cartKey: string;

  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  artworkImageUrl: string | null;

  variantId: string;
  variantName: string;

  sizeLabel: string | null;

  framed: boolean;
  frameStyle: string | null;

  price: number;
  currency: string;

  quantity: number;
};

type AddCartItem = Omit<
  CartItem,
  "cartKey" | "quantity"
>;

type CartContextValue = {
  items: CartItem[];

  itemCount: number;

  addItem: (
    item: AddCartItem
  ) => void;

  removeItem: (
    cartKey: string
  ) => void;

  setQuantity: (
    cartKey: string,
    quantity: number
  ) => void;

  clearCart: () => void;
};

const CartContext =
  createContext<
    CartContextValue | undefined
  >(undefined);

const STORAGE_KEY =
  "letion-art-cart";

export default function CartProvider({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const [
    items,
    setItems,
  ] = useState<
    CartItem[]
  >([]);

  const [
    hydrated,
    setHydrated,
  ] = useState(false);

  /*
   * Load cart from browser.
   */

  useEffect(() => {
    try {
      const raw =
        window.localStorage.getItem(
          STORAGE_KEY
        );

      if (raw) {
        const parsed =
          JSON.parse(
            raw
          );

        if (
          Array.isArray(
            parsed
          )
        ) {
          setItems(
            parsed
          );
        }
      }
    } catch (
      error
    ) {
      console.error(
        "Could not load cart:",
        error
      );
    } finally {
      setHydrated(
        true
      );
    }
  }, []);

  /*
   * Persist cart.
   */

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          items
        )
      );
    } catch (
      error
    ) {
      console.error(
        "Could not save cart:",
        error
      );
    }
  }, [
    items,
    hydrated,
  ]);

  function addItem(
    item:
      AddCartItem
  ) {
    const cartKey =
      `${item.artworkId}:${item.variantId}`;

    setItems(
      (
        current
      ) => {
        const existing =
          current.find(
            (
              cartItem
            ) =>
              cartItem.cartKey ===
              cartKey
          );

        if (
          existing
        ) {
          return current.map(
            (
              cartItem
            ) =>
              cartItem.cartKey ===
              cartKey
                ? {
                    ...cartItem,

                    quantity:
                      cartItem.quantity +
                      1,
                  }
                : cartItem
          );
        }

        return [
          ...current,
          {
            ...item,
            cartKey,
            quantity: 1,
          },
        ];
      }
    );
  }

  function removeItem(
    cartKey: string
  ) {
    setItems(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.cartKey !==
            cartKey
        )
    );
  }

  function setQuantity(
    cartKey: string,
    quantity: number
  ) {
    if (
      quantity <= 0
    ) {
      removeItem(
        cartKey
      );

      return;
    }

    setItems(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.cartKey ===
            cartKey
              ? {
                  ...item,
                  quantity,
                }
              : item
        )
    );
  }

  function clearCart() {
    setItems([]);
  }

  const itemCount =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.quantity,
          0
        ),
      [items]
    );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        addItem,
        removeItem,
        setQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (!context) {
    throw new Error(
      "useCart must be used inside CartProvider."
    );
  }

  return context;
}