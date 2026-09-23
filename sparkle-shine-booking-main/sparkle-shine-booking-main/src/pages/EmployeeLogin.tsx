import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Droplets, Loader2, Users } from "lucide-react";
import { getAuthRedirectUrl } from "@/lib/authRedirect";

const employeeLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const employeeSignUpSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(80),
  surname: z.string().trim().min(2, "Surname too short").max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6, "Phone too short").max(20),
  idNumber: z.string().trim().min(5, "ID number too short").max(20),
  password: z.string().min(6, "Min 6 characters").max(72),
});

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const { user, isEmployee, signInAsEmployee } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", surname: "", email: "", phone: "", idNumber: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const parsed = employeeSignUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/employee-login"),
            data: {
              role: "employee",
              full_name: `${parsed.data.name} ${parsed.data.surname}`,
              surname: parsed.data.surname,
              phone: parsed.data.phone,
              id_number: parsed.data.idNumber,
            },
          },
        });

        if (error) throw error;

        toast.success("Staff account created! Check your email to confirm and then sign in.");
        setForm({ name: "", surname: "", email: "", phone: "", idNumber: "", password: "" });
        setMode("signin");
        return;
      }

      const parsed = employeeLoginSchema.safeParse({ email: form.email, password: form.password });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }

      await signInAsEmployee({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      const { data: userData } = await supabase.auth.getUser();
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user?.id)
        .eq("role", "employee")
        .maybeSingle();

      if (!roleData) {
        toast.error("You don't have employee privileges.");
        await supabase.auth.signOut();
        return;
      }

      const { data: slotData } = await supabase
        .from("employee_slots")
        .select("slot_number")
        .eq("employee_id", userData.user?.id)
        .maybeSingle();

      if (slotData) {
        toast.success(`Welcome! Your permanent station is Wash Bay #${slotData.slot_number}`);
      } else {
        toast.success("Employee access granted!");
      }
      navigate("/employee");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (user && isEmployee) {
    navigate("/employee", { replace: true });
  }

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
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{mode === "signin" ? "Staff login" : "Create staff account"}</h1>
              <p className="text-sm text-muted-foreground">{mode === "signin" ? "Employee access" : "Staff registration"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="employee-name">Name</Label>
                    <Input id="employee-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="employee-surname">Surname</Label>
                    <Input id="employee-surname" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="employee-phone">Number</Label>
                  <Input id="employee-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="employee-id-number">ID Number</Label>
                  <Input id="employee-id-number" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} required />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="employee-email">Email</Label>
              <Input id="employee-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="employee-password">Password</Label>
              <Input id="employee-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Staff Sign In" : "Create staff account"}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-6">
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Not a staff member?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              <Link to="/auth" className="font-semibold text-primary hover:underline">
                Go to customer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
