import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";

export const PaymentDialog = ({
  open,
  onOpenChange,
  bookingId,
  amount,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: string;
  amount: number;
  onPaid: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", name: "" });

  const getNextQueuePosition = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("queue_position")
      .in("status", ["confirmed", "in_queue", "in_progress"])
      .order("queue_position", { ascending: false })
      .limit(1);

    const maxPos = data?.[0]?.queue_position ?? 0;
    return maxPos + 1;
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulated payment — replace with real Stripe later
    await new Promise((r) => setTimeout(r, 1200));

    const { data: bookingData, error: fetchError } = await supabase
      .from("bookings")
      .select("queue_position, user_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError) {
      setLoading(false);
      toast.error(fetchError.message);
      return;
    }

    const nextQueuePosition = bookingData?.queue_position ?? (await getNextQueuePosition());

    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "paid", status: "in_queue", queue_position: nextQueuePosition })
      .eq("id", bookingId);

    if (!error && bookingData?.user_id) {
      await supabase.from("notifications").insert({
        user_id: bookingData.user_id,
        title: "Your car is ready to be washed",
        message: "Your slot is paid and reserved. Your car is now in the queue and will be washed soon.",
        type: "booking",
      });
    }

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment successful!");
    onPaid();
    onOpenChange(false);
    setCard({ number: "", exp: "", cvc: "", name: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Secure payment
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={pay} className="space-y-4">
          <div className="rounded-xl border border-border bg-gradient-card p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="font-display text-3xl font-bold">R {amount.toFixed(2)}</div>
          </div>
          <div>
            <Label>Cardholder name</Label>
            <Input required value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Card number</Label>
            <Input
              required
              inputMode="numeric"
              maxLength={19}
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim() })}
              placeholder="4242 4242 4242 4242"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expiry</Label>
              <Input required maxLength={5} value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/YY" />
            </div>
            <div>
              <Label>CVC</Label>
              <Input required maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} placeholder="123" />
            </div>
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