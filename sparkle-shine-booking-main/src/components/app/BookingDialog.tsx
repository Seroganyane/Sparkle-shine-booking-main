import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PACKAGES, PackageId, getPackage } from "@/lib/packages";
import { toast } from "sonner";
import { Loader2, Plus, Gift, Lock, Check } from "lucide-react";
import { showFieldError } from "@/lib/fieldError";

const ALL_SLOTS = Array.from({ length: 10 }, (_, i) => i + 1);

export type BookingPrefill = {
  car_make: string;
  car_model: string;
  car_plate: string;
  slot_number: number;
  package: PackageId;
};

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
  initialDraft,
}: {
  freeWashes: number;
  onBooked: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialDraft?: BookingPrefill | null;
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

  useEffect(() => {
    if (!initialDraft) return;
    setPkg(initialDraft.package);
    setForm({
      car_make: initialDraft.car_make,
      car_model: initialDraft.car_model,
      car_plate: initialDraft.car_plate,
      slot_number: initialDraft.slot_number,
      notes: "",
    });
  }, [initialDraft]);

  const loadSlots = async () => {
    // A regular customer's RLS policy only lets them see their own bookings, so
    // querying the bookings table directly here would under-report how many
    // bays are actually taken. This RPC returns just the occupied slot
    // numbers, computed server-side across every customer's bookings.
    const { data, error } = await supabase.rpc("get_occupied_wash_slots");
    if (error) console.error("Could not load wash bay availability:", error.message);
    const occupied = new Set<number>((data as number[] | null) || []);
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
    if (!user) {
      toast.error("Please sign in to book a wash before confirming.");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldIds: Record<string, string> = { car_make: "make", car_model: "model", car_plate: "plate", slot_number: "slot-choice", notes: "notes" };
      showFieldError(parsed.error.issues[0].message, fieldIds[String(parsed.error.issues[0].path[0])] || "make");
      return;
    }
    if (useFree && freeWashes <= 0) {
      toast.error("You don't have any free washes left.");
      return;
    }
    if (!availableSlots.includes(parsed.data.slot_number)) {
      showFieldError("Selected slot is no longer available. Please choose another slot.", "slot-choice");
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
      if (error) {
        if (error.code === "23505") {
          loadSlots();
          throw new Error("That wash bay was just taken by another booking. Please choose a different slot.");
        }
        throw new Error(error.message);
      }
      if (useFree) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ free_washes: freeWashes - 1 })
          .eq("id", user.id);
        if (profileError) throw new Error(profileError.message);
      }
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Booking received",
        message: `Your ${selected.name} request was received. Staff will notify you when it is accepted and you can bring your car.`,
        type: "booking",
      });
      if (notificationError) throw new Error(notificationError.message);
      toast.success("Booking created!");
      setDialogOpen(false);
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
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium">Wash package</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PACKAGES.map((p) => (
                <HoverCard key={p.id} openDelay={100} closeDelay={50}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPkg(p.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        pkg === p.id ? "border-primary bg-primary/20 shadow-glow" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground">{p.duration}</div>
                      <div className="font-semibold">{p.name.split(" ")[0]}</div>
                      <div className="font-display font-bold text-primary">R {p.price}</div>
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" className="w-60">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-display font-semibold">{p.name}</div>
                      <div className="font-display font-bold text-primary">R {p.price}</div>
                    </div>
                    <div className="mb-2 text-xs text-muted-foreground">About {p.duration}</div>
                    <ul className="space-y-1 text-sm">
                      {p.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </div>
          </fieldset>

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
              <Input id="make" placeholder="Toyota" maxLength={50} value={form.car_make} onChange={(e) => setForm({ ...form, car_make: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Input id="model" placeholder="Camry" maxLength={50} value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })} required />
            </div>
          </div>
          <div>
            <Label htmlFor="plate">License plate</Label>
            <Input id="plate" placeholder="ABC 123" maxLength={15} value={form.car_plate} onChange={(e) => setForm({ ...form, car_plate: e.target.value })} required />
          </div>
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-sm font-medium">Choose your slot</legend>
            <div id="slot-choice" tabIndex={-1} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                        ? "cursor-not-allowed border-destructive/40 bg-destructive/20 text-destructive opacity-60"
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
            {availableSlots.length === 0 ? (
              <p className="mt-2 text-sm text-destructive">No slots are currently available. Please try again later.</p>
            ) : !form.slot_number ? (
              <p className="mt-2 text-sm text-muted-foreground">Please select a slot before confirming.</p>
            ) : null}
          </fieldset>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button
            type="submit"
            variant="hero"
            className="w-full"
            size="lg"
            disabled={loading || !form.slot_number || availableSlots.length === 0}
            title={
              loading
                ? "Processing your booking..."
                : availableSlots.length === 0
                ? "No available slots right now"
                : !form.slot_number
                ? "Select a slot to enable booking"
                : undefined
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !form.slot_number || availableSlots.length === 0 ? (
              <Lock className="mr-2 h-4 w-4" />
            ) : null}
            {useFree ? "Confirm free booking" : `Confirm — R ${getPackage(pkg).price}`}
          </Button>
          {availableSlots.length === 0 ? (
            <p className="mt-2 text-sm text-destructive">No slots are currently available. Please try again later.</p>
          ) : !form.slot_number ? (
            <p className="mt-2 text-sm text-muted-foreground">Please select an available slot before confirming your booking.</p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
};
