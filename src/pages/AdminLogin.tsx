import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Droplets, Loader2, Shield } from "lucide-react";

const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signInAsAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const parsed = adminLoginSchema.safeParse(form);
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
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user?.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast.error("You don't have admin privileges.");
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

  if (user && isAdmin) {
    navigate("/admin", { replace: true });
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
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Admin login</h1>
              <p className="text-sm text-muted-foreground">Restricted access</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Back to <Link to="/auth" className="font-medium text-primary hover:underline">customer login</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
