import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/app/Navbar";
import { PACKAGES } from "@/lib/packages";
import heroImg from "@/assets/hero-carwash.jpg";
import { Calendar, Bell, CreditCard, Gift, Sparkles, Check, ArrowRight } from "lucide-react";

const features = [
  { icon: Calendar, title: "Book in seconds", desc: "Pick a slot, package & car. Done." },
  { icon: Bell, title: "Smart reminders", desc: "Get notified the exact moment to arrive." },
  { icon: CreditCard, title: "Pay online", desc: "Secure checkout — skip the line." },
  { icon: Gift, title: "Earn free washes", desc: "10 washes = 1 on the house." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="container relative grid gap-12 py-20 lg:grid-cols-2 lg:py-32">
          <div className="flex flex-col justify-center animate-fade-up">
            <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" /> Smart booking · Real-time queue
            </span>
            <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
              Your car deserves a <span className="bg-gradient-primary bg-clip-text text-transparent">flawless</span> shine.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Book your slot, get pinged at exactly the right time, pay online, and rack up free washes. Zero waiting. Zero stress.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button variant="hero" size="xl" asChild>
                <Link to="/auth">
                  Book a wash <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="glass" size="xl" asChild>
                <a href="#packages">View packages</a>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <div><span className="text-2xl font-bold text-foreground">10k+</span><div>Cars washed</div></div>
              <div className="h-10 w-px bg-border" />
              <div><span className="text-2xl font-bold text-foreground">4.9★</span><div>Avg rating</div></div>
              <div className="h-10 w-px bg-border" />
              <div><span className="text-2xl font-bold text-foreground">15min</span><div>Avg wait</div></div>
            </div>
          </div>
          <div className="relative animate-fade-up">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-primary opacity-20 blur-3xl" />
            <img
              src={heroImg}
              alt="Premium car covered in foam at a high-tech car wash"
              width={1536}
              height={1024}
              className="relative w-full rounded-3xl border border-border shadow-card"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-gradient-card p-6 backdrop-blur transition-all hover:border-primary/40 hover:shadow-glow"
            >
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-all">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="container py-20">
        <div className="mx-auto mb-12 max-w-2xl rounded-3xl border border-border bg-slate-800/90 p-10 text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl text-foreground">Pick your package</h2>
          <p className="mt-3 text-foreground">Three tiers. All powered by the same obsession with detail.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {PACKAGES.map((p, i) => (
            <div
              key={p.id}
              className={`relative rounded-2xl border bg-slate-800/90 p-8 transition-all hover:-translate-y-1 hover:shadow-glow ${
                i === 1 ? "border-primary/60 shadow-glow" : "border-border"
              }`}
            >
              {i === 1 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold">R {p.price}</span>
                <span className="text-sm text-muted-foreground">· {p.duration}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Button variant={i === 1 ? "hero" : "glass"} className="mt-8 w-full" asChild>
                <Link to="/auth">Book now</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AquaLux Carwash. Crafted with care by Ponas.
      </footer>
    </div>
  );
};

export default Index;
