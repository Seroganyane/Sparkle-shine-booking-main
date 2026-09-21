import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Droplets, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { showFieldError } from "@/lib/fieldError";
import { edgeFunctionError } from "@/lib/edgeFunctionError";

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter at least two characters for your name.").max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 lowercase letters, numbers, or underscores for your username."),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number.").max(20),
  password: z.string().min(6, "Use at least six characters for your password.").max(72),
});
const signInSchema = z.object({
  login: z.string().trim().min(3, "Enter your username or email address.").max(255),
  password: z.string().min(1, "Enter your password.").max(72),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => {
    const empty = { fullName: "", username: "", email: "", phone: "", password: "" };
    try {
      const saved = sessionStorage.getItem("aqualux-auth-draft");
      if (!saved) return empty;
      const draft = JSON.parse(saved);
      return {
        ...empty,
        fullName: typeof draft.fullName === "string" ? draft.fullName : "",
        username: typeof draft.username === "string" ? draft.username : "",
        email: typeof draft.email === "string" ? draft.email : "",
        phone: typeof draft.phone === "string" ? draft.phone : "",
      };
    } catch {
      return empty;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("aqualux-auth-draft", JSON.stringify({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone,
      }));
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [form.fullName, form.username, form.email, form.phone]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("type") === "recovery" || new URLSearchParams(window.location.search).get("type") === "recovery") {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      return;
    }
    if (!user || authLoading) return;
    navigate(isAdmin ? "/admin" : isEmployee ? "/employee" : "/dashboard", { replace: true });
  }, [user, isAdmin, isEmployee, authLoading, navigate]);

  useEffect(() => {
    document.getElementById(mode === "signin" ? "email" : "name")?.focus();
  }, [mode]);

  const handleForgotPassword = async () => {
    const email = form.email.trim();
    if (!email) {
      showFieldError("Enter your email address to reset your password.", "email");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      showFieldError("Please enter a valid email address.", "email");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });

      if (error) throw error;
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      showFieldError(errorMessage, "email");
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
          const field = parsed.error.issues[0].path[0] === "fullName" ? "name" : String(parsed.error.issues[0].path[0] || "email");
          showFieldError(parsed.error.issues[0].message, field);
          return;
        }
        const { data: usernameAvailable, error: usernameError } = await supabase.rpc("username_is_available", { candidate: parsed.data.username });
        if (usernameError) throw usernameError;
        if (!usernameAvailable) {
          showFieldError("This username is already in use. Choose another one.", "username");
          return;
        }
        const { data: registration, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/dashboard"),
            data: { full_name: parsed.data.fullName, username: parsed.data.username, phone: parsed.data.phone },
          },
        });
        if (error) throw error;
        if (registration.session) {
          toast.success("Account created. Welcome to AquaLux!");
          navigate("/dashboard");
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setForm((current) => ({ ...current, password: "" }));
          setMode("signin");
        }
      } else {
        const parsed = signInSchema.safeParse({ login: form.email, password: form.password });
        if (!parsed.success) {
          showFieldError(parsed.error.issues[0].message, parsed.error.issues[0].path[0] === "password" ? "password" : "email");
          return;
        }
        let signedInUserId: string;
        if (parsed.data.login.includes("@")) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: parsed.data.login,
            password: parsed.data.password,
          });
          if (error) throw error;
          signedInUserId = data.user.id;
        } else {
          const { data: tokens, error } = await supabase.functions.invoke("username-signin", {
            body: { username: parsed.data.login, password: parsed.data.password },
          });
          if (error) {
            const status = error.context instanceof Response ? error.context.status : null;
            throw status === 401
              ? new Error("Invalid username or password.")
              : await edgeFunctionError(error);
          }
          if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error("Username sign-in is temporarily unavailable. Sign in with your email address.");
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          if (sessionError || !data.user) throw sessionError || new Error("Could not start your session.");
          signedInUserId = data.user.id;
        }

        const { data: roles, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", signedInUserId);
        if (roleError) throw roleError;

        const roleNames = new Set((roles ?? []).map(({ role }) => role));
        const destination = roleNames.has("admin")
          ? "/admin"
          : roleNames.has("employee")
            ? "/employee"
            : "/dashboard";

        if (destination === "/employee") {
          const { error: slotError } = await supabase.rpc("auto_assign_employee_slot", {
            _employee_id: signedInUserId,
          });
          if (slotError) console.error("Failed to assign staff slot:", slotError);
        }

        toast.success("Welcome back!");
        navigate(destination, { replace: true });
      }
    } catch (err: unknown) {
      // Supabase database (PostgREST) errors are plain objects, not Error instances.
      const errorMessage = err instanceof Error
        ? err.message
        : typeof (err as { message?: unknown } | null)?.message === "string"
          ? (err as { message: string }).message
          : "Something went wrong";
      showFieldError(errorMessage, mode === "signin" ? "password" : "email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center bg-gradient-hero p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.2),transparent_60%)]" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link to="/" aria-label="AquaLux home" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="bg-gradient-primary bg-clip-text text-transparent">AquaLux</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-xl shadow-card">
          <>
              <h1 className="font-display text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin" ? "Customer, staff and admin sign in here" : "Create a customer account"}
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone number</Label>
                      <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    </div>
                  </>
                )}
                {mode === "signup" && (
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" autoComplete="username" minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" title="Use 3 to 30 lowercase letters, numbers, or underscores." value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required />
                    <p className="mt-1 text-sm text-muted-foreground">Use this username or your email address to sign in.</p>
                  </div>
                )}
                <div>
                  <Label htmlFor="email">{mode === "signin" ? "Username or email address" : "Email address"}</Label>
                  <Input id="email" type={mode === "signin" ? "text" : "email"} autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-glow"
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
                className="mt-6 w-full text-center text-sm text-primary underline underline-offset-4 hover:text-primary-glow"
              >
                {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
              </button>
            </>
        </div>
      </div>
    </div>
  );
};

export default Auth;
