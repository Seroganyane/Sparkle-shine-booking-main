import { useState, useEffect } from "react";
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

const ALL_SLOTS = Array.from({ length: 10 }, (_, i) => i + 1);

const schema = z.object({
  car_make: z.string().trim().min(1).max(50),
  car_model: z.string().trim().min(1).max(50),
  car_plate: z.string().trim().min(1).max(15),
  slot_number: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

export const BookingDialog = ({
  freeWashes,
  onBooked,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  freeWashes: number;
  onBooked: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const controlled = typeof openProp === "boolean";
  const dialogOpen = controlled ? openProp : open;
  const setDialogOpen = (value: boolean) => {
    if (onOpenChangeProp) {
      onOpenChangeProp(value);
    }
    if (!controlled) {
      setOpen(value);
    }
  };
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<PackageId>("premium");
  const [useFree, setUseFree] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<number[]>(ALL_SLOTS);
  const [form, setForm] = useState({ car_make: "", car_model: "", car_plate: "", slot_number: 0, notes: "" });

  const loadSlots = async () => {
    const result = await supabase
      .from("bookings")
      .select("slot_number,status")
      .in("status", ["pending", "confirmed", "in_queue", "in_progress"]);
    const rows = (result.data as Array<{ slot_number: number | null }> | null) || [];
    const occupied = new Set<number>(
      rows
        .map((row) => row.slot_number)
        .filter((slot): slot is number => typeof slot === "number")
    );
    const free = ALL_SLOTS.filter((slot) => !occupied.has(slot));
    setAvailableSlots(free);
    if (form.slot_number && occupied.has(form.slot_number)) {
      setForm((prev) => ({ ...prev, slot_number: 0 }));
    }
  };

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

  useEffect(() => {
    loadSlots();
    const channel = supabase
      .channel("booking-slots")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadSlots)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!availableSlots.includes(parsed.data.slot_number)) {
      toast.error("Selected slot is no longer available. Please choose another slot.");
      loadSlots();
      return;
    }
    setLoading(true);
    try {
      const selected = getPackage(pkg);
      const queue_position = useFree ? await getNextQueuePosition() : null;
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id,
        car_make: parsed.data.car_make,
        car_model: parsed.data.car_model,
        car_plate: parsed.data.car_plate.toUpperCase(),
        package: pkg,
        slot_number: parsed.data.slot_number,
        scheduled_at: new Date().toISOString(),
        notes: parsed.data.notes || null,
        amount: useFree ? 0 : selected.price,
        payment_status: useFree ? "free" : "unpaid",
        status: useFree ? "in_queue" : "pending",
        queue_position,
      });
      if (error) throw new Error(error.message);
      if (useFree) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ free_washes: freeWashes - 1 })
          .eq("id", user.id);
        if (profileError) throw new Error(profileError.message);
      }
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Booking confirmed",
        message: `Your ${selected.name} is booked. We'll notify you when it's time!`,
        type: "booking",
      });
      if (notificationError) throw new Error(notificationError.message);
      toast.success("Booking created!");
      setOpen(false);
      setForm({ car_make: "", car_model: "", car_plate: "", slot_number: 0, notes: "" });
      setUseFree(false);
      onBooked();
    } catch (err: unknown) {
      console.error("Booking creation failed", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err && typeof (err as any).message === "string"
          ? (err as any).message
          : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    pkg === p.id ? "border-primary bg-primary/20 shadow-glow" : "border-border hover:border-primary/40"
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
                useFree ? "border-success bg-success/20" : "border-border hover:border-success/40"
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
            <Label>Choose your slot</Label>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {ALL_SLOTS.map((slot) => {
                const taken = !availableSlots.includes(slot);
                const selected = form.slot_number === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => !taken && setForm({ ...form, slot_number: slot })}
                    disabled={taken}
                    className={`rounded-2xl border p-3 text-sm font-semibold transition-all ${
                      taken
                        ? "cursor-not-allowed border-destructive/40 bg-destructive/20 text-destructive"
                        : selected
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    Slot {slot}
                    <div className="text-xs">
                      {taken ? "Unavailable" : "Available"}
                    </div>
                  </button>
                );
              })}
            </div>
            {availableSlots.length === 0 && (
              <p className="mt-2 text-sm text-destructive">No slots are currently available. Please try again later.</p>
            )}
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