import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Mock user and session types to match Supabase structure
type MockUser = {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
  };
};

type MockSession = {
  user: MockUser;
  access_token: string;
};

type AuthCtx = {
  user: MockUser | null;
  session: MockSession | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  signInAsAdmin: () => void;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

// Mock admin credentials
const ADMIN_EMAIL = "seroganyanemathaba@gmail.com";
const ADMIN_PASSWORD = "Ponagalo#2026";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<MockSession | null>(null);
  const [user, setUser] = useState<MockUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedSession = localStorage.getItem('mock_session');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
        setUser(parsedSession.user);
        // Check if this is an admin user
        setIsAdmin(parsedSession.user.email === ADMIN_EMAIL);
      } catch (error) {
        localStorage.removeItem('mock_session');
      }
    }
    setLoading(false);
  }, []);

  // Listen for storage changes to update auth state
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mock_session') {
        if (e.newValue) {
          try {
            const parsedSession = JSON.parse(e.newValue);
            setSession(parsedSession);
            setUser(parsedSession.user);
            setIsAdmin(parsedSession.user.email === ADMIN_EMAIL);
          } catch (error) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
          }
        } else {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const signOut = async () => {
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('mock_session');
    // Dispatch storage event to notify other components
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'mock_session',
      oldValue: localStorage.getItem('mock_session'),
      newValue: null,
      storageArea: localStorage
    }));
  };

  const signInAsAdmin = () => {
    const mockUser: MockUser = {
      id: 'admin-user-id',
      email: ADMIN_EMAIL,
      user_metadata: { full_name: 'Admin User' }
    };
    const mockSession: MockSession = {
      user: mockUser,
      access_token: 'mock-admin-token'
    };

    setSession(mockSession);
    setUser(mockUser);
    setIsAdmin(true);
    localStorage.setItem('mock_session', JSON.stringify(mockSession));
  };

  // Make mock auth available globally for components that import supabase
  // Note: Auth is now handled directly by the mock Supabase client

  return <Ctx.Provider value={{ user, session, isAdmin, loading, signOut, signInAsAdmin }}>{children}</Ctx.Provider>;
};

export const useAuth = () => useContext(Ctx);