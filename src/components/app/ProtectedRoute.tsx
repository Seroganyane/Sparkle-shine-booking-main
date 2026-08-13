import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = ({ children, adminOnly = false, employeeOnly = false, userOnly = false }: { children: ReactNode; adminOnly?: boolean; employeeOnly?: boolean; userOnly?: boolean }) => {
  const { user, isAdmin, isEmployee, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-12 w-12 animate-pulse-glow rounded-full bg-gradient-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (userOnly && (isAdmin || isEmployee)) return <Navigate to="/shop" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/shop" replace />;
  if (employeeOnly && !isEmployee) return <Navigate to="/employee-login" replace />;
  return <>{children}</>;
};

