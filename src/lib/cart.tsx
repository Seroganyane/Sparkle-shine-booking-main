import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { products } from "@/lib/products";

export type CartItem = { id: string; name: string; price: number; quantity: number };

type CartCtx = {
  items: CartItem[];
  addItem: (p: { id: string; name: string; price: number }) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  total: number;
};

const Ctx = createContext<CartCtx>({} as CartCtx);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem("aqualux-cart");
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is CartItem =>
            products.some((product) => product.id === item?.id && product.price === item?.price) &&
            typeof item?.id === "string" && typeof item?.name === "string" &&
            typeof item?.price === "number" && Number.isFinite(item.price) &&
            typeof item?.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("aqualux-cart", JSON.stringify(items));
    } catch {
      // Keep the in-memory cart when storage is unavailable.
    }
  }, [items]);

  const addItem = (p: { id: string; name: string; price: number }) => {
    setItems((s) => {
      const found = s.find((i) => i.id === p.id);
      if (found) return s.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...s, { ...p, quantity: 1 }];
    });
  };

  const removeItem = (id: string) => setItems((s) => s.filter((i) => i.id !== id));

  const clear = () => setItems([]);

  const total = items.reduce((acc, cur) => acc + cur.price * cur.quantity, 0);

  return <Ctx.Provider value={{ items, addItem, removeItem, clear, total }}>{children}</Ctx.Provider>;
};

export const useCart = () => useContext(Ctx);
