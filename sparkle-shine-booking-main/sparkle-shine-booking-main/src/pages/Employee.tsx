import { useCallback, useEffect, useState } from "react";
import { Car, CheckCircle2, Clock3, Loader2, UserRound, Badge as BadgeIcon, Camera, ShieldCheck, ThumbsUp } from "lucide-react";
import { Navbar } from "@/components/app/Navbar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPackage } from "@/lib/packages";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Assignment = Database["public"]["Tables"]["employee_assignments"]["Row"] & { booking: Booking | null };

const Employee = () => {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [permanentSlot, setPermanentSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const loadSlot = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("employee_slots")
      .select("slot_number")
      .eq("employee_id", user.id)
      .maybeSingle();
    if (error) console.error("Could not load slot:", error);
    else setPermanentSlot(data?.slot_number ?? null);
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_assignments")
      .select("*, booking:bookings(*)")
      .eq("employee_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    setLoading(false);
    if (error) toast.error("Could not load your assignment: " + error.message);
    else setAssignment(data as Assignment | null);
  }, [user]);

  useEffect(() => {
    void loadSlot();
    void load();
    const channel = supabase.channel("employee-work")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_assignments", filter: `employee_id=eq.${user?.id}` }, load)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, loadSlot, user?.id]);

  const finishWash = async () => {
    if (!assignment) return;
    setFinishing(true);
    const { error } = await supabase.rpc("complete_employee_assignment", { _assignment_id: assignment.id });
    setFinishing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Supervisor alerted. Your slot is now available.");
    setAssignment(null);
  };

  const acceptBooking = async () => {
    if (!assignment) return;
    setAccepting(true);
    const { error } = await supabase.rpc("accept_employee_booking", { _assignment_id: assignment.id });
    setAccepting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booking accepted. The customer has been notified to bring their car.");
    await load();
  };

  const scanNumberPlate = async (file: File) => {
    if (!assignment || !booking) return;
    setScanning(true);
    setScanProgress(0);
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (event) => {
          if (event.status === "recognizing text") setScanProgress(Math.round(event.progress * 100));
        },
      });
      const expected = booking.car_plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
      const candidates = result.data.text
        .split(/\r?\n/)
        .map((line) => line.replace(/[^a-z0-9]/gi, "").toUpperCase())
        .filter(Boolean);
      const scannedPlate = candidates.find((candidate) => candidate === expected)
        ?? candidates.find((candidate) => candidate.includes(expected) || expected.includes(candidate));

      if (!scannedPlate || scannedPlate !== expected) {
        toast.error("Number plate does not match this booking. Check the photo and scan again.");
        return;
      }

      const { error } = await supabase.rpc("verify_employee_vehicle", {
        _assignment_id: assignment.id,
        _scanned_plate: scannedPlate,
      });
      if (error) throw error;
      toast.success("Vehicle verified. All admins have been notified.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not scan this number plate";
      toast.error(message);
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const booking = assignment?.booking;
  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.15),transparent_60%)]" />
      <Navbar />
      <AppSidebar />
      <main className="relative mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 md:pb-12 lg:ml-64 lg:max-w-none lg:px-8 lg:pt-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold md:text-4xl"><UserRound className="h-8 w-8 text-primary" /> My wash slot</h1>
            <p className="mt-1 text-muted-foreground">See your assigned vehicle and tell your supervisor when you are ready again.</p>
          </div>
          <Badge variant="outline" className={assignment ? "border-warning/30 bg-warning/10 px-3 py-1 text-warning" : "border-success/30 bg-success/10 px-3 py-1 text-success"}>
            {assignment ? "Busy – wash in progress" : "Available for assignment"}
          </Badge>
        </div>

        {permanentSlot && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <BadgeIcon className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">Your permanent station</p>
                <p className="font-display text-2xl font-bold text-primary">Wash Bay #{permanentSlot}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : booking ? (
          <section className="max-w-3xl rounded-3xl border border-primary/30 bg-gradient-card p-6 shadow-card md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Assigned vehicle</p>
                <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold"><Car className="h-7 w-7 text-primary" /> {booking.car_make} {booking.car_model}</h2>
                <p className="mt-2 font-mono text-lg text-muted-foreground">{booking.car_plate}</p>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{getPackage(booking.package).name}</Badge>
            </div>
            <div className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Wash bay</p><p className="mt-1 font-display text-xl font-semibold">Slot #{booking.slot_number ?? "�"}</p></div>
              <div><p className="text-sm text-muted-foreground">Customer notes</p><p className="mt-1 font-medium">{booking.notes || "No special instructions"}</p></div>
            </div>
            {!assignment.accepted_at ? (
              <>
                <Button className="mt-6 w-full sm:w-auto" variant="hero" size="lg" onClick={acceptBooking} disabled={accepting}>
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Accept booking & notify customer
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">Accept only when your wash bay is available. The customer will be told to bring their car.</p>
              </>
            ) : !assignment.plate_verified_at ? (
              <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <Camera className="h-8 w-8 text-primary" />
                <h3 className="mt-3 font-display text-xl font-semibold">Verify the arriving vehicle</h3>
                <p className="mt-1 text-sm text-muted-foreground">Use your phone camera to scan the number plate. It must match <span className="font-mono font-semibold text-foreground">{booking.car_plate}</span>.</p>
                <label className="mt-4 block">
                  <Input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={scanning}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void scanNumberPlate(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <span className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {scanning ? `Reading plate${scanProgress ? ` ${scanProgress}%` : "..."}` : "Scan number plate"}
                  </span>
                </label>
                <p className="mt-3 text-xs text-muted-foreground">The image is read on this device and is not uploaded.</p>
              </div>
            ) : (
              <>
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-sm font-medium text-success">
                  <ShieldCheck className="h-5 w-5" /> Correct customer vehicle verified
                </div>
                <Button className="mt-6 w-full sm:w-auto" variant="hero" size="lg" onClick={finishWash} disabled={finishing}>
                  {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Finish wash & alert supervisor
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">This marks the wash complete and lets your supervisor know that you can receive another car.</p>
              </>
            )}
          </section>
        ) : (
          <section className="max-w-3xl rounded-3xl border border-dashed border-border bg-gradient-card p-10 text-center shadow-card">
            <Clock3 className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-4 font-display text-2xl font-bold">Your slot is available</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">You do not have a vehicle assigned right now. Your supervisor can assign the next car when it is ready.</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default Employee;
