"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartLine = { itemId: string; quantity: number };

type CartApi = {
  lines: CartLine[];
  count: number;
  add: (itemId: string, quantity: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      add(itemId, quantity) {
        if (quantity < 1) return;
        setLines((current) => {
          const existing = current.find((line) => line.itemId === itemId);
          if (!existing) return [...current, { itemId, quantity }];
          return current.map((line) => (line.itemId === itemId ? { ...line, quantity: line.quantity + quantity } : line));
        });
      },
      setQuantity(itemId, quantity) {
        setLines((current) =>
          current.flatMap((line) => {
            if (line.itemId !== itemId) return [line];
            if (quantity < 1) return [];
            return [{ itemId, quantity }];
          }),
        );
      },
      remove(itemId) {
        setLines((current) => current.filter((line) => line.itemId !== itemId));
      },
      clear() {
        setLines([]);
      },
    }),
    [lines],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("Cart is unavailable.");
  return value;
}
