import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/app/Navbar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { getPackage } from "@/lib/packages";
import { products as productCatalog } from "@/lib/products";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { edgeFunctionError } from "@/lib/edgeFunctionError";
import { ID_NUMBER_LENGTH, idNumberError, normalizeIdNumber } from "@/lib/idNumber";
import { showFieldError } from "@/lib/fieldError";
import {
  ArrowDown, ArrowUp, Bell, Car, CheckCircle2, Gift, ListOrdered, Play, Send, Shield, Users, LucideIcon, UserPlus, ShoppingBag, TriangleAlert, PackageCheck, CalendarOff, RotateCcw, MessageSquareWarning, Loader2
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

interface ProductStock {
  id: string;
  stock_quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

type StaffLeave = Database['public']['Tables']['staff_leave']['Row'];
type SystemReport = Database['public']['Tables']['system_reports']['Row'];
type ReportSeverity = Database['public']['Enums']['system_report_severity'];
type LeaveRequest = Database['public']['Tables']['staff_leave_requests']['Row'];

const openLeaveDocument = async (path: string) => {
  const { data, error } = await supabase.storage.from("leave-documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { toast.error("Could not open that document."); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

const severityColors: Record<ReportSeverity, string> = {
  low: "border-muted-foreground/30 bg-muted text-muted-foreground",
  medium: "border-warning/30 bg-warning/10 text-warning",
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  critical: "border-destructive/50 bg-destructive/20 text-destructive",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/30",
  confirmed: "bg-primary/20 text-primary border-primary/30",
  in_queue: "bg-accent/20 text-accent border-accent/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-success/20 text-success border-success/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

type AdminView = "overview" | "employees" | "orders" | "employee-slots" | "bookings" | "business-report";

const viewTitles: Record<AdminView, string> = {
  overview: "Admin console",
  employees: "Employees",
  orders: "Customer orders",
  "employee-slots": "Employee slots",
  bookings: "Bookings",
  "business-report": "Business report",
};

const Admin = ({ view = "overview" }: { view?: AdminView }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingScreen, setLoadingScreen] = useState(true);
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"queue" | "all" | "completed">("queue");
  const [notifyOpen, setNotifyOpen] = useState<Booking | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [registerEmployeeOpen, setRegisterEmployeeOpen] = useState(false);
  const [employeeSlots, setEmployeeSlots] = useState<Record<string, number>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [productStock, setProductStock] = useState<Record<string, ProductStock>>({});
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [staffLeave, setStaffLeave] = useState<StaffLeave[]>([]);
  const [leaveDialogEmployee, setLeaveDialogEmployee] = useState<Profile | null>(null);
  const [systemReports, setSystemReports] = useState<SystemReport[]>([]);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [sickNotes, setSickNotes] = useState<StaffLeave[]>([]);
  const [approveDialogRequest, setApproveDialogRequest] = useState<LeaveRequest | null>(null);
  const [declineDialogRequest, setDeclineDialogRequest] = useState<LeaveRequest | null>(null);

  const load = useCallback(async () => {
    const [{ data: b }, { data: p }, { data: roleRows }, { data: o }, { data: slots }, { data: stock }, { data: leave }, { data: reports }, { data: requests }, { data: notes }] = await Promise.all([
      supabase.from("bookings").select("*").order("scheduled_at", { ascending: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_slots").select("employee_id, slot_number"),
      supabase.from("products").select("*"),
      supabase.from("staff_leave").select("*").is("ended_at", null).order("started_at", { ascending: false }),
      supabase.from("system_reports").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("staff_leave_requests").select("*").eq("status", "pending").order("requested_at", { ascending: false }),
      supabase.from("staff_leave").select("*").eq("sick_note_required", true).order("ended_at", { ascending: false }).limit(30),
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

    setProductStock(Object.fromEntries((stock || []).map((row: ProductStock) => [row.id, row])));
    setStockDrafts((current) => {
      const next = { ...current };
      for (const row of (stock || []) as ProductStock[]) {
        next[row.id] = String(row.stock_quantity);
      }
      return next;
    });

    setStaffLeave(leave || []);
    setSystemReports(reports || []);
    setLeaveRequests(requests || []);
    setSickNotes(notes || []);

    setLoadingScreen(false);
  }, []);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("admin-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_leave" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_reports" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_leave_requests" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const notification = payload.new as Database["public"]["Tables"]["notifications"]["Row"];
        toast.success(notification.title, { description: notification.message });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, user]);

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

  // Money made from products sold in the store (paid orders), broken down by period.
  const paidOrders = orders.filter((o) => o.status === "paid");
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const ordersToday = paidOrders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString());
  const ordersThisWeek = paidOrders.filter((o) => new Date(o.created_at) >= startOfWeek);
  const ordersThisMonth = paidOrders.filter(
    (o) => new Date(o.created_at).getMonth() === new Date().getMonth() && new Date(o.created_at).getFullYear() === new Date().getFullYear()
  );
  const ordersThisYear = paidOrders.filter((o) => new Date(o.created_at).getFullYear() === new Date().getFullYear());
  const productRevenueFor = (list: Order[]) => list.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
  const formatCurrency = (value: number) => `R ${value.toFixed(2)}`;

  const stockRows = productCatalog.map((product) => ({
    product,
    stock: productStock[product.id]?.stock_quantity ?? 0,
    threshold: productStock[product.id]?.low_stock_threshold ?? 5,
  }));
  const lowStockRows = stockRows.filter((row) => row.stock <= row.threshold);

  const visible = filter === "queue" ? queueBookings : filter === "completed" ? completedBookings : bookings;

  const restockProduct = async (productId: string) => {
    const rawValue = stockDrafts[productId];
    const nextStock = Number(rawValue);
    if (!rawValue || Number.isNaN(nextStock) || !Number.isInteger(nextStock) || nextStock < 0 || nextStock > 100000) {
      toast.error("Enter a whole number between 0 and 100,000.");
      return;
    }
    const { error } = await supabase
      .from("products")
      .upsert({ id: productId, stock_quantity: nextStock, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) toast.error(error.message);
    else { toast.success("Stock updated."); load(); }
  };

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

    const { error } = await supabase.rpc("admin_assign_employee", { _booking_id: booking.id, _employee_id: employeeId });
    if (error) { toast.error(error.message); return; }
    toast.success("Employee assigned.");
    load();
  };

  // An employee can physically cover only one bay at a time: no permanent bay
  // of their own, not on leave themselves, and not already covering someone else.
  const onLeaveEmployeeIds = new Set(staffLeave.map((l) => l.employee_id));
  const coveringEmployeeIds = new Set(staffLeave.map((l) => l.covering_employee_id).filter((id): id is string => Boolean(id)));
  const availableForCover = employees.filter(
    (e) => !employeeSlots[e.id] && !onLeaveEmployeeIds.has(e.id) && !coveringEmployeeIds.has(e.id)
  );

  const startLeave = async (employeeId: string, reason: string, coveringEmployeeId: string | null) => {
    const { error } = await supabase.rpc("start_staff_leave", {
      _employee_id: employeeId,
      _reason: reason,
      _covering_employee_id: coveringEmployeeId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(coveringEmployeeId ? "Leave started — bay handed to the covering staff member." : "Leave started. Assign a cover when someone is available.");
    setLeaveDialogEmployee(null);
    load();
  };

  const assignCover = async (leaveId: string, coveringEmployeeId: string) => {
    const { error } = await supabase.rpc("assign_leave_cover", { _leave_id: leaveId, _covering_employee_id: coveringEmployeeId });
    if (error) { toast.error(error.message); return; }
    toast.success("Cover assigned.");
    load();
  };

  const endLeave = async (leaveId: string) => {
    const { error } = await supabase.rpc("end_staff_leave", { _leave_id: leaveId });
    if (error) { toast.error(error.message); return; }
    toast.success("Leave ended — bay handed back.");
    load();
  };

  const reportSystemIssue = async (title: string, description: string, severity: ReportSeverity) => {
    const { error } = await supabase.rpc("report_system_issue", { _title: title, _description: description, _severity: severity });
    if (error) { toast.error(error.message); return; }
    toast.success("Reported to the System Administrator.");
    setReportIssueOpen(false);
    load();
    // Email is a bonus channel on top of the in-app report above, which has
    // already succeeded — a failure here shouldn't look like the report failed.
    const { error: emailError } = await supabase.functions.invoke("send-admin-alert", {
      body: { subject: title, message: description, severity },
    });
    if (emailError) console.error("Could not email the system administrator:", emailError.message);
  };

  const resolveSystemReport = async (reportId: string) => {
    const { error } = await supabase.rpc("resolve_system_report", { _report_id: reportId });
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as resolved.");
    load();
  };

  const approveLeaveRequest = async (requestId: string, coveringEmployeeId: string | null) => {
    const { error } = await supabase.rpc("approve_staff_leave_request", { _request_id: requestId, _covering_employee_id: coveringEmployeeId });
    if (error) { toast.error(error.message); return; }
    toast.success(coveringEmployeeId ? "Leave approved — bay handed to the covering staff member." : "Leave approved. Assign a cover when someone is available.");
    setApproveDialogRequest(null);
    load();
  };

  const declineLeaveRequest = async (requestId: string, reason: string) => {
    const { error } = await supabase.rpc("decline_staff_leave_request", { _request_id: requestId, _decision_notes: reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Leave request declined.");
    setDeclineDialogRequest(null);
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
      <AppSidebar />
      <main className="relative mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 md:pb-12 lg:ml-64 lg:max-w-none lg:px-8 lg:pt-12">
        {loadingScreen && <p role="status" aria-live="polite" className="mb-4 text-sm text-muted-foreground">Loading {viewTitles[view].toLowerCase()}...</p>}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold md:text-4xl">
              <Shield className="h-8 w-8 text-primary" /> {viewTitles[view]}
            </h1>
            <p className="text-muted-foreground">Manage bookings, queue & rewards</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setReportIssueOpen(true)}>
              <MessageSquareWarning className="h-4 w-4" /> Report a system problem
            </Button>
            {view === "employees" && <>
            <Dialog open={registerEmployeeOpen} onOpenChange={setRegisterEmployeeOpen}>
              <DialogTrigger asChild>
                <Button variant="glass">
                  <UserPlus className="h-4 w-4" /> Invite staff
                </Button>
              </DialogTrigger>
              <RegisterEmployeeDialog onDone={() => { setRegisterEmployeeOpen(false); load(); }} />
            </Dialog>
            <Select onValueChange={makeEmployee}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Add employee" /></SelectTrigger>
              <SelectContent>{profiles.filter((profile) => !employees.some((employee) => employee.id === profile.id)).map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || profile.email || "Unnamed account"}</SelectItem>)}</SelectContent>
            </Select>
            </>}
            {view === "overview" && (
            <Select onValueChange={makeAdmin}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Grant admin" /></SelectTrigger>
              <SelectContent>{profiles.filter((profile) => !admins.some((admin) => admin.id === profile.id)).map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.full_name || profile.email || "Unnamed account"}</SelectItem>)}</SelectContent>
            </Select>
            )}
            {view === "bookings" && <>
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
            </>}
          </div>
        </div>

        {/* Stats */}
        {view === "employee-slots" && <section className="mb-8">
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
        </section>}

        {view === "employees" && <section className="mb-8 rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
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
              {employees.map((employee) => {
                const onLeave = staffLeave.find((l) => l.employee_id === employee.id);
                const covering = staffLeave.find((l) => l.covering_employee_id === employee.id);
                return (
                <div key={employee.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-display text-lg font-semibold">{employee.full_name || employee.email || "Unnamed staff member"}</div>
                      {onLeave && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">On leave</Badge>}
                      {covering && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Covering Bay #{covering.slot_number}</Badge>}
                    </div>
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
                    {employeeSlots[employee.id] && !onLeave && (
                      <Button variant="outline" size="sm" onClick={() => setLeaveDialogEmployee(employee)}>
                        <CalendarOff className="h-4 w-4" /> Put on leave
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>}

        {view === "employees" && leaveRequests.length > 0 && <section className="mb-8 rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><CalendarOff className="h-5 w-5 text-primary" /> Leave requests</h2>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{leaveRequests.length} pending</Badge>
          </div>
          <div className="space-y-3">
            {leaveRequests.map((request) => {
              const employee = profiles.find((p) => p.id === request.employee_id);
              return (
                <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
                  <HoverCard openDelay={150} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div className="cursor-default">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-display text-lg font-semibold">{employee?.full_name || employee?.email || "Unknown staff member"}</div>
                          <Badge variant="outline" className="capitalize">{request.leave_type}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()} ({request.days_count} day{request.days_count === 1 ? "" : "s"}) · Requested {new Date(request.requested_at).toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs font-medium text-primary underline decoration-dotted">Hover to view the full request</div>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="start" className="w-80">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-display font-semibold">{employee?.full_name || employee?.email || "Unknown staff member"}</div>
                        <Badge variant="outline" className="capitalize">{request.leave_type} leave</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()} · {request.days_count} day{request.days_count === 1 ? "" : "s"}
                      </div>
                      <p className="mt-3 text-sm">"{request.reason}"</p>
                      {request.attachment_path ? (
                        <button
                          type="button"
                          className="mt-3 text-xs font-medium text-primary underline"
                          onClick={() => openLeaveDocument(request.attachment_path!)}
                        >
                          View attached document
                        </button>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">No document attached.</p>
                      )}
                    </HoverCardContent>
                  </HoverCard>
                  <div className="flex gap-2">
                    <Button variant="hero" size="sm" onClick={() => setApproveDialogRequest(request)}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeclineDialogRequest(request)}>
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {view === "employees" && staffLeave.length > 0 && <section className="mb-8 rounded-2xl border border-warning/30 bg-warning/5 p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><CalendarOff className="h-5 w-5 text-warning" /> Staff on leave</h2>
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">{staffLeave.length} active</Badge>
          </div>
          <div className="space-y-3">
            {staffLeave.map((leave) => {
              const employee = profiles.find((p) => p.id === leave.employee_id);
              const cover = leave.covering_employee_id ? profiles.find((p) => p.id === leave.covering_employee_id) : null;
              return (
                <div key={leave.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold">{employee?.full_name || employee?.email || "Unknown staff member"}</div>
                    <div className="text-sm text-muted-foreground">Wash Bay #{leave.slot_number} · on leave since {new Date(leave.started_at).toLocaleDateString()}{leave.reason ? ` · ${leave.reason}` : ""}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {cover ? `Covered by ${cover.full_name || cover.email}` : "No one covering yet — bay is unstaffed"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {!leave.covering_employee_id && (
                      <Select onValueChange={(employeeId) => assignCover(leave.id, employeeId)} disabled={availableForCover.length === 0}>
                        <SelectTrigger className="w-48"><SelectValue placeholder={availableForCover.length === 0 ? "No staff available" : "Assign a cover"} /></SelectTrigger>
                        <SelectContent>
                          {availableForCover.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name || e.email || "Unnamed staff member"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="hero" size="sm" onClick={() => endLeave(leave.id)}>
                      <RotateCcw className="h-4 w-4" /> End leave & restore bay
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {view === "employees" && sickNotes.length > 0 && <section className="mb-8 rounded-2xl border border-border bg-gradient-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><TriangleAlert className="h-5 w-5 text-destructive" /> Sick notes</h2>
            {sickNotes.some((n) => !n.sick_note_path) && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                {sickNotes.filter((n) => !n.sick_note_path).length} outstanding
              </Badge>
            )}
          </div>
          <div className="space-y-3">
            {sickNotes.map((note) => {
              const employee = profiles.find((p) => p.id === note.employee_id);
              return (
                <div key={note.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold">{employee?.full_name || employee?.email || "Unknown staff member"}</div>
                    <div className="text-sm text-muted-foreground">
                      Leave {note.start_date && new Date(note.start_date).toLocaleDateString()} – {note.end_date && new Date(note.end_date).toLocaleDateString()}, ended {note.ended_at && new Date(note.ended_at).toLocaleDateString()}
                    </div>
                  </div>
                  {note.sick_note_path ? (
                    <button type="button" className="text-sm font-medium text-primary underline" onClick={() => openLeaveDocument(note.sick_note_path!)}>
                      View sick note
                    </button>
                  ) : (
                    <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Not submitted yet</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </section>}

        {leaveDialogEmployee && (
          <StaffLeaveDialog
            employee={leaveDialogEmployee}
            slotNumber={employeeSlots[leaveDialogEmployee.id]}
            availableForCover={availableForCover}
            onClose={() => setLeaveDialogEmployee(null)}
            onSubmit={startLeave}
          />
        )}

        {approveDialogRequest && (
          <ApproveLeaveRequestDialog
            request={approveDialogRequest}
            employee={profiles.find((p) => p.id === approveDialogRequest.employee_id)}
            slotNumber={employeeSlots[approveDialogRequest.employee_id]}
            availableForCover={availableForCover}
            onClose={() => setApproveDialogRequest(null)}
            onApprove={approveLeaveRequest}
          />
        )}

        {declineDialogRequest && (
          <DeclineLeaveRequestDialog
            request={declineDialogRequest}
            employee={profiles.find((p) => p.id === declineDialogRequest.employee_id)}
            onClose={() => setDeclineDialogRequest(null)}
            onDecline={declineLeaveRequest}
          />
        )}

        {reportIssueOpen && (
          <ReportSystemIssueDialog onClose={() => setReportIssueOpen(false)} onSubmit={reportSystemIssue} />
        )}

        {view === "overview" && <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><MessageSquareWarning className="h-5 w-5 text-primary" /> System reports</h2>
            {systemReports.some((r) => r.status === "open") && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                {systemReports.filter((r) => r.status === "open").length} open
              </Badge>
            )}
          </div>
          {systemReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No system problems reported. Use "Report a system problem" above if something is wrong across the app.
            </div>
          ) : (
            <div className="space-y-3">
              {systemReports.map((report) => {
                const reporter = profiles.find((p) => p.id === report.reported_by);
                const resolver = report.resolved_by ? profiles.find((p) => p.id === report.resolved_by) : null;
                return (
                  <div key={report.id} className={`rounded-2xl border p-5 shadow-card ${report.status === "open" ? "border-destructive/30 bg-destructive/5" : "border-border bg-gradient-card"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-semibold">{report.title}</span>
                          <Badge variant="outline" className={severityColors[report.severity]}>{report.severity}</Badge>
                          <Badge variant="outline" className={report.status === "open" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/30 bg-success/10 text-success"}>
                            {report.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Reported by {reporter?.full_name || reporter?.email || "an admin"} · {new Date(report.created_at).toLocaleString()}
                        </p>
                        {report.status === "resolved" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Resolved by {resolver?.full_name || resolver?.email || "an admin"}{report.resolution_notes ? `: ${report.resolution_notes}` : ""}
                          </p>
                        )}
                      </div>
                      {report.status === "open" && (
                        <Button variant="outline" size="sm" onClick={() => resolveSystemReport(report.id)}>
                          <CheckCircle2 className="h-4 w-4" /> Mark resolved
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>}

        {view === "business-report" && <section className="mb-8">
          <h2 className="mb-4 font-display text-xl font-semibold">Business report</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Car} label="Busy slots" value={slotSummaries.filter((slot) => slot.busy).length} />
            <StatCard icon={CheckCircle2} label="Completed today" value={bookings.filter((b) => b.status === "completed" && new Date(b.updated_at).toDateString() === new Date().toDateString()).length} />
            <StatCard icon={Users} label="Total customers" value={profiles.length} />
            <StatCard icon={Bell} label="Total bookings" value={bookings.length} />
            <StatCard icon={ArrowUp} label="Daily Profit" value={formatCurrency(revenueFor(completedToday) - costFor(completedToday))} />
            <StatCard icon={ArrowUp} label="Monthly Profit" value={formatCurrency(revenueFor(completedThisMonth) - costFor(completedThisMonth))} />
            <StatCard icon={ArrowUp} label="Yearly Profit" value={formatCurrency(revenueFor(completedThisYear) - costFor(completedThisYear))} />
            <StatCard icon={ArrowDown} label="Total Expenses" value={formatCurrency(costFor(completedBookings))} />
          </div>

          <h3 className="mb-4 mt-8 font-display text-lg font-semibold">Product sales revenue</h3>
          <p className="-mt-3 mb-4 text-sm text-muted-foreground">Money made from products sold in the store, from paid orders only.</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={ShoppingBag} label="Daily product sales" value={formatCurrency(productRevenueFor(ordersToday))} />
            <StatCard icon={ShoppingBag} label="Weekly product sales" value={formatCurrency(productRevenueFor(ordersThisWeek))} />
            <StatCard icon={ShoppingBag} label="Monthly product sales" value={formatCurrency(productRevenueFor(ordersThisMonth))} />
            <StatCard icon={ShoppingBag} label="Yearly product sales" value={formatCurrency(productRevenueFor(ordersThisYear))} />
          </div>

          <h3 className="mb-4 mt-8 font-display text-lg font-semibold">Stock levels</h3>
          {lowStockRows.length > 0 && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {lowStockRows.length === 1
                  ? `${lowStockRows[0].product.name} is running low on stock (${lowStockRows[0].stock} left).`
                  : `${lowStockRows.length} products are running low on stock: ${lowStockRows.map((row) => `${row.product.name} (${row.stock} left)`).join(", ")}.`}
              </p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stockRows.map(({ product, stock, threshold }) => {
              const low = stock <= threshold;
              return (
                <div key={product.id} className={`rounded-2xl border p-5 shadow-card ${low ? "border-destructive/40 bg-destructive/5" : "border-border bg-gradient-card"}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">{product.name}</div>
                    {low ? <TriangleAlert className="h-5 w-5 text-destructive" /> : <PackageCheck className="h-5 w-5 text-primary" />}
                  </div>
                  <div className={`mt-2 font-display text-3xl font-bold ${low ? "text-destructive" : ""}`}>{stock} left</div>
                  {low && <div className="mt-1 text-xs font-medium text-destructive">Low stock — running out soon</div>}
                  <div className="mt-4 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100000}
                      className="h-9"
                      value={stockDrafts[product.id] ?? String(stock)}
                      onChange={(e) => setStockDrafts((prev) => ({ ...prev, [product.id]: e.target.value }))}
                      aria-label={`Set stock for ${product.name}`}
                    />
                    <Button size="sm" variant="outline" onClick={() => restockProduct(product.id)}>Update</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {/* Product orders */}
        {view === "orders" && <section className="mb-8">
            <h2 className="mb-4 font-display text-xl font-semibold">Customer orders</h2>
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
                              • {item.name} (Quantity: {item.quantity}) - R {Number(item.price).toFixed(2)}
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
        </section>}

        {view === "bookings" && <section>
          {/* Filters */}
          <div role="group" aria-label="Booking filters" className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 p-3">
            <h2 className="mr-2 font-display text-xl font-semibold">Bookings</h2>
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
                          {b.car_make} {b.car_model} · <span>{b.car_plate}</span> · {b.profile?.phone}
                        </p>
                        <p className="mt-1 text-sm">Slot {b.slot_number ? `#${b.slot_number}` : "not assigned"} · R {Number(b.amount).toFixed(2)} · {b.payment_status}</p>
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
        </section>}
      </main>

      {notifyOpen && <NotifyDialog booking={notifyOpen} onClose={() => setNotifyOpen(null)} />}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number | string }) => (
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
                <SelectItem value="app">📱 In-app notification</SelectItem>
                <SelectItem value="email">📧 Email to {booking.profile?.email}</SelectItem>
                <SelectItem value="sms">Text message to {booking.profile?.phone}</SelectItem>
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

const StaffLeaveDialog = ({
  employee, slotNumber, availableForCover, onClose, onSubmit,
}: {
  employee: Profile;
  slotNumber: number | undefined;
  availableForCover: Profile[];
  onClose: () => void;
  onSubmit: (employeeId: string, reason: string, coveringEmployeeId: string | null) => Promise<void>;
}) => {
  const [reason, setReason] = useState("");
  const [coveringEmployeeId, setCoveringEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await onSubmit(employee.id, reason, coveringEmployeeId || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Put {employee.full_name || employee.email} on leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This frees Wash Bay #{slotNumber} from {employee.full_name || "this staff member"}. Pick an available staff member to cover it now, or leave it unassigned and cover it later.
          </p>
          <div>
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Sick leave" />
          </div>
          <div>
            <Label>Cover for Wash Bay #{slotNumber}</Label>
            <Select value={coveringEmployeeId} onValueChange={setCoveringEmployeeId}>
              <SelectTrigger><SelectValue placeholder={availableForCover.length === 0 ? "No staff available right now" : "Choose a staff member (optional)"} /></SelectTrigger>
              <SelectContent>
                {availableForCover.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name || e.email || "Unnamed staff member"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableForCover.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No staff are currently free to cover — you can assign one later from "Staff on leave".</p>
            )}
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={loading}>
            <CalendarOff className="h-4 w-4" /> Start leave
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ApproveLeaveRequestDialog = ({
  request, employee, slotNumber, availableForCover, onClose, onApprove,
}: {
  request: LeaveRequest;
  employee: Profile | undefined;
  slotNumber: number | undefined;
  availableForCover: Profile[];
  onClose: () => void;
  onApprove: (requestId: string, coveringEmployeeId: string | null) => Promise<void>;
}) => {
  const [coveringEmployeeId, setCoveringEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await onApprove(request.id, coveringEmployeeId || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Approve leave for {employee?.full_name || employee?.email || "this staff member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <Badge variant="outline" className="capitalize">{request.leave_type} leave</Badge>
              <span className="text-xs text-muted-foreground">{request.days_count} day{request.days_count === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">"{request.reason}"</p>
            {request.attachment_path ? (
              <button type="button" className="mt-2 text-xs font-medium text-primary underline" onClick={() => openLeaveDocument(request.attachment_path!)}>
                View attached document
              </button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No document attached.</p>
            )}
          </div>
          <div>
            <Label>Cover for Wash Bay #{slotNumber}</Label>
            <Select value={coveringEmployeeId} onValueChange={setCoveringEmployeeId}>
              <SelectTrigger><SelectValue placeholder={availableForCover.length === 0 ? "No staff available right now" : "Choose a staff member (optional)"} /></SelectTrigger>
              <SelectContent>
                {availableForCover.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name || e.email || "Unnamed staff member"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableForCover.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No staff are currently free — you can assign one later from "Staff on leave".</p>
            )}
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={loading}>
            <CheckCircle2 className="h-4 w-4" /> Approve leave
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DeclineLeaveRequestDialog = ({
  request, employee, onClose, onDecline,
}: {
  request: LeaveRequest;
  employee: Profile | undefined;
  onClose: () => void;
  onDecline: (requestId: string, reason: string) => Promise<void>;
}) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("Give a reason for declining this leave request.");
      return;
    }
    setLoading(true);
    try {
      await onDecline(request.id, reason.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Decline leave for {employee?.full_name || employee?.email || "this staff member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            {request.leave_type} leave, {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()} · "{request.reason}"
          </p>
          <div>
            <Label htmlFor="decline-reason">Reason for declining</Label>
            <Textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="e.g. No cover available for those dates — please pick a later week"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">This is sent to {employee?.full_name || "the staff member"} so they know why.</p>
          </div>
          <Button variant="destructive" className="w-full" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Decline leave request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ReportSystemIssueDialog = ({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (title: string, description: string, severity: ReportSeverity) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<ReportSeverity>("medium");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Give the problem a title and a description.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(title, description, severity);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Report a system problem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use this for problems with the app itself — not a single customer or booking — so it reaches the System Administrator.
          </p>
          <div>
            <Label htmlFor="report-title">What's wrong</Label>
            <Input id="report-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Payments are failing for everyone" />
          </div>
          <div>
            <Label htmlFor="report-description">Details</Label>
            <Textarea id="report-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000} placeholder="What did you see, when did it start, does it affect everyone or just some bookings?" />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v: ReportSeverity) => setSeverity(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — minor annoyance</SelectItem>
                <SelectItem value="medium">Medium — affects some people</SelectItem>
                <SelectItem value="high">High — affects most people</SelectItem>
                <SelectItem value="critical">Critical — the system is down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="hero" className="w-full" onClick={submit} disabled={loading}>
            <MessageSquareWarning className="h-4 w-4" /> Send report
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

    const idError = idNumberError(idNumber);
    if (idError) {
      showFieldError(idError, "staff-id-number");
      return;
    }

    setLoading(true);
    try {
      // `functions.invoke` includes the current Supabase session's bearer token.
      // A raw fetch to this endpoint is rejected by the Edge Function gateway.
      const { data: result, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email, firstName, surname, phone,
          idNumber: normalizeIdNumber(idNumber),
          registrationUrl: getAuthRedirectUrl("/staff-register"),
        },
      });
      if (error) throw await edgeFunctionError(error);
      if (!result?.invitationId) throw new Error(result?.error || "Server failed to create invitation");
      toast.success(`Staff invitation sent to ${email}. One-time code: ${result.code}`, { duration: 10000 });

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
        <DialogTitle className="font-display">Invite new staff member</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First name</Label>
            <Input maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
          </div>
          <div>
            <Label>Surname</Label>
            <Input maxLength={80} value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Doe" />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27..." />
        </div>
        <div>
          <Label htmlFor="staff-id-number">Identity number</Label>
          <Input
            id="staff-id-number"
            inputMode="numeric"
            maxLength={ID_NUMBER_LENGTH}
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="0000000000000"
          />
          {idNumber.length === ID_NUMBER_LENGTH && idNumberError(idNumber) && (
            <p className="mt-1 text-sm text-destructive">{idNumberError(idNumber)}</p>
          )}
        </div>
        <Button variant="hero" className="w-full" onClick={register} disabled={loading}>
          <UserPlus className="h-4 w-4" /> Send one-time invitation
        </Button>
      </div>
    </DialogContent>
  );
};

export default Admin;
