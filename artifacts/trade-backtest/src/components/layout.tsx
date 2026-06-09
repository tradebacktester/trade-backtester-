import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CandlestickChart,
  BarChart2, Settings, Zap, Brain,
  X, BookOpen,
  Shield, LogIn, LogOut, Users, Crown, CreditCard, Wrench, Store,
  Sun, Moon, Bot, Dna, Activity, Target, FlaskConical, Newspaper,
  UserCircle, Calculator, Play, Search, ChevronDown,
  Cpu, Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { AuthModal } from "@/components/auth-modal";

/* ── Section definitions ───────────────────────────────────────────── */
const SECTIONS = [
  {
    id: "trade",
    label: "Trade",
    icon: CandlestickChart,
    primary: "/chart",
    items: [
      { title: "Live Charts",    url: "/chart",   icon: CandlestickChart, desc: "Advanced charting & analysis" },
      { title: "Paper Trading",  url: "/demo",    icon: Play,             desc: "Simulated trading practice" },
      { title: "Tools",          url: "/tools",   icon: Wrench,           desc: "Drawing & analysis tools" },
    ],
  },
  {
    id: "research",
    label: "Research",
    icon: Search,
    primary: "/ai",
    items: [
      { title: "AI Assistant",   url: "/ai",          icon: Bot,       desc: "AI-powered trading coach" },
      { title: "Market News",    url: "/news",         icon: Newspaper, desc: "Live market news & events" },
      { title: "Calculator",     url: "/calculator",   icon: Calculator,desc: "Position & risk calculator" },
      { title: "Marketplace",    url: "/marketplace",  icon: Store,     desc: "Community strategies" },
    ],
  },
  {
    id: "strategy-lab",
    label: "Strategy Lab",
    icon: FlaskConical,
    primary: "/strategies",
    items: [
      { title: "Strategies",       url: "/strategies",           icon: Target,      desc: "Build & manage strategies" },
      { title: "Backtests",        url: "/backtests",            icon: BookOpen,    desc: "Historical backtesting" },
      { title: "Batch Backtest",   url: "/backtests/batch",      icon: Activity,    desc: "Multi-strategy runs" },
      { title: "Strategy Builder", url: "/backtests/builder",    icon: Cpu,         desc: "Visual drag-and-drop builder" },
      { title: "AI Builder",       url: "/strategies/ai-builder",icon: Bot,         desc: "AI-powered strategy creation" },
      { title: "Stress Test",      url: "/stress-test",          icon: Zap,         desc: "Monte Carlo stress testing" },
      { title: "Strategy DNA",     url: "/strategy-dna",         icon: Dna,         desc: "Deep strategy analysis" },
    ],
  },
  {
    id: "trader-dna",
    label: "Trader DNA",
    icon: Dna,
    primary: "/trader-dna",
    items: [
      { title: "Overview",     url: "/trader-dna",  icon: Globe,       desc: "Your full trader profile" },
      { title: "Analytics",    url: "/analytics",   icon: BarChart2,   desc: "Performance analytics" },
      { title: "Psych Match",  url: "/psych-match", icon: Brain,       desc: "Psychology profiling" },
      { title: "Profile",      url: "/profile",     icon: UserCircle,  desc: "Account & preferences" },
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    primary: "/community",
    items: [
      { title: "Feed",         url: "/community",   icon: Users,       desc: "Trader community posts" },
      { title: "Marketplace",  url: "/marketplace", icon: Store,       desc: "Published strategies" },
      { title: "Pricing",      url: "/pricing",     icon: Crown,       desc: "Subscription plans" },
    ],
  },
] as const;

/* ── Route → section mapping ───────────────────────────────────────── */
const ROUTE_SECTION: Record<string, string> = {
  "/chart": "trade", "/demo": "trade", "/tools": "trade",
  "/ai": "research", "/news": "research", "/calculator": "research", "/marketplace": "research",
  "/strategies": "strategy-lab", "/backtests": "strategy-lab",
  "/stress-test": "strategy-lab", "/strategy-dna": "strategy-lab",
  "/analytics": "trader-dna", "/psych-match": "trader-dna",
  "/profile": "trader-dna", "/trader-dna": "trader-dna",
  "/community": "community",
};

function getActiveSection(location: string): string | null {
  for (const [prefix, section] of Object.entries(ROUTE_SECTION)) {
    if (location === prefix || location.startsWith(prefix + "/")) return section;
  }
  return null;
}

/* ── Mobile dock items ─────────────────────────────────────────────── */
const DOCK_ITEMS = [
  { title: "Trade",        url: "/chart",      icon: CandlestickChart, sectionId: "trade" },
  { title: "Research",     url: "/ai",         icon: Search,           sectionId: "research" },
  { title: "Home",         url: "/dashboard",  icon: LayoutDashboard,  sectionId: null, home: true },
  { title: "Strategy Lab", url: "/strategies", icon: FlaskConical,     sectionId: "strategy-lab" },
  { title: "Trader DNA",   url: "/trader-dna", icon: Dna,              sectionId: "trader-dna" },
] as const;

/* ── Mobile sheet secondary items ──────────────────────────────────── */
const SHEET_EXTRAS = [
  {
    label: "Account",
    items: [
      { title: "Profile",   url: "/profile",   icon: UserCircle },
      { title: "Pricing",   url: "/pricing",   icon: Crown },
      { title: "Billing",   url: "/billing",   icon: CreditCard },
      { title: "Settings",  url: "/settings",  icon: Settings },
      { title: "Admin",     url: "/admin",     icon: Shield },
    ],
  },
] as const;

/* ── Layout ────────────────────────────────────────────────────────── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const { user, signout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const activeSection = getActiveSection(location);
  const isDashboard = location === "/" || location === "/dashboard";

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!openSection) return;
    function handler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenSection(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openSection]);

  /* Close sheet/dropdown on navigation */
  useEffect(() => { setSheetOpen(false); setOpenSection(null); }, [location]);

  function toggleSection(id: string) {
    setOpenSection(v => (v === id ? null : id));
  }

  function isItemActive(url: string) {
    if (url === "/dashboard") return isDashboard;
    return location === url || location.startsWith(url + "/");
  }

  return (
    <div className="tt-root">

      {/* ── DESKTOP TOP NAV ──────────────────────────────────────────── */}
      <header className="glass-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-[56px]">

        {/* Logo → Home */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2.5 px-5 cursor-pointer select-none flex-shrink-0">
            <div className="h-7 w-7 rounded-xl overflow-hidden flex-shrink-0" style={{
              boxShadow: isDark
                ? "0 0 0 1px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.4)"
                : "0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)",
            }}>
              <img src="/logo.png" className="h-full w-full object-cover" alt="Trade Lab" />
            </div>
            <span className="text-[13.5px] font-bold" style={{ color: "var(--nav-active-color)", letterSpacing: "-0.022em" }}>
              Trade Lab
            </span>
          </span>
        </Link>

        <div className="w-px h-4 mx-2 flex-shrink-0" style={{ background: "var(--nav-border)" }} />

        {/* Section nav */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-2 relative" ref={navRef}>
          {SECTIONS.map((section) => {
            const isActiveSection = activeSection === section.id;
            const isOpen = openSection === section.id;
            return (
              <div key={section.id} className="relative">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  style={{
                    padding: "5px 11px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: isActiveSection ? 600 : 500,
                    letterSpacing: isActiveSection ? "-0.01em" : "0em",
                    border: `1px solid ${(isActiveSection || isOpen) ? "var(--nav-active-border)" : "transparent"}`,
                    background: (isActiveSection || isOpen) ? "var(--nav-active-bg)" : "transparent",
                    color: (isActiveSection || isOpen) ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                    boxShadow: (isActiveSection || isOpen) ? "var(--shadow-tab-active)" : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  <section.icon style={{ height: "12px", width: "12px", flexShrink: 0 }} />
                  {section.label}
                  <ChevronDown style={{
                    height: "10px", width: "10px", flexShrink: 0,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.18s ease",
                    opacity: 0.5,
                  }} />
                </button>

                {/* Dropdown mega-menu */}
                {isOpen && (
                  <div
                    className="glass-panel absolute top-[calc(100%+10px)] rounded-2xl p-2 scale-in"
                    style={{
                      zIndex: 200,
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: section.items.length > 4 ? "440px" : "280px",
                    }}
                  >
                    <div className="text-[9px] font-mono uppercase tracking-widest px-2 py-1.5 mb-1"
                      style={{ color: "var(--nav-dim-color)", opacity: 0.5 }}>
                      {section.label}
                    </div>
                    <div className={section.items.length > 4 ? "grid grid-cols-2 gap-0.5" : "flex flex-col gap-0.5"}>
                      {section.items.map((item) => {
                        const active = isItemActive(item.url);
                        return (
                          <Link key={item.title} href={item.url} onClick={() => setOpenSection(null)}>
                            <span
                              className="flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer"
                              style={{
                                background: active ? "var(--nav-active-bg)" : "transparent",
                                color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                                transition: "background 0.12s ease, color 0.12s ease",
                              }}
                              onMouseEnter={e => {
                                if (!active) {
                                  (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
                                  (e.currentTarget as HTMLElement).style.color = "var(--nav-active-color)";
                                }
                              }}
                              onMouseLeave={e => {
                                if (!active) {
                                  (e.currentTarget as HTMLElement).style.background = "transparent";
                                  (e.currentTarget as HTMLElement).style.color = "var(--nav-dim-color)";
                                }
                              }}
                            >
                              <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{
                                  background: active ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                                  border: "1px solid var(--nav-border)",
                                }}>
                                <item.icon style={{ height: "12px", width: "12px", color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)" }} />
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[12px] font-medium leading-none mb-0.5">{item.title}</span>
                                <span className="text-[10px] font-mono opacity-50 leading-tight">{item.desc}</span>
                              </div>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 pr-4 flex-shrink-0">

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "9px",
              border: "1px solid var(--nav-border)",
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
              color: "var(--nav-dim-color)", cursor: "pointer",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--nav-active-color)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--nav-active-border)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "var(--nav-dim-color)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--nav-border)";
            }}
          >
            {isDark ? <Sun style={{ height: "13px", width: "13px" }} /> : <Moon style={{ height: "13px", width: "13px" }} />}
          </button>

          {/* User / Sign In */}
          {user ? (
            <Link href="/profile">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer" style={{
                border: "1px solid var(--nav-border)",
                background: isItemActive("/profile") ? "var(--nav-active-bg)" : "transparent",
                color: isItemActive("/profile") ? "var(--nav-active-color)" : "var(--nav-dim-color)",
              }}>
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{
                  background: "linear-gradient(135deg, #6366f1, #a855f7)",
                  color: "white",
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[12px] font-medium">{user.name.split(" ")[0]}</span>
              </div>
            </Link>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5"
              style={{
                padding: "5px 13px", borderRadius: "9px",
                fontSize: "13px", fontWeight: 600,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
                background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)",
                color: isDark ? "#FFFFFF" : "var(--nav-dim-color)",
                cursor: "pointer",
              }}
            >
              <LogIn style={{ height: "12px", width: "12px" }} />
              Sign In
            </button>
          )}

          {/* Live indicator */}
          <span className="flex items-center gap-1.5 text-[11px] font-mono ml-1" style={{ color: "var(--nav-dim-color)" }}>
            <span className="h-1.5 w-1.5 rounded-full live-pulse"
              style={{ background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
            LIVE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main className="tt-main">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6">
          {children}
        </div>
      </main>

      {/* ── MOBILE FLOATING DOCK (5 tabs) ────────────────────────────── */}
      <div className="tt-float-dock md:hidden">
        {DOCK_ITEMS.map((item) => {
          const isHome = 'home' in item && item.home === true;
          const active = item.url
            ? (isHome ? isDashboard : (activeSection === item.sectionId || isItemActive(item.url)))
            : false;

          const iconColor = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";
          const labelColor = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";

          return (
            <Link key={item.title} href={item.url}>
              <div
                className={`dock-item ${active ? "dock-item-active" : ""}`}
                style={isHome ? { position: "relative" } : {}}
              >
                {isHome && (
                  <div style={{
                    position: "absolute",
                    inset: "-3px -6px",
                    borderRadius: "14px",
                    background: active
                      ? "var(--nav-active-bg)"
                      : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                    border: `1px solid ${active ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                    zIndex: 0,
                  }} />
                )}
                <item.icon style={{
                  height: isHome ? "20px" : "18px",
                  width:  isHome ? "20px" : "18px",
                  color: iconColor,
                  position: "relative", zIndex: 1,
                }} />
                <span style={{
                  fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em",
                  color: labelColor, position: "relative", zIndex: 1,
                  whiteSpace: "nowrap",
                }}>
                  {item.title}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── MOBILE MORE SHEET ────────────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden fade-in"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="tt-slide-up fixed inset-x-0 z-[61] md:hidden"
            style={{
              bottom: 0,
              borderRadius: "28px 28px 0 0",
              background: "var(--sheet-bg)",
              borderTop: "1px solid var(--nav-border)",
              borderLeft: "1px solid var(--nav-border)",
              borderRight: "1px solid var(--nav-border)",
              boxShadow: "var(--shadow-sheet)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: "var(--nav-border)" }} />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--nav-dim-color)" }}>
                Navigation
              </p>
              <div className="flex items-center gap-2">
                <button onClick={toggleTheme}
                  className="h-8 w-8 flex items-center justify-center rounded-full"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                  {isDark ? <Sun style={{ height: "13px", width: "13px" }} /> : <Moon style={{ height: "13px", width: "13px" }} />}
                </button>
                <button onClick={() => setSheetOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                  <X style={{ height: "13px", width: "13px" }} />
                </button>
              </div>
            </div>

            {/* User row */}
            <div className="px-4 mb-3">
              {user ? (
                <Link href="/profile" onClick={() => setSheetOpen(false)}>
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer"
                    style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--nav-border)" }}>
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "white" }}>
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--nav-active-color)" }}>{user.name}</p>
                        <p className="text-[10px]" style={{ color: "var(--nav-dim-color)" }}>{user.email}</p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); signout(); setSheetOpen(false); }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
                      style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                      <LogOut style={{ height: "11px", width: "11px" }} />
                      Sign Out
                    </button>
                  </div>
                </Link>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setSheetOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl"
                  style={{
                    background: isDark ? "rgba(255,255,255,0.08)" : "hsl(var(--primary))",
                    color: isDark ? "#FFFFFF" : "white",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "transparent"}`,
                    fontWeight: 600, fontSize: "14px",
                  }}
                >
                  <LogIn style={{ height: "14px", width: "14px" }} />
                  Sign In / Create Account
                </button>
              )}
            </div>

            <div className="px-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "calc(55dvh - 8px)", paddingBottom: "4px" }}>
              {SHEET_EXTRAS.map(section => (
                <div key={section.label}>
                  <div className="text-[9px] font-mono uppercase tracking-widest px-1 mb-1.5" style={{ color: "var(--nav-dim-color)", opacity: 0.5 }}>
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map(item => {
                      const active = isItemActive(item.url);
                      return (
                        <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                          <span
                            className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl cursor-pointer active:opacity-70"
                            style={{
                              background: active ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)"),
                              border: `1px solid ${active ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                              color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                            }}
                          >
                            <span className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center"
                              style={{ background: active ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"), border: "1px solid var(--nav-border)" }}>
                              <item.icon style={{ height: "13px", width: "13px", color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)" }} />
                            </span>
                            <span className="text-[14px] font-medium">{item.title}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
