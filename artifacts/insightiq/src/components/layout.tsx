import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Scale, History, LayoutDashboard, Settings, FileSearch2 } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/",        label: "Legal Analyzer",    icon: LayoutDashboard },
    { href: "/general", label: "General Analyzer",  icon: FileSearch2 },
    { href: "/history", label: "History",            icon: History },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <Link href="/" className="font-display font-bold text-xl tracking-tight text-white hover:text-white/80 transition-colors">
              InsightIQ
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-all px-4 py-2 rounded-lg",
                    isActive
                      ? "bg-white/8 text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <button className="p-2 text-muted-foreground hover:text-white transition-colors rounded-full hover:bg-white/5">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-secondary border border-white/10 flex items-center justify-center text-sm font-medium text-white shadow-sm">
              JD
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
