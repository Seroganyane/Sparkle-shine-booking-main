import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  ArrowDown, ArrowUp, Bell, Car, CheckCircle2, Gift, ListOrdered, Play, Send, Shield, Users, LucideIcon, ShoppingBag, UserPlus
} from "lucide-react";

type Booking = Database['public']['Tables']['bookings']['Row'] & { profile?: Database['public']['Tables']['profiles']['Row'] };
type Profile = Database['public']['Tables']['profiles']['Row'];
type BookingStatus = Database['public']['Enums']['booking_status'];

interface Order {
  id: string;
  user_id: string;
  items: any[];
  total_amount: number;
  status: string;
  created_at: string;
  profile?: Profile;
}

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
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"queue" | "all" | "completed">("queue");
  const [notifyOpen, setNotifyOpen] = useState<Booking | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [registerEmployeeOpen, setRegisterEmployeeOpen] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [employeeSlots, setEmployeeSlots] = useState<Record<string, number>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [{ data: b }, { data: p }, { data: roleRows }, { data: o }, { data: slots }] = await Promise.all([
      supabase.from("bookings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_slots").select("employee_id, slot_number"),
    ]);
    // attach profile to each booking
    const map = new Map((p || []).map((x: Profile) => [x.id, x]));
    setBookings((b || []).map((bk) => ({ ...bk, profile: map.get(bk.user_id) })));
    setProfiles(p || []);
    const employeeIds = new Set((roleRows || []).filter((row) => row.role === "employee").map((row) => row.user_id));
    const adminIds = new Set((roleRows || []).filter((row) => row.role === "admin").map((row) => row.user_id));
    setEmployees((p || []).filter((profile: Profile) => employeeIds.has(profile.id)));
    setAdmins((p || []).filter((profile: Profile) => adminIds.has(profile.id)));
    setEmployeeSlots(Object.fromEntries((slots || []).map((slot) => [slot.employee_id, slot.slot_number])));
    setSlotDrafts((current) => {
      const next = { ...current };
      for (const slot of slots || []) {
        next[slot.employee_id] = String(slot.slot_number);
      }
      return next;
    });
    
    // Attach profiles to orders
    const ordersWithProfiles = (o || []).map((order: any) => ({
      ...order,
      profile: map.get(order.user_id)
    }));
    setOrders(ordersWithProfiles);
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
      const updates: PromiseLike<unknown>[] = [];
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

  const assignPermanentEmployeeSlot = async (employeeId: string) => {
    const rawValue = slotDrafts[employeeId];
    const chosenSlot = Number(rawValue);
    if (!rawValue || Number.isNaN(chosenSlot) || chosenSlot < 1 || chosenSlot > 10) {
      toast.error("Select a valid slot first.");
      return;
    }

    const { data: takenSlot, error: takenSlotError } = await supabase
      .from("employee_slots")
      .select("employee_id")
      .eq("slot_number", chosenSlot)
      .maybeSingle();

    if (takenSlotError) {
      toast.error(takenSlotError.message);
      return;
    }
    if (takenSlot && takenSlot.employee_id !== employeeId) {
      toast.error(`Wash Bay #${chosenSlot} is already assigned to another staff member.`);
      return;
    }

    const { error } = await supabase
      .from("employee_slots")
      .upsert({ employee_id: employeeId, slot_number: chosenSlot }, { onConflict: "employee_id" });

    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("profiles").update({ assigned_slot_number: chosenSlot }).eq("id", employeeId);
    toast.success(`Staff permanent slot assigned to Wash Bay #${chosenSlot}.`);
    load();
  };

  const assignEmployee = async (booking: Booking, employeeId: string) => {
    if (!user) return;

    const { data: employeeSlotData, error: employeeSlotError } = await supabase
      .from("employee_slots")
      .select("slot_number")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (employeeSlotError) {
      toast.error(employeeSlotError.message);
      return;
    }

    const targetSlot = booking.slot_number ?? employeeSlotData?.slot_number ?? null;
    if (!targetSlot) {
      toast.error("This booking has no available slot to assign.");
      return;
    }

    const { error } = await supabase.from("employee_assignments").insert({
      booking_id: booking.id,
      employee_id: employeeId,
      assigned_by: user.id,
      status: "active",
    });

    if (error) { toast.error(error.message); return; }
    await supabase.from("bookings").update({ status: "in_progress", slot_number: targetSlot }).eq("id", booking.id);
    toast.success(`Employee assigned to Wash Bay #${targetSlot}.`);
    load();
  };

  const makeEmployee = async (profileId: string) => {
    const { error } = await supabase.from("user_roles").upsert({ user_id: profileId, role: "employee" }, { onConflict: "user_id,role" });
    if (error) toast.error(error.message); else { toast.success("Staff account can now use the employee workspace."); load(); }
  };

  const makeAdmin = async (profileId: string) => {
    const { error } = await supabase.from("user_roles").upsert({ user_id: profileId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) toast.error(error.message); else { toast.success("Admin access granted to this account."); load(); }
  };

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
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.15),transparent_60%)]" />
      <Navbar />
      <main className="container relative py-8 md:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold md:text-4xl">
              <Shield className="h-8 w-8 text-primary" /> Admin Console
            </h1>
            <p className="text-muted-foreground">Manage bookings, queue & rewards</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={registerEmployeeOpen} onOpenChange={setRegisterEmployeeOpen}>
              <DialogTrigger asChild>
                <Button variant="glass">
                  <UserPlus className="h-4 w-4" /> Register staff
                </Button>
              </DialogTrigger>
              <RegisterEmployeeDialog onDone={() => { setRegisterEmployeeOpen(false); load(); }} />
            </Dialog>
            <Button variant="glass" onClick={() => setShowProducts(!showProducts)}>
              <ShoppingBag className="h-4 w-4" /> Products ({orders.length})
            </Button>
            <Select onValueChange={makeEmployee}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Add employee" /></SelectTrigger>
              <SelectContent>{profiles.filter((profile) => !employees.some((employee) => employee.id === profile.id)).map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || profile.email || "Unnamed account"}</SelectItem>)}</SelectContent>
            </Select>
            <Select onValueChange={makeAdmin}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Grant admin" /></SelectTrigger>
              <SelectContent>{profiles.filter((profile) => !admins.some((admin) => admin.id === profile.id)).map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || profile.email || "Unnamed account"}</SelectItem>)}</SelectContent>
            </Select>
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
                    {busy ? `Reserved Â· ${booking?.status.replace("_", " ")}` : "Available"}
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

        <div className="mb-8 rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Staff roster</h2>
            <Badge variant="outline">{employees.length} signed up</Badge>
          </div>

          {employees.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No staff have signed up yet.
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map((employee) => (
                <div key={employee.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold">{employee.full_name || employee.email || "Unnamed staff member"}</div>
                    <div className="text-sm text-muted-foreground">
                      {employee.email} · {employee.phone || "No phone provided"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      ID: {employee.id_number || "Not supplied"} · Current bay: {employeeSlots[employee.id] ? `#${employeeSlots[employee.id]}` : "Unassigned"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={slotDrafts[employee.id] ?? (employeeSlots[employee.id] ? String(employeeSlots[employee.id]) : "")} onValueChange={(value) => setSlotDrafts((prev) => ({ ...prev, [employee.id]: value }))}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Choose slot" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((slot) => (
                          <SelectItem key={slot} value={String(slot)}>Bay #{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="hero" size="sm" onClick={() => assignPermanentEmployeeSlot(employee.id)}>
                      <UserPlus className="h-4 w-4" /> Assign permanent slot
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Products Section */}
        {showProducts && (
          <div className="mb-8">
            <h2 className="mb-4 font-display text-xl font-semibold">Product Orders</h2>
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                No product orders yet.
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-2xl border border-border bg-gradient-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold">{order.profile?.full_name || "Customer"}</span>
                          <Badge variant="outline">{order.profile?.email}</Badge>
                          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">{order.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Order total: <span className="font-semibold">R {Number(order.total_amount).toFixed(2)}</span>
                        </p>
                        <div className="mt-3 space-y-1">
                          {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                            <p key={idx} className="text-sm text-muted-foreground">
                              â€¢ {item.name} (Qty: {item.quantity}) - R {Number(item.price).toFixed(2)}
                            </p>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                          {b.car_make} {b.car_model} Â· <span className="font-mono">{b.car_plate}</span> Â· {b.profile?.phone}
                        </p>
                        <p className="mt-1 text-sm">Slot #{b.slot_number ?? "N/A"} Â· R {Number(b.amount).toFixed(2)} Â· {b.payment_status}</p>
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
                      {b.status !== "completed" && b.status !== "cancelled" && (
                        <Select onValueChange={(employeeId) => assignEmployee(b, employeeId)} disabled={employees.length === 0}>
                          <SelectTrigger className="w-44"><SelectValue placeholder={employees.length ? "Assign employee" : "No employees"} /></SelectTrigger>
                          <SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.full_name || employee.email || "Unnamed employee"}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v as BookingStatus)}>
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
  const [title, setTitle] = useState("It's time! ðŸš—");
  const [message, setMessage] = useState(`Hi ${booking.profile?.full_name?.split(" ")[0] || ""}, please bring your ${booking.car_make} ${booking.car_model} now â€” your wash bay is ready.`);
  const [notifyVia, setNotifyVia] = useState<"app" | "email" | "sms">("app");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      if (notifyVia === "app") {
        const { error } = await supabase.from("notifications").insert({
          user_id: booking.user_id,
          title,
          message,
          type: "alert",
        });
        if (error) throw error;
        toast.success("In-app notification sent!");
      } else if (notifyVia === "email") {
        // Store in sent_notifications with email channel
        await supabase.from("sent_notifications").insert({
          user_id: booking.user_id,
          type: "customer_alert",
          channel: "email",
          title,
          message,
          booking_id: booking.id,
        });
        
        // In a real implementation, you'd call a backend function to send email
        // For now, we'll just track it and show success
        toast.success(`Email queued for ${booking.profile?.email}`);
      } else if (notifyVia === "sms") {
        // Store in sent_notifications with sms channel
        await supabase.from("sent_notifications").insert({
          user_id: booking.user_id,
          type: "customer_alert",
          channel: "sms",
          title,
          message,
          booking_id: booking.id,
        });
        
        toast.success(`SMS queued for ${booking.profile?.phone}`);
      }
      
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send notification");
    } finally {
      setLoading(false);
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
            <Label>Notify via</Label>
            <Select value={notifyVia} onValueChange={(v: any) => setNotifyVia(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="app">ðŸ“± In-app notification</SelectItem>
                <SelectItem value="email">ðŸ“§ Email to {booking.profile?.email}</SelectItem>
                <SelectItem value="sms">ðŸ’¬ SMS to {booking.profile?.phone}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        title: "ðŸŽ Free wash granted!",
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

const RegisterEmployeeDialog = ({ onDone }: { onDone: () => void }) => {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async () => {
    if (!firstName || !surname || !email || !phone || !idNumber) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      // `functions.invoke` includes the current Supabase session's bearer token.
      // A raw fetch to this endpoint is rejected by the Edge Function gateway.
      const { data: result, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email, firstName, surname, phone, idNumber },
      });
      if (error) throw error;
      if (!result?.userId) throw new Error(result?.error || "Server failed to create user");
      if (result.assigned_slot) {
        toast.success(`Employee registered! Assigned to Wash Bay #${result.assigned_slot}`);
      } else {
        toast.warning("Employee registered but no available slots");
      }

      setFirstName("");
      setSurname("");
      setEmail("");
      setPhone("");
      setIdNumber("");
      onDone();
    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="font-display">Register new staff member</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First name</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
          </div>
          <div>
            <Label>Surname</Label>
            <Input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Doe" />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27..." />
        </div>
        <div>
          <Label>ID Number</Label>
          <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="0000000000000" />
        </div>
        <Button variant="hero" className="w-full" onClick={register} disabled={loading}>
          <UserPlus className="h-4 w-4" /> Register staff
        </Button>
      </div>
    </DialogContent>
  );
};

export default Admin;
