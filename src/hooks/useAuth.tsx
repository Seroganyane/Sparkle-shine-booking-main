import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppSession = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>;
type AppUser = AppSession["user"];

type AuthCtx = {
  user: AppUser | null;
  session: AppSession | null;
  isAdmin: boolean;
  isEmployee: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsAdmin: (credentials?: { email: string; password: string }) => Promise<void>;
  signInAsEmployee: (credentials?: { email: string; password: string }) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

const hasRole = async (userId: string | undefined, role: "admin" | "employee") => {
  if (!userId) return false;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", role).maybeSingle();
  return Boolean(data);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSession = async (nextSession: AppSession | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);
    if (!nextUser) { setIsAdmin(false); setIsEmployee(false); return; }
    const [admin, employee] = await Promise.all([hasRole(nextUser.id, "admin"), hasRole(nextUser.id, "employee")]);
    setIsAdmin(admin);
    setIsEmployee(employee);
  };

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!isMounted) return;
      await syncSession(initialSession);
      setLoading(false);
    };
    void initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => { void syncSession(nextSession); setLoading(false); });
    return () => { isMounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await syncSession(null);
  };

  const signInAsAdmin = async (credentials?: { email: string; password: string }) => {
    if (!credentials?.email || !credentials?.password) throw new Error("Admin email and password are required.");
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    await syncSession(data.session);
  };

  const signInAsEmployee = async (credentials?: { email: string; password: string }) => {
    if (!credentials?.email || !credentials?.password) throw new Error("Employee email and password are required.");
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    await syncSession(data.session);
    
    // Auto-assign permanent slot to employee
    if (data.session?.user?.id) {
      const { error: slotError } = await supabase.rpc('auto_assign_employee_slot', {
        _employee_id: data.session.user.id
      });
      if (slotError) {
        console.error('Failed to assign slot:', slotError);
        // Don't throw - slot assignment failure shouldn't block login
      }
    }
  };

  return <Ctx.Provider value={{ user, session, isAdmin, isEmployee, loading, signOut, signInAsAdmin, signInAsEmployee }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);
