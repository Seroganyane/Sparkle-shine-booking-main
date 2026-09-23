import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setError("");
        setChecking(false);
      } else if (event === "SIGNED_OUT") {
        setReady(false);
      } else if (event === "INITIAL_SESSION" && session) {
        // Supabase may have processed the recovery link before this page mounted.
        setReady(true);
        setChecking(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setReady(Boolean(data.session));
      setChecking(false);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 6 || password.length > 72) {
      setError("Use a password between 6 and 72 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    toast.success("Password updated successfully.");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-card backdrop-blur-xl">
        <h1 className="font-display text-2xl font-bold">Reset your password</h1>
        {checking ? <p className="mt-4 text-muted-foreground">Checking your reset link...</p> : ready ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={6} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" maxLength={72} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" className="w-full" disabled={saving}>{saving ? "Updating..." : "Update password"}</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-destructive" role="alert">{error || "This reset link is invalid or has expired. Request a new one from the sign-in page."}</p>
        )}
        <Link to="/auth" className="mt-6 block text-center text-sm text-primary underline underline-offset-4">Back to sign in</Link>
      </div>
    </div>
  );
};

export default ResetPassword;
