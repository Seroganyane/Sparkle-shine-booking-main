import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/app/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPackage } from "@/lib/packages";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import {
  ArrowDown, ArrowUp, Bell, Car, CheckCircle2, Gift, ListOrdered, Play, Send, Shield, Users, LucideIcon
} from "lucide-react";

type Booking = Database['public']['Tables']['bookings']['Row'] & { profile?: Database['public']['Tables']['profiles']['Row'] };
type Profile = Database['public']['Tables']['profiles']['Row'];
type BookingStatus = Database['public']['Enums']['booking_status'];

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  confirmed: "bg-primary/20 text-primary border-primary/30",
  in_queue: "bg-accent/20 text-accent border-accent/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const Admin = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<"queue" | "all" | "completed">("queue");
  const [notifyOpen, setNotifyOpen] = useState<Booking | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);

  const load = useCallback(async () => {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("bookings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, phone, reward_points, free_washes").order("created_at", { ascending: false }),
    ]);
    // attach profile to each booking
    const map = new Map((p || []).map((x: Profile) => [x.id, x]));
    setBookings((b || []).map((bk) => ({ ...bk, profile: map.get(bk.user_id) })));
    setProfiles(p || []);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  // queue: pending/confirmed/in_queue/in_progress, ordered by queue_position then scheduled_at
  const queueBookings = bookings
    .filter((b) => ["pending", "confirmed", "in_queue", "in_progress"].includes(b.status))
    .sort((a, b) => {
      const aq = a.queue_position ?? 9999;
      const bq = b.queue_position ?? 9999;
      if (aq !== bq) return aq - bq;
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });

  const slotNumbers = Array.from({ length: 10 }, (_, i) => i + 1);
  const slotSummaries = slotNumbers.map((slot) => {
    const assigned = bookings
      .filter((b) => b.slot_number === slot && !["completed", "cancelled"].includes(b.status))
      .sort((a, b) => {
        const weight = (status: BookingStatus) => {
          if (status === "in_progress") return 0;
          if (status === "confirmed") return 1;
          if (status === "in_queue") return 2;
          return 3;
        };
        return weight(a.status) - weight(b.status) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    return {
      slot,
      booking: assigned[0] || null,
      busy: assigned.length > 0,
    };
  });

  useEffect(() => {
    const promoteSlots = async () => {
      const updates: Promise<unknown>[] = [];
      for (const slot of slotNumbers) {
        const hasActive = bookings.some((b) => b.slot_number === slot && b.status === "in_progress");
        if (hasActive) continue;
        const nextBooking = bookings
          .filter((b) => b.slot_number === slot && ["confirmed", "in_queue"].includes(b.status))
          .sort((a, b) => {
            const aq = a.queue_position ?? 9999;
            const bq = b.queue_position ?? 9999;
            if (aq !== bq) return aq - bq;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          })[0];
        if (nextBooking) {
          updates.push(supabase.from("bookings").update({ status: "in_progress" }).eq("id", nextBooking.id));
        }
      }
      if (updates.length) {
        await Promise.all(updates);
      }
    };

    if (bookings.length) {
      promoteSlots();
    }
  }, [bookings]);

  const completedBookings = bookings.filter((b) => b.status === "completed");
  const completedToday = completedBookings.filter((b) => new Date(b.updated_at).toDateString() === new Date().toDateString());
  const completedThisMonth = completedBookings.filter(
    (b) => new Date(b.updated_at).getMonth() === new Date().getMonth() && new Date(b.updated_at).getFullYear() === new Date().getFullYear()
  );
  const completedThisYear = completedBookings.filter((b) => new Date(b.updated_at).getFullYear() === new Date().getFullYear());
  const revenueFor = (list: Booking[]) => list.reduce((sum, b) => sum + Number(b.amount ?? getPackage(b.package).price), 0);
  const costFor = (list: Booking[]) => list.reduce((sum, b) => sum + getPackage(b.package).cost, 0);
  const profitFor = (list: Booking[]) => revenueFor(list) - costFor(list);
  const profitMarginFor = (list: Booking[]) => {
    const revenue = revenueFor(list);
    return revenue === 0 ? 0 : ((revenue - costFor(list)) / revenue) * 100;
  };

  const visible = filter === "queue" ? queueBookings : filter === "completed" ? completedBookings : bookings;

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Status: ${status.replace("_", " ")}`);
  };

  const setQueuePos = async (id: string, pos: number | null) => {
    await supabase.from("bookings").update({ queue_position: pos, status: pos ? "in_queue" : "confirmed" }).eq("id", id);
  };

  const moveInQueue = async (booking: Booking, dir: -1 | 1) => {
    const list = queueBookings.filter((b) => b.queue_position != null);
    const idx = list.findIndex((b) => b.id === booking.id);
    if (idx < 0) return;
    const swapWith = list[idx + dir];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("bookings").update({ queue_position: swapWith.queue_position }).eq("id", booking.id),
      supabase.from("bookings").update({ queue_position: booking.queue_position }).eq("id", swapWith.id),
    ]);
  };

  const autoQueue = async () => {
    const sorted = [...queueBookings].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      await supabase.from("bookings").update({ queue_position: i + 1, status: "in_queue" }).eq("id", sorted[i].id);
    }
    toast.success("Queue auto-ordered (first booked = first in line)");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8 md:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold md:text-4xl">
              <Shield className="h-8 w-8 text-primary" /> Admin Console
            </h1>
            <p className="text-muted-foreground">Manage bookings, queue & rewards</p>
          </div>
          <div className="flex gap-2">
            <Button variant="glass" onClick={autoQueue}>
              <ListOrdered className="h-4 w-4" /> Auto-order queue
            </Button>
            <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Gift className="h-4 w-4" /> Grant reward
                </Button>
              </DialogTrigger>
              <GrantRewardDialog profiles={profiles} onDone={() => { setRewardOpen(false); load(); }} />
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <h2 className="mb-4 font-display text-xl font-semibold">Employee slots</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {slotSummaries.map(({ slot, booking, busy }) => (
              <div key={slot} className="rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Employee {slot}</div>
                    <div className="font-display text-xl font-bold">Slot {slot}</div>
                  </div>
                  <Badge variant="outline" className={busy ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success"}>
                    {busy ? `Reserved · ${booking?.status.replace("_", " ")}` : "Available"}
                  </Badge>
                </div>
                {booking ? (
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    <div>{booking.car_make} {booking.car_model}</div>
                    <div>#{booking.car_plate}</div>
                    <div>{getPackage(booking.package).name}</div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">Ready for the next car.</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard icon={Car} label="Busy slots" value={slotSummaries.filter((slot) => slot.busy).length} />
          <StatCard icon={CheckCircle2} label="Completed today" value={bookings.filter((b) => b.status === "completed" && new Date(b.updated_at).toDateString() === new Date().toDateString()).length} />
          <StatCard icon={Users} label="Total customers" value={profiles.length} />
          <StatCard icon={Bell} label="Total bookings" value={bookings.length} />
        </div>

        {/* Analytics */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ArrowUp} label="Daily Profit" value={revenueFor(completedToday) - costFor(completedToday)} />
          <StatCard icon={ArrowUp} label="Monthly Profit" value={revenueFor(completedThisMonth) - costFor(completedThisMonth)} />
          <StatCard icon={ArrowUp} label="Yearly Profit" value={revenueFor(completedThisYear) - costFor(completedThisYear)} />
          <StatCard icon={ArrowDown} label="Total Expenses" value={costFor(completedBookings)} />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(["queue", "all", "completed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "hero" : "glass"} size="sm" onClick={() => setFilter(f)}>
              {f === "queue" ? "Active queue" : f === "all" ? "All bookings" : "Completed"}
            </Button>
          ))}
        </div>

        {/* Bookings table */}
        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No bookings.
            </div>
          ) : (
            visible.map((b) => {
              const pkg = getPackage(b.package);
              return (
                <div key={b.id} className="rounded-2xl border border-border bg-gradient-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      {b.queue_position && (
                        <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-primary font-display text-xl font-bold text-primary-foreground shadow-glow">
                          #{b.queue_position}
                        </div>
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold">{b.profile?.full_name || "Customer"}</span>
                          <Badge variant="outline" className={statusColors[b.status]}>{b.status.replace("_", " ")}</Badge>
                          <Badge variant="outline">{pkg.name}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {b.car_make} {b.car_model} · <span className="font-mono">{b.car_plate}</span> · {b.profile?.phone}
                        </p>
                        <p className="mt-1 text-sm">Slot #{b.slot_number ?? "N/A"} · R {Number(b.amount).toFixed(2)} · {b.payment_status}</p>
                        {b.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{b.notes}"</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.queue_position && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => moveInQueue(b, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => moveInQueue(b, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {!b.queue_position && b.status !== "completed" && b.status !== "cancelled" && (
                        <Button size="sm" variant="glass" onClick={() => setQueuePos(b.id, queueBookings.filter((x) => x.queue_position).length + 1)}>
                          <ListOrdered className="h-4 w-4" /> Add to queue
                        </Button>
                      )}
                      <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_queue">In queue</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="hero" onClick={() => setNotifyOpen(b)}>
                        <Send className="h-4 w-4" /> Notify
                      </Button>
                      {b.status === "in_queue" && (
                        <Button size="sm" variant="glass" onClick={() => updateStatus(b.id, "in_progress")}>
                          <Play className="h-4 w-4" /> Start
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {notifyOpen && <NotifyDialog booking={notifyOpen} onClose={() => setNotifyOpen(null)} />}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) => (
  <div className="rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">{label}</div>
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="mt-2 font-display text-3xl font-bold">{value}</div>
  </div>
);

const NotifyDialog = ({ booking, onClose }: { booking: Booking; onClose: () => void }) => {
  const [title, setTitle] = useState("It's time! 🚗");
  const [message, setMessage] = useState(`Hi ${booking.profile?.full_name?.split(" ")[0] || ""}, please bring your ${booking.car_make} ${booking.car_model} now — your wash bay is ready.`);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: booking.user_id,
      title,
      message,
      type: "alert",
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Notification sent!");
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Notify customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={300} />
          </div>
          <Button variant="hero" className="w-full" onClick={send} disabled={loading}>
            <Send className="h-4 w-4" /> Send notification
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GrantRewardDialog = ({ profiles, onDone }: { profiles: Profile[]; onDone: () => void }) => {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(false);

  const grant = async () => {
    if (!userId) {
      toast.error("Pick a customer");
      return;
    }
    setLoading(true);
    const target = profiles.find((p) => p.id === userId);
    const { error } = await supabase
      .from("profiles")
      .update({ free_washes: (target?.free_washes || 0) + amount })
      .eq("id", userId);
    if (!error) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "🎁 Free wash granted!",
        message: `You've been awarded ${amount} free car wash${amount > 1 ? "es" : ""} by AquaLux. Enjoy!`,
        type: "reward",
      });
    }
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Reward granted!");
      onDone();
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display">Grant free wash</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Customer</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email} ({p.free_washes} free)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Number of free washes</Label>
          <Input type="number" min={1} max={10} value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 1)} />
        </div>
        <Button variant="hero" className="w-full" onClick={grant} disabled={loading}>
          <Gift className="h-4 w-4" /> Grant reward
        </Button>
      </div>
    </DialogContent>
  );
};

export default Admin;