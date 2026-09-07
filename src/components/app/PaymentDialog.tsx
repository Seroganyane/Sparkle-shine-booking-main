import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { openPaystackCheckout, verifyPaystackPayment } from "@/lib/paystack";

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

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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

    const { data: profileData } = bookingData?.user_id
      ? await supabase.from("profiles").select("email").eq("id", bookingData.user_id).maybeSingle()
      : { data: null };
    const email = profileData?.email ?? "customer@example.com";

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

    try {
      await verifyPaystackPayment({
        reference: paystack.reference!,
        paymentType: "booking",
        bookingId,
      });
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "We could not verify your payment.");
      return;
    }

    setLoading(false);
    toast.success("You have successfully paid!", {
      description: "Your payment has been received and your booking is confirmed.",
    });
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
