import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Car, CheckCircle2, Clock3, Loader2, RotateCcw, ScanLine, ShieldCheck, ThumbsUp, UserRound, Badge as BadgeIcon, Bell, TriangleAlert, CalendarOff, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Navbar } from "@/components/app/Navbar";
import { AppSidebar } from "@/components/app/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPackage } from "@/lib/packages";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Notif = Database["public"]["Tables"]["notifications"]["Row"];
type Assignment = Database["public"]["Tables"]["employee_assignments"]["Row"] & { booking: Booking | null };
type StaffLeave = Database["public"]["Tables"]["staff_leave"]["Row"];
type LeaveRequest = Database["public"]["Tables"]["staff_leave_requests"]["Row"];
type LeaveType = Database["public"]["Enums"]["staff_leave_type"];

const MAX_LEAVE_DOC_BYTES = 8 * 1024 * 1024;
const LEAVE_DOC_ACCEPT = "application/pdf,image/*";

const uploadLeaveDocument = async (userId: string, file: File): Promise<string> => {
  if (file.size > MAX_LEAVE_DOC_BYTES) throw new Error("That file is too large — attach something under 8MB.");
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("leave-documents").upload(path, file);
  if (error) throw error;
  return path;
};

const openLeaveDocument = async (path: string) => {
  const { data, error } = await supabase.storage.from("leave-documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) { toast.error("Could not open that document."); return; }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

const Employee = () => {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [permanentSlot, setPermanentSlot] = useState<number | null>(null);
  const [myLeave, setMyLeave] = useState<(StaffLeave & { otherName?: string }) | null>(null);
  const [myLeaveRequest, setMyLeaveRequest] = useState<LeaveRequest | null>(null);
  const [leaveRequestOpen, setLeaveRequestOpen] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null);
  const [requestingLeave, setRequestingLeave] = useState(false);
  const [sickNotesOwed, setSickNotesOwed] = useState<StaffLeave[]>([]);
  const [sickNoteFiles, setSickNoteFiles] = useState<Record<string, File | null>>({});
  const [submittingSickNote, setSubmittingSickNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [vehicleVerified, setVehicleVerified] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [mismatchDetected, setMismatchDetected] = useState(false);
  const [mismatchPlateGuess, setMismatchPlateGuess] = useState("");
  const [reporting, setReporting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const booking = assignment?.booking;
  const isVehicleVerified = vehicleVerified || Boolean(assignment?.plate_verified_at);

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

  const loadNotifs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) console.error("Could not load notifications:", error);
    else setNotifs(data ?? []);
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    void loadNotifs();
  };

  const loadMyLeave = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("staff_leave")
      .select("*")
      .or(`employee_id.eq.${user.id},covering_employee_id.eq.${user.id}`)
      .is("ended_at", null)
      .maybeSingle();
    if (error) { console.error("Could not load leave status:", error); return; }
    if (!data) { setMyLeave(null); return; }
    const otherId = data.employee_id === user.id ? data.covering_employee_id : data.employee_id;
    let otherName: string | undefined;
    if (otherId) {
      const { data: otherProfile } = await supabase.from("profiles").select("full_name, email").eq("id", otherId).maybeSingle();
      otherName = otherProfile?.full_name || otherProfile?.email || undefined;
    }
    setMyLeave({ ...data, otherName });
  }, [user]);

  const loadMyLeaveRequest = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("staff_leave_requests")
      .select("*")
      .eq("employee_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) { console.error("Could not load leave request:", error); return; }
    setMyLeaveRequest(data?.status === "pending" ? data : null);
  }, [user]);

  const loadSickNotesOwed = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("staff_leave")
      .select("*")
      .eq("employee_id", user.id)
      .eq("sick_note_required", true)
      .is("sick_note_path", null);
    if (error) { console.error("Could not load sick note status:", error); return; }
    setSickNotesOwed(data ?? []);
  }, [user]);

  const leaveDaysCount = leaveStartDate && leaveEndDate && leaveEndDate >= leaveStartDate
    ? Math.round((new Date(leaveEndDate).getTime() - new Date(leaveStartDate).getTime()) / 86400000) + 1
    : null;

  const submitLeaveRequest = async () => {
    if (!leaveReason.trim()) { toast.error("Tell your admin why you need leave."); return; }
    if (!leaveStartDate || !leaveEndDate) { toast.error("Choose a start and end date."); return; }
    if (leaveEndDate < leaveStartDate) { toast.error("The end date cannot be before the start date."); return; }
    setRequestingLeave(true);
    try {
      const attachmentPath = leaveAttachment ? await uploadLeaveDocument(user!.id, leaveAttachment) : null;
      const { error } = await supabase.rpc("request_staff_leave", {
        _reason: leaveReason.trim(),
        _leave_type: leaveType,
        _start_date: leaveStartDate,
        _end_date: leaveEndDate,
        _attachment_path: attachmentPath,
      });
      if (error) throw error;
      toast.success("Leave request sent to your admin.");
      setLeaveRequestOpen(false);
      setLeaveReason("");
      setLeaveStartDate("");
      setLeaveEndDate("");
      setLeaveAttachment(null);
      setLeaveType("annual");
      void loadMyLeaveRequest();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your leave request.");
    } finally {
      setRequestingLeave(false);
    }
  };

  const submitSickNote = async (leaveId: string) => {
    const file = sickNoteFiles[leaveId];
    if (!file) { toast.error("Attach your sick note first."); return; }
    setSubmittingSickNote(leaveId);
    try {
      const path = await uploadLeaveDocument(user!.id, file);
      const { error } = await supabase.rpc("submit_sick_note", { _leave_id: leaveId, _file_path: path });
      if (error) throw error;
      toast.success("Sick note submitted.");
      setSickNoteFiles((prev) => ({ ...prev, [leaveId]: null }));
      void loadSickNotesOwed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your sick note.");
    } finally {
      setSubmittingSickNote(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadSlot();
    void load();
    void loadNotifs();
    void loadMyLeave();
    void loadMyLeaveRequest();
    void loadSickNotesOwed();
    const channel = supabase.channel("employee-work")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_assignments", filter: `employee_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_leave" }, () => { void loadSlot(); void loadMyLeave(); void loadSickNotesOwed(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_leave_requests", filter: `employee_id=eq.${user.id}` }, loadMyLeaveRequest)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const notification = payload.new as Notif;
        toast.success(notification.title, { description: notification.message });
        void loadNotifs();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, loadSlot, loadNotifs, loadMyLeave, loadMyLeaveRequest, loadSickNotesOwed, user]);

  useEffect(() => {
    setVehiclePhoto((currentPhoto) => {
      if (currentPhoto) URL.revokeObjectURL(currentPhoto);
      return null;
    });
    setVehicleVerified(false);
    setScanMessage(null);
    setMismatchDetected(false);
    setMismatchPlateGuess("");
  }, [booking?.id]);

  useEffect(() => () => {
    if (vehiclePhoto) URL.revokeObjectURL(vehiclePhoto);
  }, [vehiclePhoto]);

  const captureVehicle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0];
    if (!photo) return;
    setVehiclePhoto((currentPhoto) => {
      if (currentPhoto) URL.revokeObjectURL(currentPhoto);
      return URL.createObjectURL(photo);
    });
    setVehicleVerified(false);
    setScanMessage(null);
    setMismatchDetected(false);
    setMismatchPlateGuess("");
    event.target.value = "";
    if (!assignment) return;

    setScanning(true);
    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(photo, "eng");
      const expectedPlate = booking?.car_plate.replace(/[^a-z0-9]/gi, "").toUpperCase() ?? "";
      const scannedLines = result.data.text
        .split(/\r?\n/)
        .map((line) => line.replace(/[^a-z0-9]/gi, "").toUpperCase())
        .filter(Boolean);
      const scannedPlate = scannedLines.find((line) => line === expectedPlate);

      if (!scannedPlate) {
        setMismatchDetected(true);
        setMismatchPlateGuess(scannedLines[0] ?? "");
        setScanMessage(`The scanned plate does not match ${booking?.car_plate}. Do not start the wash.`);
        toast.error("Wrong vehicle or plate not clearly visible", { description: `Expected registration: ${booking?.car_plate}` });
        return;
      }

      const { error } = await supabase.rpc("verify_employee_vehicle", {
        _assignment_id: assignment.id,
        _scanned_plate: scannedPlate,
      });
      if (error) throw error;
      setVehicleVerified(true);
      setScanMessage(`Correct vehicle verified: ${booking?.car_plate}. The admin has been notified.`);
      toast.success("Correct vehicle verified", { description: "The administrator has been notified automatically." });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The number plate could not be scanned.";
      setScanMessage("The plate could not be read. Retake a clear, close photo of the registration plate.");
      toast.error("Plate scan failed", { description: message });
    } finally {
      setScanning(false);
    }
  };

  const reportMismatch = async () => {
    if (!assignment) return;
    setReporting(true);
    const { error } = await supabase.rpc("report_vehicle_mismatch", {
      _assignment_id: assignment.id,
      _scanned_plate: mismatchPlateGuess,
    });
    setReporting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reported to admin", { description: "The booking was returned to the queue. Your bay is free for the next car." });
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
    toast.success("Booking accepted. The customer has been notified to bring their vehicle.");
    await load();
  };

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={assignment ? "border-warning/30 bg-warning/10 px-3 py-1 text-warning" : "border-success/30 bg-success/10 px-3 py-1 text-success"}>
              {assignment ? "Busy – wash in progress" : "Available for assignment"}
            </Badge>
            {myLeave?.employee_id !== user?.id && !myLeaveRequest && sickNotesOwed.length === 0 && (
              <Dialog open={leaveRequestOpen} onOpenChange={setLeaveRequestOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarOff className="h-4 w-4" /> Apply for leave
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Apply for leave</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Your admin will review this and, if approved, hand your bay to a colleague while you're away.</p>
                    <div>
                      <Label>Leave type</Label>
                      <Select value={leaveType} onValueChange={(v: LeaveType) => setLeaveType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sick">Sick leave</SelectItem>
                          <SelectItem value="annual">Annual leave</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="leave-start">Start date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button id="leave-start" type="button" variant="outline" className="w-full justify-start font-normal">
                              <CalendarIcon className="h-4 w-4" />
                              {leaveStartDate ? format(new Date(`${leaveStartDate}T00:00:00`), "d MMM yyyy") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={leaveStartDate ? new Date(`${leaveStartDate}T00:00:00`) : undefined}
                              onSelect={(date) => {
                                if (!date) return;
                                const iso = format(date, "yyyy-MM-dd");
                                setLeaveStartDate(iso);
                                if (leaveEndDate && leaveEndDate < iso) setLeaveEndDate("");
                              }}
                              disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="leave-end">End date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button id="leave-end" type="button" variant="outline" className="w-full justify-start font-normal" disabled={!leaveStartDate}>
                              <CalendarIcon className="h-4 w-4" />
                              {leaveEndDate ? format(new Date(`${leaveEndDate}T00:00:00`), "d MMM yyyy") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={leaveEndDate ? new Date(`${leaveEndDate}T00:00:00`) : undefined}
                              onSelect={(date) => date && setLeaveEndDate(format(date, "yyyy-MM-dd"))}
                              disabled={{ before: leaveStartDate ? new Date(`${leaveStartDate}T00:00:00`) : new Date(new Date().setHours(0, 0, 0, 0)) }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div>
                      <Label>Number of days</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                        {leaveDaysCount !== null ? `${leaveDaysCount} day${leaveDaysCount === 1 ? "" : "s"}` : "Select both dates"}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="leave-reason">Reason</Label>
                      <Textarea id="leave-reason" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Feeling unwell, need to rest" />
                    </div>
                    <div>
                      <Label htmlFor="leave-attachment">Supporting document (optional)</Label>
                      <Input id="leave-attachment" type="file" accept={LEAVE_DOC_ACCEPT} onChange={(e) => setLeaveAttachment(e.target.files?.[0] ?? null)} />
                      <p className="mt-1 text-xs text-muted-foreground">PDF or photo, up to 8MB — e.g. a doctor's note if you already have one.</p>
                    </div>
                    <Button variant="hero" className="w-full" onClick={submitLeaveRequest} disabled={requestingLeave}>
                      {requestingLeave ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarOff className="h-4 w-4" />} Send request
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {myLeaveRequest && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 md:p-6">
            <p className="text-sm font-medium text-primary">Leave request pending</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {myLeaveRequest.leave_type} leave, {new Date(myLeaveRequest.start_date).toLocaleDateString()} – {new Date(myLeaveRequest.end_date).toLocaleDateString()}
              {" "}({myLeaveRequest.days_count} day{myLeaveRequest.days_count === 1 ? "" : "s"}) · Waiting for your admin to review: "{myLeaveRequest.reason}"
            </p>
            {myLeaveRequest.attachment_path && (
              <button type="button" className="mt-2 text-xs font-medium text-primary underline" onClick={() => openLeaveDocument(myLeaveRequest.attachment_path!)}>
                View attached document
              </button>
            )}
          </div>
        )}

        {sickNotesOwed.map((leave) => (
          <div key={leave.id} className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 md:p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive"><TriangleAlert className="h-4 w-4" /> Sick note required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please submit your sick note for your leave from {leave.start_date && new Date(leave.start_date).toLocaleDateString()} to {leave.end_date && new Date(leave.end_date).toLocaleDateString()} before applying for more leave.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="file"
                accept={LEAVE_DOC_ACCEPT}
                onChange={(e) => setSickNoteFiles((prev) => ({ ...prev, [leave.id]: e.target.files?.[0] ?? null }))}
              />
              <Button variant="hero" size="sm" onClick={() => submitSickNote(leave.id)} disabled={submittingSickNote === leave.id}>
                {submittingSickNote === leave.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Submit sick note
              </Button>
            </div>
          </div>
        ))}

        {myLeave?.employee_id === user?.id && (
          <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 p-4 md:p-6">
            <p className="text-sm font-medium text-warning">You are marked on leave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {myLeave.otherName ? `${myLeave.otherName} is covering Wash Bay #${myLeave.slot_number} while you're away.` : `Wash Bay #${myLeave.slot_number} has no cover yet.`} Your supervisor will restore your bay when you're back.
            </p>
          </div>
        )}

        {permanentSlot && (
          <div className="mb-6 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <BadgeIcon className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">Your permanent station</p>
                <p className="font-display text-2xl font-bold text-primary">Wash bay #{permanentSlot}</p>
                {myLeave?.covering_employee_id === user?.id && (
                  <p className="mt-1 text-xs text-muted-foreground">Covering for {myLeave.otherName || "a colleague"} while they're on leave.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div role="status" aria-live="polite" className="grid min-h-64 place-items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" />Loading your assignment...</div>
        ) : booking ? (
          <section className="max-w-3xl rounded-3xl border border-primary/30 bg-gradient-card p-6 shadow-card md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Assigned vehicle</p>
                <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold"><Car className="h-7 w-7 text-primary" /> {booking.car_make} {booking.car_model}</h2>
                <p className="mt-2 text-lg text-muted-foreground">{booking.car_plate}</p>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">{getPackage(booking.package).name}</Badge>
            </div>
            <div className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-2">
              <div><p className="text-sm text-muted-foreground">Wash bay</p><p className="mt-1 font-display text-xl font-semibold">Slot #{booking.slot_number ?? "�"}</p></div>
              <div><p className="text-sm text-muted-foreground">Customer notes</p><p className="mt-1 font-medium">{booking.notes || "No special instructions"}</p></div>
            </div>
            {!assignment.accepted_at ? (
              <div className="mt-6">
                <Button className="w-full sm:w-auto" variant="hero" size="lg" onClick={acceptBooking} disabled={accepting}>
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Accept booking & notify customer
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">Accept the booking before scanning the arriving vehicle.</p>
              </div>
            ) : <div className="mt-6 rounded-2xl border border-primary/25 bg-background/50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="font-display text-lg font-semibold">Verify the vehicle before washing</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Take a close, clear photo of the registration plate. It will be scanned and checked automatically against <span className="font-semibold text-foreground">{booking.car_plate}</span>.</p>
                </div>
              </div>

              <input
                ref={cameraInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={captureVehicle}
                aria-label="Take a photo of the assigned vehicle"
              />

              {vehiclePhoto && (
                <img src={vehiclePhoto} alt="Vehicle verification preview" className="mt-4 max-h-72 w-full rounded-xl border border-border object-cover" />
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {!isVehicleVerified && <Button type="button" variant={vehiclePhoto ? "outline" : "hero"} onClick={() => cameraInputRef.current?.click()} disabled={scanning || reporting}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : vehiclePhoto ? <RotateCcw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {scanning ? "Scanning number plate..." : vehiclePhoto ? "Retake plate photo" : "Scan number plate"}
                </Button>}
                {mismatchDetected && !isVehicleVerified && (
                  <Button type="button" variant="destructive" onClick={reportMismatch} disabled={reporting || scanning}>
                    {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TriangleAlert className="h-4 w-4" />}
                    {reporting ? "Reporting to admin..." : "Wrong vehicle — report to admin"}
                  </Button>
                )}
              </div>

              {scanMessage && (
                <p role="status" className={`mt-4 flex items-center gap-2 text-sm font-medium ${isVehicleVerified ? "text-success" : "text-destructive"}`}>
                  {isVehicleVerified ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <ScanLine className="h-4 w-4 shrink-0" />} {scanMessage}
                </p>
              )}
              {isVehicleVerified && !scanMessage && <p role="status" className="mt-4 flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="h-4 w-4" /> Correct customer vehicle verified</p>}
              {mismatchDetected && !isVehicleVerified && (
                <p className="mt-2 text-xs text-muted-foreground">Sure it is the wrong car? Reporting frees this bay and tells the admin to assign you the next one.</p>
              )}
            </div>}

            <Button className="mt-6 w-full sm:w-auto" variant="hero" size="lg" onClick={finishWash} disabled={finishing || !isVehicleVerified}>
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Finish wash & alert supervisor
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">{isVehicleVerified ? "This marks the wash complete and lets your supervisor know that you can receive another car." : "Verify the assigned vehicle with the camera before completing the wash."}</p>
          </section>
        ) : (
          <section className="max-w-3xl rounded-3xl border border-dashed border-border bg-gradient-card p-10 text-center shadow-card">
            <Clock3 className="mx-auto h-10 w-10 text-success" />
            <h2 className="mt-4 font-display text-2xl font-bold">Your slot is available</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">You do not have a vehicle assigned right now. Your supervisor can assign the next car when it is ready.</p>
          </section>
        )}

        <section className="mt-8 max-w-3xl">
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
                  type="button"
                  onClick={() => void markRead(n.id)}
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
      </main>
    </div>
  );
};

export default Employee;
