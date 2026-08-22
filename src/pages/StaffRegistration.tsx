import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Droplets, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const StaffRegistration = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [invitationId] = useState(params.get("invitation") ?? "");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitationId) return toast.error("This invitation link is incomplete.");
    if (!/^\d{6}$/.test(code)) return toast.error("Enter the six-digit invitation code.");
    if (password.length < 6) return toast.error("Password must contain at least six characters.");
    if (password !== confirmPassword) return toast.error("Passwords do not match.");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-signup", { body: { invitationId, code, password } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Registration failed.");

      await supabase.auth.signOut();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      toast.success(data.assignedSlot ? `Staff account activated. Your station is Wash Bay #${data.assignedSlot}.` : "Staff account activated.");
      navigate("/employee", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-hero p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.2),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow"><Droplets className="h-5 w-5 text-primary-foreground" /></span>
          <span className="bg-gradient-primary bg-clip-text text-transparent">AquaLux</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-card backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <UserRound className="h-8 w-8 text-primary" />
            <div><h1 className="font-display text-2xl font-bold">Activate staff account</h1><p className="text-sm text-muted-foreground">One-time staff registration</p></div>
          </div>
          {email && <p className="mt-5 rounded-xl border border-border bg-muted/30 p-3 text-sm">Invitation for <strong>{email}</strong></p>}
          <form onSubmit={register} className="mt-6 space-y-4">
            <div><Label htmlFor="invite-code">Invitation code</Label><Input id="invite-code" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></div>
            <div><Label htmlFor="staff-password">Create password</Label><Input id="staff-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <div><Label htmlFor="staff-password-confirm">Confirm password</Label><Input id="staff-password-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || !email}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Activate staff account
            </Button>
          </form>
          {!email && <p className="mt-4 text-center text-sm text-warning">Open this page using the link in your invitation email.</p>}
        </div>
      </div>
    </div>
  );
};

export default StaffRegistration;
