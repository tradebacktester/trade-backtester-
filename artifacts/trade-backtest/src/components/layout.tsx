import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CandlestickChart,
  BarChart2, Settings, Zap, Brain,
  MoreHorizontal, X, ChevronRight, BookOpen,
  Shield, LogIn, LogOut, User, Users, Crown, CreditCard, Wrench, Store,
  Sun, Moon, Bot, Dna, Activity, Target, FlaskConical, Newspaper,
  UserCircle, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { AuthModal } from "@/components/auth-modal";

const DESKTOP_ITEMS = [
  { title: "Charts",    url: "/chart",      icon: CandlestickChart },
  { title: "Backtests", url: "/backtests",  icon: BookOpen },
  { title: "Home",      url: "/dashboard",  icon: LayoutDashboard, home: true },
  { title: "Community", url: "/community",  icon: Users },
  { title: "AI",        url: "/ai",         icon: Brain },
] as const;

const DOCK_ITEMS = [
  { title: "Charts",    url: "/chart",      icon: CandlestickChart },
  { title: "Backtests", url: "/backtests",  icon: BookOpen },
  { title: "Home",      url: "/dashboard",  icon: LayoutDashboard, home: true },
  { title: "AI",        url: "/ai",         icon: Brain },
  { title: "More",      url: null,          icon: MoreHorizontal },
] as const;

const NAV_SECTIONS = [
  {
    label: "Trading",
    items: [
      { title: "Charts",          url: "/chart",             icon: CandlestickChart },
      { title: "Backtests",       url: "/backtests",         icon: BookOpen },
      { title: "Strategy Builder",url: "/backtests/builder", icon: Target },
      { title: "Batch Backtest",  url: "/backtests/batch",   icon: Activity },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { title: "Community",       url: "/community",    icon: Users },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { title: "AI Assistant",    url: "/ai",           icon: Bot },
      { title: "Strategy DNA",    url: "/strategy-dna", icon: Dna },
      { title: "Psych Match",     url: "/psych-match",  icon: Brain },
      { title: "Stress Test",     url: "/stress-test",  icon: FlaskConical },
    ],
  },
  {
    label: "Tools",
    items: [
      { title: "Analytics",       url: "/analytics",    icon: BarChart2 },
      { title: "Tools",           url: "/tools",        icon: Wrench },
      { title: "News",            url: "/news",         icon: Newspaper },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile",         url: "/profile",      icon: UserCircle },
      { title: "Pricing",         url: "/pricing",      icon: Crown },
      { title: "Billing",         url: "/billing",      icon: CreditCard },
      { title: "Settings",        url: "/settings",     icon: Settings },
      { title: "Admin",           url: "/admin",        icon: Shield },
    ],
  },
] as const;

