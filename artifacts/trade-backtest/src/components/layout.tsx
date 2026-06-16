import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CandlestickChart,
  BarChart2, Settings, Zap,
  Brain, X, BookOpen,
  Shield, LogIn, LogOut, Users, Crown, CreditCard, Wrench, Store,
  Sun, Moon, Bot, Dna, Activity, Target, FlaskConical, Newspaper,
  UserCircle, Calculator, Play, Search, ChevronDown,
  Cpu, Globe, Plus, Layers, TestTube, Bell, GraduationCap, Map, Library, FileText, Trophy, Award,
  TrendingUp, Calendar, Building2,
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
    primary: "/market",
    items: [
      { title: "Markets",        url: "/market",    icon: Globe,            desc: "Browse & discover all assets" },
      { title: "Live Charts",    url: "/chart",     icon: CandlestickChart, desc: "Advanced charting & analysis" },
      { title: "Paper Trading",  url: "/demo",      icon: Play,             desc: "Simulated trading practice" },
      { title: "Alert Engine",   url: "/alerts",    icon: Bell,             desc: "Multi-condition smart alerts" },
      { title: "Brokerage",      url: "/brokerage", icon: Building2,        desc: "Live account & order management" },
    ],
  },
  {
    id: "research",
    label: "Research",
    icon: Search,
    primary: "/ai",
    items: [
      { title: "AI Assistant",   url: "/ai",          icon: Bot,        desc: "AI-powered trading coach" },
      { title: "Market News",    url: "/news",         icon: Newspaper,  desc: "Live market news & events" },
      { title: "Calculator",     url: "/calculator",   icon: Calculator, desc: "Position & risk calculator" },
      { title: "Marketplace",    url: "/marketplace",  icon: Store,      desc: "Community strategy store" },
    ],
  },
  {
    id: "strategy-lab",
    label: "Strategy Lab",
    icon: FlaskConical,
    primary: "/strategies",
    items: [
      { title: "All Strategies",   url: "/strategies",            icon: Layers,    desc: "Build & manage strategies" },
      { title: "New Strategy",     url: "/strategies/new",        icon: Plus,      desc: "Create a new strategy" },
      { title: "AI Builder",       url: "/strategies/ai-builder", icon: Bot,       desc: "AI-powered strategy creation" },
      { title: "All Backtests",    url: "/backtests",             icon: BookOpen,  desc: "Historical backtesting results" },
      { title: "New Backtest",     url: "/backtests/new",         icon: Plus,      desc: "Run a new backtest" },
      { title: "Batch Backtest",   url: "/backtests/batch",       icon: Layers,    desc: "Multi-strategy batch runs" },
      { title: "Strategy Builder", url: "/backtests/builder",     icon: Cpu,       desc: "Visual drag-and-drop builder" },
      { title: "Stress Test",      url: "/stress-test",           icon: Zap,       desc: "Monte Carlo stress testing" },
      { title: "Strategy DNA",     url: "/strategy-dna",          icon: Dna,       desc: "Deep strategy analysis" },
    ],
  },
  {
    id: "trader-dna",
    label: "Trader DNA",
    icon: Dna,
    primary: "/trading-os",
    items: [
      { title: "AI Trader OS",  url: "/trading-os",  icon: Brain,      desc: "AI coaching, rank, ghost, FOMO & more" },
      { title: "DNA Overview",  url: "/trader-dna",  icon: Dna,        desc: "Your full trader profile" },
      { title: "Analytics",    url: "/analytics",   icon: BarChart2,  desc: "Performance analytics" },
      { title: "Psych Match",  url: "/psych-match", icon: Bot,        desc: "Psychology profiling" },
      { title: "Profile",      url: "/profile",     icon: UserCircle, desc: "Account & preferences" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    primary: "/tools",
    items: [
      { title: "Screener",       url: "/tools", icon: Search,      desc: "Scan markets by momentum & volume" },
      { title: "Heat Map",       url: "/tools", icon: BarChart2,   desc: "Visual market performance grid" },
      { title: "Depth Chart",    url: "/tools", icon: Activity,    desc: "Order book & market depth" },
      { title: "Correlation",    url: "/tools", icon: TrendingUp,  desc: "Cross-asset correlation matrix" },
      { title: "Econ Calendar",  url: "/tools", icon: Calendar,    desc: "Upcoming economic events" },
      { title: "Risk Calculator",url: "/tools", icon: Calculator,  desc: "Position sizing & risk calc" },
      { title: "Funding Rates",  url: "/tools", icon: Zap,         desc: "Live perpetual funding rates" },
    ],
  },
  {
    id: "footprint",
    label: "Footprint",
    icon: Activity,
    primary: "/footprint",
    items: [
      { title: "Footprint Charts",   url: "/footprint",                    icon: BarChart2,  desc: "Bid×Ask, Delta, Volume & CVD" },
      { title: "Market Scanner",     url: "/footprint?tab=scanner",        icon: Search,     desc: "Top opportunities by delta & imbalance" },
      { title: "Smart Alerts",       url: "/footprint?tab=alerts",         icon: Bell,       desc: "Delta, absorption & divergence alerts" },
      { title: "Session Analytics",  url: "/footprint?tab=sessions",       icon: TrendingUp, desc: "London / NY / Tokyo / Sydney stats" },
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: Users,
    primary: "/community",
    items: [
      { title: "Feed",         url: "/community",   icon: Users,    desc: "Trader community posts" },
      { title: "Marketplace",  url: "/marketplace", icon: Store,    desc: "Published strategies" },
      { title: "Pricing",      url: "/pricing",     icon: Crown,    desc: "Subscription plans" },
    ],
  },
  {
    id: "academy",
    label: "Academy",
    icon: GraduationCap,
    primary: "/academy",
    items: [
      { title: "Dashboard",      url: "/academy",   icon: LayoutDashboard, desc: "Your learning progress & XP" },
      { title: "Learning Paths", url: "/academy",   icon: Map,             desc: "Beginner to Professional paths" },
      { title: "Topic Library",  url: "/academy",   icon: Library,         desc: "Search all trading topics" },
      { title: "AI Tutor",       url: "/academy",   icon: Bot,             desc: "Ask any trading question" },
      { title: "Notes Hub",      url: "/academy",   icon: FileText,        desc: "Your private trading notes" },
      { title: "Quizzes",        url: "/academy",   icon: Trophy,          desc: "Test your knowledge" },
      { title: "Certificates",   url: "/academy",   icon: Award,           desc: "Earn & download certificates" },
    ],
  },
] as const;

/* ── Route → section mapping ───────────────────────────────────────── */
const ROUTE_SECTION: Record<string, string> = {
  "/chart": "trade",       "/demo": "trade",        "/alerts": "trade",  "/market": "trade",
  "/brokerage": "trade",
  "/ai": "research",       "/news": "research",    "/calculator": "research",
  "/marketplace": "research",
  "/strategies": "strategy-lab",  "/backtests": "strategy-lab",
  "/stress-test": "strategy-lab", "/strategy-dna": "strategy-lab",
  "/analytics": "trader-dna",     "/psych-match": "trader-dna",
  "/profile": "trader-dna",       "/trader-dna": "trader-dna",
  "/trading-os": "trader-dna",
  "/tools": "tools",
  "/footprint": "footprint",
  "/community": "community",      "/pricing": "community",
  "/academy": "academy",
};

function getActiveSection(location: string): string | null {
  for (const [prefix, section] of Object.entries(ROUTE_SECTION)) {
    if (location === prefix || location.startsWith(prefix + "/")) return section;
  }
  return null;
}

/* ── Mobile dock — exactly 5 primary items ─────────────────────────── */
// Home item opens the overflow sheet (community, account, theme, auth)
const DOCK_ITEMS = [
  { title: "Trade",    url: "/market",     icon: CandlestickChart, sectionId: "trade" },
  { title: "Research", url: "/ai",         icon: Search,           sectionId: "research" },
  { title: "Home",     url: null,          icon: LayoutDashboard,  sectionId: null,         home: true },
  { title: "Strategy", url: "/strategies", icon: FlaskConical,     sectionId: "strategy-lab" },
  { title: "Sign In",  url: null,          icon: LogIn,            sectionId: null,         signin: true },
] as const;

/* ── Home sheet sections (overflow hub, replaces 6th dock slot) ─────── */
const HOME_SHEET_SECTIONS = [
  {
    label: "Trade & Charts",
    items: [
      { title: "Markets",       url: "/market",    icon: Globe },
      { title: "Live Charts",   url: "/chart",     icon: CandlestickChart },
      { title: "Paper Trading", url: "/demo",      icon: Play },
      { title: "Alert Engine",  url: "/alerts",    icon: Bell },
      { title: "Footprint",     url: "/footprint", icon: Activity },
      { title: "Brokerage",     url: "/brokerage", icon: Building2 },
    ],
  },
  {
    label: "Research",
    items: [
      { title: "AI Assistant",  url: "/ai",          icon: Bot },
      { title: "Market News",   url: "/news",        icon: Newspaper },
      { title: "Calculator",    url: "/calculator",  icon: Calculator },
      { title: "Marketplace",   url: "/marketplace", icon: Store },
    ],
  },
  {
    label: "Strategy Lab",
    items: [
      { title: "Strategies",       url: "/strategies",        icon: Layers },
      { title: "Batch Backtest",   url: "/backtests/batch",   icon: Layers },
      { title: "Strategy Builder", url: "/backtests/builder", icon: Cpu },
      { title: "Stress Test",      url: "/stress-test",       icon: Zap },
      { title: "Strategy DNA",     url: "/strategy-dna",      icon: Dna },
    ],
  },
  {
    label: "Trader DNA",
    items: [
      { title: "AI Trader OS",  url: "/trading-os",  icon: Brain },
      { title: "DNA Overview",  url: "/trader-dna",  icon: Dna },
      { title: "Analytics",     url: "/analytics",   icon: BarChart2 },
      { title: "Psych Match",   url: "/psych-match", icon: Bot },
    ],
  },
  {
    label: "More",
    items: [
      { title: "Tools",      url: "/tools",      icon: Wrench },
      { title: "Academy",    url: "/academy",    icon: GraduationCap },
      { title: "Community",  url: "/community",  icon: Users },
      { title: "Pricing",    url: "/pricing",    icon: Crown },
      { title: "Dashboard",  url: "/dashboard",  icon: LayoutDashboard },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile",  url: "/profile",  icon: UserCircle },
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Billing",  url: "/billing",  icon: CreditCard },
    ],
  },
] as const;

/* ── Layout ────────────────────────────────────────────────────────── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [hoverSection, setHoverSection] = useState<string | null>(null);
  const [homeSheetOpen, setHomeSheetOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, signout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const activeSection = getActiveSection(location);
  const isDashboard = location === "/" || location === "/dashboard";

  useEffect(() => { setHomeSheetOpen(false); setHoverSection(null); }, [location]);

  function isItemActive(url: string) {
    if (url === "/dashboard") return isDashboard;
    return location === url || location.startsWith(url + "/");
  }

  /* Hover menu helpers */
  function handleSectionEnter(id: string) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoverSection(id);
  }
  function handleSectionLeave() {
    hoverTimerRef.current = setTimeout(() => setHoverSection(null), 120);
  }
  function handleMenuEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }
  function handleMenuLeave() {
    hoverTimerRef.current = setTimeout(() => setHoverSection(null), 120);
  }

  const orbBg = isDark
    ? [
        "radial-gradient(ellipse 90% 70% at 15% 20%,  rgba(255,255,255,0.05) 0%, transparent 65%)",
        "radial-gradient(ellipse 70% 55% at 85% 80%,  rgba(255,255,255,0.04) 0%, transparent 65%)",
        "radial-gradient(ellipse 60% 50% at 80% 10%,  rgba(255,255,255,0.03) 0%, transparent 60%)",
        "radial-gradient(ellipse 50% 40% at 20% 90%,  rgba(255,255,255,0.03) 0%, transparent 60%)",
        "#050505",
      ].join(",")
    : [
        "radial-gradient(ellipse 80% 60% at 15% 20%,  rgba(0,0,0,0.04) 0%, transparent 60%)",
        "radial-gradient(ellipse 60% 50% at 85% 85%,  rgba(0,0,0,0.03) 0%, transparent 60%)",
        "#f5f5f7",
      ].join(",");

  return (
    <div className="tt-root" style={{ background: orbBg }}>

      {/* ── DESKTOP TOP NAV ──────────────────────────────────────────── */}
      <header className="glass-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-[56px]">

        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2.5 px-5 cursor-pointer select-none flex-shrink-0 group">
            <div className="h-7 w-7 rounded-xl overflow-hidden flex-shrink-0" style={{
              boxShadow: isDark
                ? "0 0 0 1px rgba(255,255,255,0.12), 0 2px 10px rgba(0,0,0,0.5)"
                : "0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)",
              transition: "box-shadow 0.22s ease",
            }}>
              <img src="/logo.png" className="h-full w-full object-cover" alt="Trade Lab" />
            </div>
            <span style={{
              fontFamily: "var(--app-font-display)",
              fontSize: "14.5px",
              fontWeight: 700,
              letterSpacing: "-0.032em",
              color: "var(--nav-active-color)",
            }}>
              Trade Lab
            </span>
          </span>
        </Link>

        <div className="w-px h-4 mx-2 flex-shrink-0" style={{ background: "var(--nav-border)" }} />

        {/* Section nav — click navigates to primary, hover opens dropdown */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-2">
          {SECTIONS.map((section) => {
            const isActiveSection = activeSection === section.id;
            const isOpen = hoverSection === section.id;
            return (
              <div
                key={section.id}
                className="relative"
                onMouseEnter={() => handleSectionEnter(section.id)}
                onMouseLeave={handleSectionLeave}
              >
                {/* Clicking navigates to primary route */}
                <Link href={section.primary}>
                  <span
                    className="flex items-center gap-1.5 cursor-pointer select-none"
                    style={{
                      padding: "5px 12px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontFamily: "var(--app-font-display)",
                      fontWeight: isActiveSection ? 600 : 500,
                      letterSpacing: isActiveSection ? "-0.018em" : "-0.010em",
                      border: `1px solid ${(isActiveSection || isOpen) ? "var(--nav-active-border)" : "transparent"}`,
                      background: (isActiveSection || isOpen) ? "var(--nav-active-bg)" : "transparent",
                      color: (isActiveSection || isOpen) ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                      boxShadow: (isActiveSection || isOpen) ? "var(--shadow-tab-active)" : "none",
                      transition: "all 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
                      display: "flex",
                    }}
                  >
                    <section.icon style={{ height: "12px", width: "12px", flexShrink: 0 }} />
                    {section.label}
                    <ChevronDown style={{
                      height: "10px", width: "10px", flexShrink: 0,
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                      opacity: 0.4,
                    }} />
                  </span>
                </Link>

                {/* Hover dropdown mega-menu */}
                {isOpen && (
                  <div
                    className="glass-panel absolute top-[calc(100%+8px)] rounded-2xl p-1.5 dropdown-enter"
                    style={{
                      zIndex: 200,
                      left: "50%",
                      transform: "translateX(-50%)",
                      minWidth: section.items.length > 5 ? "480px" : "272px",
                    }}
                    onMouseEnter={handleMenuEnter}
                    onMouseLeave={handleMenuLeave}
                  >
                    <div className="nothing-label px-2.5 pt-1.5 pb-1">
                      {section.label}
                    </div>
                    <div className="arch-divider mx-2 mb-1.5" />
                    <div className={section.items.length > 5 ? "grid grid-cols-2 gap-0.5" : "flex flex-col gap-0.5"}>
                      {section.items.map((item, idx) => {
                        const active = isItemActive(item.url);
                        return (
                          <Link key={item.title} href={item.url}>
                            <span
                              className="flex items-start gap-2.5 px-3 py-2 rounded-xl cursor-pointer fade-up-sm"
                              style={{
                                background: active ? "var(--nav-active-bg)" : "transparent",
                                color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                                transition: "background 0.14s ease, color 0.14s ease",
                                animationDelay: `${idx * 0.03}s`,
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
                                <span style={{ fontSize: "12.5px", fontWeight: active ? 600 : 500, letterSpacing: "-0.012em", fontFamily: "var(--app-font-display)", lineHeight: 1, marginBottom: "3px" }}>{item.title}</span>
                                <span className="nothing-label" style={{ letterSpacing: "0.08em" }}>{item.desc}</span>
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

          {/* Alert Engine bell — links to /alerts */}
          <Link href="/alerts">
            <span
              className="relative flex items-center justify-center"
              title="Alert Engine"
              style={{
                width: "32px", height: "32px", borderRadius: "9px",
                border: `1px solid ${isItemActive("/alerts") ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                background: isItemActive("/alerts") ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                color: isItemActive("/alerts") ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Bell style={{ height: "13px", width: "13px" }} />
            </span>
          </Link>

          {/* Settings link */}
          <Link href="/settings">
            <span
              className="flex items-center justify-center"
              title="Settings"
              style={{
                width: "32px", height: "32px", borderRadius: "9px",
                border: `1px solid ${isItemActive("/settings") ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                background: isItemActive("/settings") ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                color: isItemActive("/settings") ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Settings style={{ height: "13px", width: "13px" }} />
            </span>
          </Link>

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
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "white" }}>
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

          {/* Live indicator — Nothing-tech dot */}
          <span className="flex items-center gap-1.5 ml-1" style={{
            fontFamily: "var(--app-font-mono)",
            fontSize: "9.5px",
            fontWeight: 500,
            letterSpacing: "0.12em",
            color: "var(--nav-dim-color)",
          }}>
            <span className="h-1.5 w-1.5 rounded-full live-pulse"
              style={{ background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.9)" }} />
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

      {/* ── MOBILE FLOATING DOCK — exactly 5 items ───────────────────── */}
      <div className="tt-float-dock md:hidden">
        {DOCK_ITEMS.map((item) => {
          const isHome = 'home' in item && item.home === true;
          const isSignin = 'signin' in item && item.signin === true;

          // Active state
          const itemUrl = ('url' in item ? (item as { url: string | null }).url : null);
          const active = isHome
            ? homeSheetOpen || isDashboard
            : isSignin
              ? showAuthModal
              : (itemUrl
                  ? ('sectionId' in item && item.sectionId
                      ? activeSection === item.sectionId
                      : isItemActive(itemUrl))
                  : false);

          const iconColor  = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";
          const labelColor = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";

          if (isHome) {
            return (
              <button
                key="home"
                onClick={() => setHomeSheetOpen(true)}
                className={`dock-item ${active ? "dock-item-active" : ""}`}
              >
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    position: "absolute",
                    inset: "-5px -10px",
                    borderRadius: "14px",
                    background: active
                      ? "var(--nav-active-bg)"
                      : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"),
                    border: `1px solid ${active ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                    zIndex: 0,
                  }} />
                  <item.icon style={{ height: "20px", width: "20px", color: iconColor, position: "relative", zIndex: 1 }} />
                </div>
                <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: labelColor, marginTop: "2px" }}>
                  {item.title}
                </span>
              </button>
            );
          }

          if (isSignin) {
            // If already logged in, show profile link instead
            if (user) {
              return (
                <Link key="profile" href="/profile">
                  <div className={`dock-item ${isItemActive("/profile") ? "dock-item-active" : ""}`}>
                    <div className="h-[18px] w-[18px] rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "white" }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: isItemActive("/profile") ? "var(--nav-active-color)" : "var(--nav-dim-color)", whiteSpace: "nowrap" }}>
                      Profile
                    </span>
                  </div>
                </Link>
              );
            }
            return (
              <button
                key="signin"
                onClick={() => setShowAuthModal(true)}
                className={`dock-item ${active ? "dock-item-active" : ""}`}
              >
                <item.icon style={{ height: "18px", width: "18px", color: iconColor }} />
                <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: labelColor, whiteSpace: "nowrap" }}>
                  Sign In
                </span>
              </button>
            );
          }

          return (
            <Link key={item.title} href={item.url!}>
              <div className={`dock-item ${active ? "dock-item-active" : ""}`}>
                <item.icon style={{ height: "18px", width: "18px", color: iconColor }} />
                <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: labelColor, whiteSpace: "nowrap" }}>
                  {item.title}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── MOBILE HOME SHEET (overflow hub) ─────────────────────────── */}
      {homeSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden fade-in"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setHomeSheetOpen(false)}
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
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: "var(--nav-border)" }} />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--nav-dim-color)" }}>
                Home
              </p>
              <div className="flex items-center gap-2">
                {/* Theme toggle — accessible from mobile sheet */}
                <button onClick={toggleTheme}
                  className="h-8 w-8 flex items-center justify-center rounded-full"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                  {isDark ? <Sun style={{ height: "13px", width: "13px" }} /> : <Moon style={{ height: "13px", width: "13px" }} />}
                </button>
                <button onClick={() => setHomeSheetOpen(false)}
                  className="h-8 w-8 flex items-center justify-center rounded-full"
                  style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                  <X style={{ height: "13px", width: "13px" }} />
                </button>
              </div>
            </div>

            {/* Auth row */}
            <div className="px-4 mb-3">
              {user ? (
                <Link href="/profile" onClick={() => setHomeSheetOpen(false)}>
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
                    <button onClick={(e) => { e.preventDefault(); signout(); setHomeSheetOpen(false); }}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
                      style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", color: "var(--nav-dim-color)", border: "1px solid var(--nav-border)" }}>
                      <LogOut style={{ height: "11px", width: "11px" }} />
                      Out
                    </button>
                  </div>
                </Link>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setHomeSheetOpen(false); }}
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

            {/* Sectioned nav items */}
            <div className="px-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "50dvh" }}>
              {HOME_SHEET_SECTIONS.map(section => (
                <div key={section.label}>
                  <div className="text-[9px] font-mono uppercase tracking-widest px-1 mb-1.5"
                    style={{ color: "var(--nav-dim-color)", opacity: 0.5 }}>
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map(item => {
                      const active = isItemActive(item.url);
                      return (
                        <Link key={item.title} href={item.url} onClick={() => setHomeSheetOpen(false)}>
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
