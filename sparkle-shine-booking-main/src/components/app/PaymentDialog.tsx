import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { openPaystackCheckout } from "@/lib/paystack";

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

    const { data: bookingData, error: fetchError } = await supabase
      .from("bookings")
      .select("queue_position, user_id, user:profiles(email)")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError) {
      setLoading(false);
      toast.error(fetchError.message);
      return;
    }

    const email = bookingData?.user?.email ?? "customer@example.com";

    const paystack = await openPaystackCheckout({
      email,
      amount,
      reference: `booking-${bookingId}-${Date.now()}`,
      metadata: {
        type: "booking_payment",
        booking_id: bookingId,
      },
    });

    if (paystack.status === "cancelled") {
      setLoading(false);
      toast.info("Payment cancelled");
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
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Pay R {amount.toFixed(2)}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};