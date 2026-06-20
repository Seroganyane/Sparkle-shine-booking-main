import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CartItem } from "@/lib/cart";

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
    // Simulated payment delay
    await new Promise((r) => setTimeout(r, 900));

    if (!user) {
      setLoading(false);
      toast.error("You must be signed in to complete purchases.");
      return;
    }

    const { error } = await supabase.from("orders").insert([
      {
        user_id: user.id,
        items: items.map((i) => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price })),
        total_amount: amount,
        status: "paid",
      },
    ]);

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

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
          <p className="text-center text-xs text-muted-foreground">Demo checkout — no real card is charged.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;
