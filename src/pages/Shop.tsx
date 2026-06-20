import { products } from "@/lib/products";
import ProductCard from "@/components/app/ProductCard";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import CheckoutDialog from "@/components/app/CheckoutDialog";
import { Button } from "@/components/ui/button";

const Shop = () => {
  const { items, addItem, removeItem, clear, total } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">Shop</h1>
        <div className="flex gap-3 items-center">
          <div className="text-sm">Items: {items.length}</div>
          <div className="text-sm font-semibold">Total: R {total.toFixed(2)}</div>
          <Button variant="ghost" onClick={() => setOpen(true)} disabled={items.length === 0}>
            Checkout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={() => addItem(p)} />
        ))}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg">Cart</h2>
        {items.length === 0 ? (
          <div className="text-muted-foreground">Your cart is empty.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded border border-border p-2">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-sm text-muted-foreground">Qty: {i.quantity} — R {i.price.toFixed(2)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => removeItem(i.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={clear} size="sm">
                Clear
              </Button>
              <div className="font-semibold">R {total.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      <CheckoutDialog open={open} onOpenChange={setOpen} items={items} amount={total} onPaid={() => clear()} />
    </div>
  );
};

export default Shop;
