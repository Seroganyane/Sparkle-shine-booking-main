import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/app/Navbar";
import { BookingDialog } from "@/components/app/BookingDialog";
import { Chatbot } from "@/components/app/Chatbot";
import { PaymentDialog } from "@/components/app/PaymentDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPackage } from "@/lib/packages";
import { fetchWeatherPrediction } from "@/lib/weather";
import { Bell, Car, Clock, Gift, Sparkles, CreditCard, CheckCircle2, XCircle, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Booking = Database['public']['Tables']['bookings']['Row'];
type Profile = { reward_points: number; free_washes: number; full_name: string | null };
type Notif = { id: string; title: string; message: string; type: string; read: boolean; created_at: string };

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  confirmed: "bg-primary/20 text-primary border-primary/30",
  in_queue: "bg-accent/20 text-accent border-accent/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [payTarget, setPayTarget] = useState<{ id: string; amount: number } | null>(null);

  const { data: weather, isLoading: weatherLoading, isError: weatherError } = useQuery({
    queryKey: ["weather-prediction"],
    queryFn: () => fetchWeatherPrediction(-26.2041, 28.0473),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: b }, { data: n }] = await Promise.all([
      supabase.from("profiles").select("reward_points, free_washes, full_name").eq("id", user.id).maybeSingle(),
      supabase.from("bookings").select("*").eq("user_id", user.id).order("scheduled_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(p as Profile);
    setBookings(b || []);
    setNotifs((n as Notif[]) || []);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel("user-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as Notif;
        toast.success(n.title, { description: n.message });
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Booking cancelled");
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  };

  const points = profile?.reward_points ?? 0;
  const free = profile?.free_washes ?? 0;
  const progressPct = (points / 10) * 100;

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.15),transparent_60%)]" />
      <Navbar />
      <main className="container relative py-8 md:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Hi {profile?.full_name?.split(" ")[0] || "there"} 👋
            </h1>
            <p className="text-muted-foreground">Manage your bookings and rewards</p>
          </div>
          <BookingDialog freeWashes={free} onBooked={load} />
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Reward points</div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-2 font-display text-4xl font-bold">{points}<span className="text-lg text-muted-foreground">/10</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{10 - points} more to a free wash</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-gradient-card p-6 shadow-glow">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Free washes</div>
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-2 font-display text-4xl font-bold">{free}</div>
            <p className="mt-2 text-xs text-muted-foreground">Use one on your next booking</p>
          </div>
          <div className="rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Total bookings</div>
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-2 font-display text-4xl font-bold">{bookings.length}</div>
            <p className="mt-2 text-xs text-muted-foreground">Lifetime washes booked</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-border bg-gradient-card p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-sm text-muted-foreground">Weather recommendation</div>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                {weatherLoading
                  ? "Checking today's weather..."
                  : weatherError
                  ? "Weather service unavailable"
                  : weather?.headline ?? "Weather update unavailable"}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {weatherLoading
                  ? "One moment while we find the best time to bring your car in."
                  : weatherError
                  ? "We couldn't load weather data right now. Please refresh later."
                  : weather?.details}
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary sm:h-20 sm:w-20">
              <Bell className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bookings */}
          <section className="lg:col-span-2">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
              <Clock className="h-5 w-5 text-primary" /> Your bookings
            </h2>
            {bookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                No bookings yet. Click <strong>New booking</strong> to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => {
                  const pkg = getPackage(b.package);
                  return (
                    <div key={b.id} className="rounded-2xl border border-border bg-gradient-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-lg font-semibold">{pkg.name}</h3>
                            <Badge variant="outline" className={statusColors[b.status]}>{b.status.replace("_", " ")}</Badge>
                            {b.queue_position && (
                              <Badge variant="outline" className="border-accent/30 bg-accent/20 text-accent">
                                <ListOrdered className="mr-1 h-3 w-3" /> #{b.queue_position}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {b.car_make} {b.car_model} · <span className="font-mono">{b.car_plate}</span>
                          </p>
                          <p className="mt-1 text-sm">
                            Slot #{b.slot_number ?? "N/A"}
                          </p>
                          {b.payment_status === "unpaid" && b.status !== "cancelled" && (
                            <p className="mt-3 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                              Your slot is reserved. Please return to complete payment and keep your booking active.
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-display text-xl font-bold">
                            {b.payment_status === "free" ? <span className="text-success">FREE</span> : `R ${Number(b.amount).toFixed(2)}`}
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {b.payment_status === "paid" && <CheckCircle2 className="mr-1 h-3 w-3 text-success" />}
                            {b.payment_status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {b.payment_status === "unpaid" && b.status !== "cancelled" && (
                          <Button size="sm" variant="hero" onClick={() => setPayTarget({ id: b.id, amount: Number(b.amount) })}>
                            <CreditCard className="h-4 w-4" /> Pay now
                          </Button>
                        )}
                        {["pending", "confirmed", "in_queue"].includes(b.status) && (
                          <Button size="sm" variant="ghost" onClick={() => cancel(b.id)}>
                            <XCircle className="h-4 w-4" /> Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notifications */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
              <Bell className="h-5 w-5 text-primary" /> Notifications
            </h2>
            <div className="space-y-2">
              {notifs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </div>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      n.read ? "border-border bg-card/80" : "border-primary/30 bg-primary/20 shadow-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{n.title}</div>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          onOpenChange={(o) => !o && setPayTarget(null)}
          bookingId={payTarget.id}
          amount={payTarget.amount}
          onPaid={load}
        />
      )}

      <Chatbot freeWashes={free} onBooked={load} />
    </div>
  );
};

export default Dashboard;