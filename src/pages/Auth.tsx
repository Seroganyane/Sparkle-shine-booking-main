import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Droplets, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectUrl } from "@/lib/authRedirect";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Name too short").max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6, "Phone too short").max(20),
  password: z.string().min(6, "Min 6 characters").max(72),
});
const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signInAsAdmin } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loginType, setLoginType] = useState<"customer" | "admin">("customer");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });

  useEffect(() => {
    if (!user) return;
    navigate(isAdmin ? "/admin" : "/dashboard");
  }, [user, isAdmin, navigate]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = signInSchema.safeParse(form);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }

      await signInAsAdmin({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      const { data: userData } = await supabase.auth.getUser();
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user?.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        toast.error("You don't have admin privileges");
        await supabase.auth.signOut();
        return;
      }

      toast.success("Admin access granted!");
      navigate("/admin");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.email.trim();
    if (!email) {
      toast.error("Please enter your email address first.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/auth"),
      });

      if (error) throw error;
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/dashboard"),
            data: { full_name: parsed.data.fullName, phone: parsed.data.phone },
          },
        });
        if (error) throw error;
        toast.success("Account created! Welcome to AquaLux ✨");
        navigate("/dashboard");
      } else {
        const parsed = signInSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-hero p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.2),transparent_60%)]" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="bg-gradient-primary bg-clip-text text-transparent">AquaLux</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-xl shadow-card">
          <div className="mb-6 grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => {
                setLoginType("customer");
                setMode("signin");
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${loginType === "customer" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Customer
            </button>
            <Link
              to="/admin-login"
              className="rounded-lg px-3 py-2 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Admin
            </Link>
            <Link
              to="/employee-login"
              className="rounded-lg px-3 py-2 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Staff
            </Link>
          </div>

          {loginType === "customer" ? (
            <>
              <h1 className="font-display text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Sign in to book your wash" : "Start earning rewards today"}
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      onClick={handleForgotPassword}
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-primary"
              >
                {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow">
                  <Shield className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold">Admin login</h1>
                  <p className="text-sm text-muted-foreground">Restricted access</p>
                </div>
              </div>

              <form onSubmit={handleAdminSignIn} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="admin-email">Admin email</Label>
                  <Input id="admin-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="admin-password">Password</Label>
                  <Input id="admin-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Admin Sign In
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Need a customer account? <button type="button" className="font-medium text-primary hover:underline" onClick={() => setLoginType("customer")}>Use customer login</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
