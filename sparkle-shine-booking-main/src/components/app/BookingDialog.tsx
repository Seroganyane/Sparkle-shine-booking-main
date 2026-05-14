import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PACKAGES, PackageId, getPackage } from "@/lib/packages";
import { toast } from "sonner";
import { Loader2, Plus, Gift } from "lucide-react";

const schema = z.object({
  car_make: z.string().trim().min(1).max(50),
  car_model: z.string().trim().min(1).max(50),
  car_plate: z.string().trim().min(1).max(15),
  scheduled_at: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const BookingDialog = ({ freeWashes, onBooked }: { freeWashes: number; onBooked: () => void }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<PackageId>("premium");
  const [useFree, setUseFree] = useState(false);
  const [form, setForm] = useState({ car_make: "", car_model: "", car_plate: "", scheduled_at: "", notes: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const selected = getPackage(pkg);
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        car_make: parsed.data.car_make,
        car_model: parsed.data.car_model,
        car_plate: parsed.data.car_plate.toUpperCase(),
        package: pkg,
        scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
        notes: parsed.data.notes || null,
        amount: useFree ? 0 : selected.price,
        payment_status: useFree ? "free" : "unpaid",
        status: "pending",
      });
      if (error) throw error;
      if (useFree) {
        await supabase
          .from("profiles")
          .update({ free_washes: freeWashes - 1 })
          .eq("id", user.id);
      }
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Booking confirmed",
        message: `Your ${selected.name} is booked. We'll notify you when it's time!`,
        type: "booking",
      });
      toast.success("Booking created!");
      setOpen(false);
      setForm({ car_make: "", car_model: "", car_plate: "", scheduled_at: "", notes: "" });
      setUseFree(false);
      onBooked();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="lg">
          <Plus className="h-5 w-5" /> New booking
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Book a car wash</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Wash package</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PACKAGES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPkg(p.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    pkg === p.id ? "border-primary bg-primary/10 shadow-glow" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="text-xs text-muted-foreground">{p.duration}</div>
                  <div className="font-semibold">{p.name.split(" ")[0]}</div>
                  <div className="font-display font-bold text-primary">R {p.price}</div>
                </button>
              ))}
            </div>
          </div>

          {freeWashes > 0 && (
            <button
              type="button"
              onClick={() => setUseFree(!useFree)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                useFree ? "border-success bg-success/10" : "border-border hover:border-success/40"
              }`}
            >
              <Gift className="h-5 w-5 text-success" />
              <div className="flex-1">
                <div className="font-semibold">Use a free wash</div>
                <div className="text-xs text-muted-foreground">You have {freeWashes} available</div>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 ${useFree ? "border-success bg-success" : "border-border"}`} />
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="make">Car make</Label>
              <Input id="make" placeholder="Toyota" value={form.car_make} onChange={(e) => setForm({ ...form, car_make: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="Camry" value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label htmlFor="plate">License plate</Label>
            <Input id="plate" placeholder="ABC 123" value={form.car_plate} onChange={(e) => setForm({ ...form, car_plate: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="when">When</Label>
            <Input id="when" type="datetime-local" min={minDate} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {useFree ? "Confirm free booking" : `Confirm — R ${getPackage(pkg).price}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};