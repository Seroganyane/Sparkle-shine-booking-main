import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, LogOut, UserRound } from "lucide-react";

export const Navbar = () => {
  const { user, isEmployee, signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate("/auth", { replace: true }); };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-[#07111f]/90 shadow-[0_8px_24px_rgba(2,6,23,0.35)] backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="font-display text-xl font-bold"><span className="bg-gradient-primary bg-clip-text text-transparent">AquaLux</span></Link>
        <nav className="flex items-center gap-2 rounded-full border border-border/80 bg-card/55 px-2 py-1.5 shadow-card backdrop-blur-md">
          {user ? <>
            {isEmployee && <Button variant="ghost" size="sm" asChild className="rounded-full text-foreground/90 hover:bg-white/5"><Link to="/employee"><UserRound className="h-4 w-4" /> My work</Link></Button>}
            <Button variant="glass" size="sm" onClick={handleSignOut} className="rounded-full border-primary/20 bg-[#0f1f34]/80 text-foreground hover:bg-[#162942]"><LogOut className="h-4 w-4" /> Sign out</Button>
          </> : <>
            <Button variant="hero" size="sm" asChild className="rounded-full"><Link to="/auth"><LogIn className="h-4 w-4" /> Sign in</Link></Button>
          </>}
        </nav>
      </div>
    </header>
  );
};
