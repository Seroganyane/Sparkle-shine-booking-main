import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Admin from "./pages/Admin.tsx";
import Shop from "./pages/Shop.tsx";
import Employee from "./pages/Employee.tsx";
import StaffRegistration from "./pages/StaffRegistration.tsx";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/app/ProtectedRoute";
import { CartProvider } from "@/lib/cart";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-login" element={<Navigate to="/auth" replace />} />
            <Route path="/employee-login" element={<Navigate to="/auth" replace />} />
            <Route path="/staff-register" element={<StaffRegistration />} />
            <Route path="/dashboard" element={<ProtectedRoute userOnly><Dashboard /></ProtectedRoute>} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="/admin/employees" element={<ProtectedRoute adminOnly><Admin view="employees" /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute adminOnly><Admin view="orders" /></ProtectedRoute>} />
            <Route path="/admin/employee-slots" element={<ProtectedRoute adminOnly><Admin view="employee-slots" /></ProtectedRoute>} />
            <Route path="/admin/bookings" element={<ProtectedRoute adminOnly><Admin view="bookings" /></ProtectedRoute>} />
            <Route path="/admin/business-report" element={<ProtectedRoute adminOnly><Admin view="business-report" /></ProtectedRoute>} />
            <Route path="/employee" element={<ProtectedRoute employeeOnly><Employee /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
