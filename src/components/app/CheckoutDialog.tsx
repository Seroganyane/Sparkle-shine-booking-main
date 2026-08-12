import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CartItem } from "@/lib/cart";
import { openPaystackCheckout, verifyPaystackPayment } from "@/lib/paystack";

export const CheckoutDialog = ({
  open,
  onOpenChange,
  items,
  amount,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CartItem[];
  amount: number;
  onPaid: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!user) {
      setLoading(false);
      toast.error("You must be signed in to complete purchases.");
      return;
    }

    const paystack = await openPaystackCheckout({
      email: user.email ?? "customer@example.com",
      amount,
      reference: `shop-${user.id}-${Date.now()}`,
      metadata: {
        type: "product_purchase",
        user_id: user.id,
        items: items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
      },
    });

    if (paystack.status === "cancelled") {
      setLoading(false);
      toast.info("Checkout cancelled");
      return;
    }

    try {
      await verifyPaystackPayment({
        reference: paystack.reference!,
        paymentType: "order",
        amount,
        items: items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
      });
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "We could not verify your payment.");
      return;
    }

    setLoading(false);

    toast.success("Purchase successful — thank you!");
    onPaid();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Checkout
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={pay} className="space-y-4">
          <div className="rounded-xl border border-border bg-gradient-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-display text-3xl font-bold">R {amount.toFixed(2)}</div>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Pay R {amount.toFixed(2)}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;
