import { products } from "@/lib/products";
import ProductCard from "@/components/app/ProductCard";
import { useCart } from "@/lib/cart";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CheckoutDialog from "@/components/app/CheckoutDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/app/Navbar";
import { AppSidebar } from "@/components/app/AppSidebar";

const Shop = () => {
  const { items, addItem, removeItem, clear, total } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee } = useAuth();

  const getBackButton = () => {
    if (isAdmin) {
      return { label: "← Admin", path: "/admin" };
    } else if (isEmployee) {
      return { label: "← My work", path: "/employee" };
    }
    return { label: "← User page", path: "/dashboard" };
  };

  const backButton = getBackButton();

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.15),transparent_60%)]" />
      <Navbar />
      <AppSidebar />
      <div className={user ? "relative mx-auto max-w-7xl px-4 pb-10 pt-20 sm:px-6 lg:ml-64 lg:max-w-none lg:px-8 lg:pt-10" : "container relative py-10"}>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(backButton.path)}>
            {backButton.label}
          </Button>
          <h1 className="font-display text-2xl">Shop</h1>
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-sm">Items: {items.length}</div>
          <div className="text-sm font-semibold">Total: R {total.toFixed(2)}</div>
          <Button variant="ghost" onClick={() => setOpen(true)} disabled={items.length === 0}>
            Checkout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={() => addItem(p)} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
        <h2 className="font-display text-lg">Cart</h2>
        {items.length === 0 ? (
          <div className="text-muted-foreground">Your cart is empty.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl border border-border bg-card/80 p-3">
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
    </div>
  );
};

export default Shop;
