import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  Shield,
  ShoppingBag,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SidebarLink = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export const AppSidebar = () => {
  const { user, isAdmin, isEmployee, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const role = isAdmin ? "Administrator" : isEmployee ? "Staff member" : "Customer";
  const homeLink: SidebarLink = isAdmin
    ? { label: "Admin console", path: "/admin", icon: Shield }
    : isEmployee
      ? { label: "My work", path: "/employee", icon: UserRound }
      : { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard };
  const links: SidebarLink[] = isAdmin
    ? [
        homeLink,
        { label: "Employees", path: "/admin/employees", icon: Users },
        { label: "Customer orders", path: "/admin/orders", icon: PackageCheck },
        { label: "Employee slots", path: "/admin/employee-slots", icon: Grid2X2 },
        { label: "Bookings", path: "/admin/bookings", icon: CalendarDays },
        { label: "Business report", path: "/admin/business-report", icon: ChartNoAxesCombined },
        { label: "Shop", path: "/shop", icon: ShoppingBag },
      ]
    : [homeLink, { label: "Shop", path: "/shop", icon: ShoppingBag }];

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const content = (mobile = false) => (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/70 px-5 py-5">
        <p className="font-display text-lg font-semibold">My workspace</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
        <span className="mt-3 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {role}
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Workspace navigation">
        {links.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          const item = (
            <Link
              to={path}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
          return mobile ? <SheetClose asChild key={path}>{item}</SheetClose> : <div key={path}>{item}</div>;
        })}
      </nav>

      <div className="border-t border-border/70 p-3">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-16 left-0 z-40 hidden w-64 border-r border-border/80 bg-card/80 backdrop-blur-xl lg:block">
        {content()}
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="glass" className="fixed left-4 top-20 z-40 rounded-xl lg:hidden" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
          {content(true)}
        </SheetContent>
      </Sheet>
    </>
  );
};
