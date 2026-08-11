import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppSession = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>;
type AppUser = AppSession["user"];

type AuthCtx = {
  user: AppUser | null;
  session: AppSession | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsAdmin: (credentials?: { email: string; password: string }) => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

const checkIsAdmin = async (userId?: string) => {
  if (!userId) return false;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return Boolean(data);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncSession = async (nextSession: AppSession | null) => {
    setSession(nextSession);
    const nextUser = nextSession?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      setIsAdmin(false);
      return;
    }

    const admin = await checkIsAdmin(nextUser.id);
    setIsAdmin(admin);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await syncSession(null);
  };

  const signInAsAdmin = async (credentials?: { email: string; password: string }) => {
    if (!credentials?.email || !credentials?.password) {
      throw new Error("Admin email and password are required.");
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) throw error;
    await syncSession(data.session);
  };

  return <Ctx.Provider value={{ user, session, isAdmin, loading, signOut, signInAsAdmin }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);