const MOBILE_SECTIONS = NAV_SECTIONS;

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { user, signout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (!moreOpen) return;
    function handler(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  useEffect(() => { setSheetOpen(false); setMoreOpen(false); }, [location]);

  const isActive = (url: string) => {
    if (url === "/dashboard") return location === "/" || location === "/dashboard";
    return location.startsWith(url);
  };

  const allMoreItems = NAV_SECTIONS.flatMap(s => s.items as readonly { url: string }[]);
  const moreActive = allMoreItems.some(i => isActive(i.url));
  const mobileMoreActive = allMoreItems.some(i => isActive(i.url));

  return (
    <div className="tt-root">

      {/* ── DESKTOP TOP NAV ────────────────────────────────────────── */}
      <header className="glass-nav fixed top-0 inset-x-0 z-50 hidden md:flex items-center h-[56px]">

        {/* Logo */}
        <Link href="/dashboard">
          <span className="flex items-center gap-2.5 px-5 cursor-pointer select-none">
            <div className="h-7 w-7 rounded-xl overflow-hidden flex-shrink-0" style={{
              boxShadow: isDark
                ? "0 0 0 1px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.4)"
                : "0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)",
            }}>
              <img src="/logo.png" className="h-full w-full object-cover" alt="Trade Lab" />
            </div>
            <span className="text-[13.5px] font-bold tracking-tight" style={{ color: "var(--nav-active-color)" }}>
              Trade Lab
            </span>
          </span>
        </Link>

        <div className="w-px h-4 mx-2 flex-shrink-0" style={{ background: "var(--nav-border)" }} />

        {/* Nav items */}
        <nav className="flex-1 flex items-center justify-center gap-0.5 px-2">
          {DESKTOP_ITEMS.map((item) => {
            const active = isActive(item.url);
            const isHome = 'home' in item && item.home;
            return (
              <Link key={item.title} href={item.url}>
                <span
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                  style={{
                    padding: isHome ? "5px 16px" : "5px 10px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    border: `1px solid ${active ? "var(--nav-active-border)" : (isHome ? "var(--nav-border)" : "transparent")}`,
                    background: active ? "var(--nav-active-bg)" : (isHome ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)") : "transparent"),
                    color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                    boxShadow: active ? "var(--shadow-tab-active)" : (isHome ? "var(--shadow-2xs)" : "none"),
                    transition: "all 0.18s cubic-bezier(0.34,1.2,0.64,1)",
                  }}
                >
                  <item.icon style={{ height: "13px", width: "13px", flexShrink: 0 }} />
                  {item.title}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 pr-4 flex-shrink-0">

          {/* Theme Toggle */}
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
                background: isActive("/profile") ? "var(--nav-active-bg)" : "transparent",
                color: isActive("/profile") ? "var(--nav-active-color)" : "var(--nav-dim-color)",
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
                border: `1px solid ${isDark ? "rgba(77,163,255,0.25)" : "rgba(0,0,0,0.08)"}`,
                background: isDark ? "rgba(77,163,255,0.10)" : "rgba(0,0,0,0.04)",
                color: isDark ? "#4DA3FF" : "var(--nav-dim-color)",
                cursor: "pointer",
              }}
            >
              <LogIn style={{ height: "12px", width: "12px" }} />
              Sign In
            </button>
          )}

          {/* Sectioned More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex items-center gap-1.5"
              style={{
                padding: "5px 10px", borderRadius: "9px",
                fontSize: "13px", fontWeight: 500,
                border: `1px solid ${moreOpen || moreActive ? "var(--nav-active-border)" : "transparent"}`,
                background: moreOpen || moreActive ? "var(--nav-active-bg)" : "transparent",
                color: moreOpen || moreActive ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                cursor: "pointer",
              }}
            >
              <MoreHorizontal style={{ height: "13px", width: "13px" }} />
              More
            </button>

            {moreOpen && (
              <div
                className="glass-panel absolute right-0 top-[calc(100%+8px)] rounded-2xl p-2 flex gap-3 scale-in"
                style={{ zIndex: 200, minWidth: "580px" }}
              >
                {NAV_SECTIONS.map(section => (
                  <div key={section.label} className="flex-1 min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-widest px-2 py-1.5 mb-0.5" style={{ color: "var(--nav-dim-color)", opacity: 0.5 }}>
                      {section.label}
                    </div>
                    {section.items.map(item => {
                      const active = isActive(item.url);
                      return (
                        <Link key={item.title} href={item.url} onClick={() => setMoreOpen(false)}>
                          <span
                            className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-[12px] cursor-pointer"
                            style={{
                              background: active ? "var(--nav-active-bg)" : "transparent",
                              color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
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
                            <item.icon style={{ height: "12px", width: "12px", flexShrink: 0 }} />
                            {item.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live indicator */}
          <span className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "var(--nav-dim-color)" }}>
            <span className="h-1.5 w-1.5 rounded-full live-pulse" style={{ background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.8)" }} />
            LIVE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
      <main className="tt-main">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6">
          {children}
        </div>
      </main>

      {/* ── MOBILE FLOATING DOCK ───────────────────────────────────── */}
      <div className="tt-float-dock md:hidden">
        {DOCK_ITEMS.map((item) => {
          const isHome = 'home' in item && item.home === true;
          const active = item.url ? isActive(item.url) : mobileMoreActive;
          const isMore = item.url === null;

          const iconColor = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";
          const labelColor = active ? "var(--nav-active-color)" : "var(--nav-dim-color)";

          if (isMore) {
            return (
              <button
                key="more"
                onClick={() => setSheetOpen(true)}
                className={`dock-item ${active ? "dock-item-active" : ""}`}
              >
                <item.icon style={{ height: "18px", width: "18px", color: iconColor }} />
                <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: labelColor }}>
                  More
                </span>
              </button>
            );
          }

          return (
            <Link key={item.title} href={item.url!}>
              <div className={`dock-item ${active ? "dock-item-active" : ""} ${isHome ? "relative" : ""}`}>
                <item.icon style={{ height: isHome ? "20px" : "18px", width: isHome ? "20px" : "18px", color: iconColor }} />
                <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.03em", color: labelColor }}>
                  {item.title}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── MOBILE MORE SHEET ──────────────────────────────────────── */}
      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] md:hidden fade-in"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="tt-slide-up fixed inset-x-0 z-[61] md:hidden"
            style={{
              bottom: 0,
              borderRadius: "28px 28px 0 0",
              background: "var(--sheet-bg)",
              backdropFilter: "blur(40px) saturate(200%)",
              WebkitBackdropFilter: "blur(40px) saturate(200%)",
              borderTop: "1px solid var(--nav-border)",
              borderLeft: "1px solid var(--nav-border)",
              borderRight: "1px solid var(--nav-border)",
              boxShadow: "var(--shadow-sheet)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: "var(--nav-border)" }} />
            </div>

            {/* Sheet header */}
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
                    background: isDark ? "rgba(77,163,255,0.12)" : "hsl(var(--primary))",
                    color: isDark ? "#4DA3FF" : "white",
                    border: `1px solid ${isDark ? "rgba(77,163,255,0.25)" : "transparent"}`,
                    boxShadow: isDark ? "none" : "var(--shadow-btn)",
                    fontWeight: 600, fontSize: "14px",
                  }}
                >
                  <LogIn style={{ height: "14px", width: "14px" }} />
                  Sign In / Create Account
                </button>
              )}
            </div>

            {/* Sectioned items */}
            <div className="px-4 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "calc(65dvh - 8px)", paddingBottom: "4px" }}>
              {MOBILE_SECTIONS.map(section => (
                <div key={section.label}>
                  <div className="text-[9px] font-mono uppercase tracking-widest px-1 mb-1.5" style={{ color: "var(--nav-dim-color)", opacity: 0.5 }}>
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {section.items.map(item => {
                      const active = isActive(item.url);
                      return (
                        <Link key={item.title} href={item.url} onClick={() => setSheetOpen(false)}>
                          <span
                            className="flex items-center gap-3.5 px-4 py-2.5 rounded-2xl cursor-pointer active:opacity-70"
                            style={{
                              background: active
                                ? "var(--nav-active-bg)"
                                : (isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)"),
                              border: `1px solid ${active ? "var(--nav-active-border)" : "var(--nav-border)"}`,
                              color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)",
                            }}
                          >
                            <span className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center"
                              style={{ background: active ? "var(--nav-active-bg)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"), border: "1px solid var(--nav-border)" }}>
                              <item.icon style={{ height: "13px", width: "13px", color: active ? "var(--nav-active-color)" : "var(--nav-dim-color)" }} />
                            </span>
                            <span className="text-[14px] font-medium">{item.title}</span>
                            {active && <ChevronRight style={{ height: "12px", width: "12px", marginLeft: "auto" }} />}
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
